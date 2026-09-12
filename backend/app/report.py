"""The report generator: turns a finished conversation into a structured, scored report."""

import json
import logging

from pydantic import BaseModel, Field, ValidationError

from app.groq_client import AIError, chat
from app.schemas import Band, Difficulty, InterviewContext, Message, Report

logger = logging.getLogger("interview_coach")

PASS_THRESHOLD = 55

BANDS: list[tuple[int, Band]] = [
    (85, "excellent"),
    (70, "good"),
    (55, "adequate"),
    (0, "weak"),
]


def band_for(score: int) -> Band:
    for floor, band in BANDS:
        if score >= floor:
            return band
    return "weak"


class _ModelReport(BaseModel):
    """What we ask the model for. Band and Pass/Fail are derived from the score server-side."""

    score: int = Field(ge=0, le=100)
    strengths: list[str] = Field(min_length=1, max_length=6)
    weaknesses: list[str] = Field(min_length=1, max_length=6)
    topics_to_revise: list[str] = Field(max_length=8)
    verdict: str = Field(min_length=1)
    preparation_tips: list[str] = Field(default_factory=list, max_length=6)


SYSTEM_PROMPT = """You are a senior technical interviewer writing the assessment for a mock interview that has just finished.

Grade strictly but fairly, relative to the stated difficulty.

SCORING SCALE (0-100)
- 85-100: excellent — accurate, thorough, clear reasoning across nearly all questions
- 70-84: good — mostly correct with minor gaps
- 55-69: adequate — partial understanding; several gaps or vague answers
- 0-54: weak — mostly incorrect, missing, or "I don't know" answers

RULES
- Every strength and weakness MUST refer to something the candidate actually said. Quote or closely paraphrase their words. Never invent points that were not raised.
- If the candidate gave almost no substantive answers, say so plainly and score accordingly.
- Code answers (fenced ``` blocks): judge correctness, edge cases, readability and stated time/space complexity.
  Name concrete bugs or missed cases in weaknesses.
- topics_to_revise: specific sub-topics within the interview topic that the weak answers exposed.
- verdict: 2-4 sentences of overall assessment written to the candidate ("You ..."), honest and constructive.
- preparation_tips: 3-5 concrete, actionable things to do before the real interview. If a round, target role or
  resume is provided, tailor them: e.g. how to present resume experience better, what this round typically
  expects, gaps between the resume and the answers given. Otherwise base them on the transcript alone.

Return ONLY a JSON object with exactly these keys:
{
  "score": <integer 0-100>,
  "strengths": [<string>, ...],
  "weaknesses": [<string>, ...],
  "topics_to_revise": [<string>, ...],
  "verdict": <string>,
  "preparation_tips": [<string>, ...]
}"""


def _transcript(messages: list[Message]) -> str:
    lines = []
    for m in messages:
        who = "INTERVIEWER" if m.role == "interviewer" else "CANDIDATE"
        lines.append(f"{who}: {m.content}")
    return "\n\n".join(lines)


def generate_report(
    topic: str, difficulty: Difficulty, messages: list[Message], ctx: InterviewContext | None = None
) -> Report:
    ctx = ctx or InterviewContext()
    header = [
        f"TOPIC: {topic}" if topic else "TOPIC: resume-driven interview (subject matter taken from the candidate's resume)",
        f"DIFFICULTY: {difficulty}",
    ]
    if ctx.round:
        header.append(f"ROUND: {ctx.round}")
    if ctx.target_role:
        header.append(f"TARGET ROLE: {ctx.target_role}")
    user_content = "\n".join(header)
    if ctx.resume_text:
        user_content += f"\n\nCANDIDATE RESUME:\n{ctx.resume_text}"
    user_content += f"\n\nTRANSCRIPT:\n\n{_transcript(messages)}"
    convo = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    last_error: Exception | None = None
    for attempt in range(2):
        raw = chat(convo, temperature=0.2, json_mode=True, max_tokens=2500)
        try:
            data = json.loads(raw)
            parsed = _ModelReport.model_validate(data)
            break
        except (json.JSONDecodeError, ValidationError) as e:
            last_error = e
            logger.warning("Report parse failed (attempt %d): %s", attempt + 1, e)
    else:
        logger.error("Report generation failed after retries: %s", last_error)
        raise AIError("The AI produced an unreadable report. Please try again.", status=502)

    score = parsed.score
    return Report(
        score=score,
        band=band_for(score),
        result="Pass" if score >= PASS_THRESHOLD else "Fail",
        strengths=[s.strip() for s in parsed.strengths if s.strip()],
        weaknesses=[w.strip() for w in parsed.weaknesses if w.strip()],
        topics_to_revise=[t.strip() for t in parsed.topics_to_revise if t.strip()],
        verdict=parsed.verdict.strip(),
        preparation_tips=[t.strip() for t in parsed.preparation_tips if t.strip()],
    )
