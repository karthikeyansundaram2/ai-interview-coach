from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Difficulty = Literal["Easy", "Medium", "Hard"]
Role = Literal["interviewer", "candidate"]
Round = Literal["Phone screen", "Technical", "System design", "Behavioral", "Hiring manager", "Final round"]


class InterviewContext(BaseModel):
    """Optional personalisation. Sent back by the frontend on every call (no database)."""

    round: Round | None = None
    target_role: str | None = Field(default=None, max_length=120)
    resume_text: str | None = Field(default=None, max_length=8000)
    resume_filename: str | None = Field(default=None, max_length=200)

    @field_validator("target_role", "resume_text")
    @classmethod
    def blank_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @property
    def has_resume(self) -> bool:
        return bool(self.resume_text)


class Message(BaseModel):
    role: Role
    content: str = Field(min_length=1, max_length=8000)


class _InterviewRequest(BaseModel):
    """Common fields. A topic is required unless a resume is attached — then the resume drives the interview."""

    topic: str = Field(default="", max_length=120)
    difficulty: Difficulty
    context: InterviewContext = Field(default_factory=InterviewContext)

    @field_validator("topic")
    @classmethod
    def strip_topic(cls, v: str) -> str:
        return " ".join(v.split())

    @model_validator(mode="after")
    def topic_or_resume(self):
        if not self.topic and not self.context.has_resume:
            raise ValueError("Enter a topic, or upload a resume to let it drive the interview.")
        if self.topic and len(self.topic) < 2:
            raise ValueError("Topic must be at least 2 characters.")
        return self


class StartRequest(_InterviewRequest):
    pass


class StartResponse(BaseModel):
    message: str
    interview_over: bool = False


class AnswerRequest(_InterviewRequest):
    messages: list[Message] = Field(min_length=1, max_length=60)
    answer: str = Field(min_length=1, max_length=8000)

    @field_validator("answer")
    @classmethod
    def strip_answer(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Answer cannot be empty.")
        return v


class AnswerResponse(BaseModel):
    message: str
    interview_over: bool


class ReportRequest(_InterviewRequest):
    messages: list[Message] = Field(min_length=2, max_length=60)


Band = Literal["excellent", "good", "adequate", "weak"]


class Report(BaseModel):
    score: int = Field(ge=0, le=100)
    band: Band
    result: Literal["Pass", "Fail"]
    strengths: list[str]
    weaknesses: list[str]
    topics_to_revise: list[str]
    verdict: str
    preparation_tips: list[str] = []


class ResumeProfileOut(BaseModel):
    summary: str
    experience_level: str
    key_skills: list[str]
    notable_projects: list[str]


class ResumeParseResponse(BaseModel):
    filename: str
    text: str
    word_count: int
    profile: ResumeProfileOut | None


class ErrorResponse(BaseModel):
    detail: str
