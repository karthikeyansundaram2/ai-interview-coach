Many qualities you care about — helpfulness, faithfulness, tone — can't be checked with a regex. LLM-as-judge uses a model to grade outputs against a rubric, giving you scalable evaluation, as long as you treat the judge itself as something to be validated.

## The analogy

A university can't have the head of department grade every exam, so teaching assistants grade using a detailed marking scheme. The department head periodically re-grades a sample to check the TAs agree with her. If one TA is consistently generous or confused by long answers, the scheme gets clarified or the TA retrained. The LLM judge is the TA; your human labels are the department head.

## Grading modes

| Mode | How | Best for |
|---|---|---|
| Single-output, rubric | Score one answer against criteria (pass/fail or 1–5) | Regression gates, monitoring |
| Reference-based | Compare answer to a gold reference | QA with known answers |
| Pairwise | "Which of A or B is better?" | Comparing prompt/model versions |
| Claim-level | Split answer into claims, check each against sources | Faithfulness in RAG |

**Binary or small-scale judgments are more reliable than fine-grained scores.** "Does the answer contain any claim not supported by the context? yes/no" beats "rate faithfulness 1–10".

## A well-built judge

```python
from typing import Literal
from pydantic import BaseModel

class Verdict(BaseModel):
    reasoning: str                          # comes first: judgment conditions on it
    unsupported_claims: list[str]
    verdict: Literal["pass", "fail"]

JUDGE_PROMPT = """You are grading a customer-support answer for FAITHFULNESS.

Criterion: every factual claim in the ANSWER must be supported by the CONTEXT.
- Paraphrase is fine. General courtesy ("happy to help") is not a claim.
- If the answer says it doesn't know and the context lacks the info, that is a pass.
- Any unsupported specific (number, date, policy detail) is a fail.

<context>{context}</context>
<question>{question}</question>
<answer>{answer}</answer>

List unsupported claims, explain briefly, then give the verdict."""

def judge_faithfulness(llm, question, context, answer) -> Verdict:
    return llm.structured(Verdict, JUDGE_PROMPT.format(
        context=context, question=question, answer=answer), temperature=0)
```

Design rules:
- **One criterion per judge call.** Separate judges for faithfulness, relevance, and tone are more accurate than one mega-rubric.
- **Explicit definitions and edge cases** in the rubric, ideally with a few graded examples.
- **Reasoning before verdict** in the output schema.
- **Use a strong model** for judging, and preferably not the exact same configuration that generated the answer.

## Known biases

| Bias | Description | Mitigation |
|---|---|---|
| Position bias | Prefers the first (or second) option in pairwise | Run both orders; count only consistent wins |
| Verbosity bias | Prefers longer answers | Rubric says length isn't quality; control for length |
| Self-preference | Prefers outputs from its own model family | Use a different judge model or human calibration |
| Leniency / sycophancy | Passes plausible-sounding answers | Binary criteria, require citing evidence |
| Format sensitivity | Swayed by Markdown polish | Normalize formatting before judging |

```python
def pairwise(llm, question, a, b) -> str:
    first = llm.compare(question, a, b)      # returns "A" | "B" | "tie"
    second = llm.compare(question, b, a)     # swapped
    second = {"A": "B", "B": "A"}.get(second, second)
    return first if first == second else "tie"
```

## Calibrating against humans

A judge is a model; it needs its own eval.

1. Have humans (ideally domain experts) label 100–200 outputs on the same criterion.
2. Run the judge on the same outputs.
3. Measure agreement: accuracy, precision/recall on "fail", or Cohen's kappa.
4. Inspect disagreements, refine the rubric, repeat.
5. Re-calibrate when you change the judge model or the product changes.

Pay special attention to **recall on failures** — a judge that passes everything looks great on average and catches nothing.

## Using judges in production

Beyond offline evals, judges can score a sample of live traffic for monitoring (faithfulness rate this week) and serve as online guardrails. For guardrails, latency and cost matter: use smaller tuned classifiers or cheaper models, and reserve strong judges for offline work.

## Common mistakes

- Trusting judge scores without ever checking them against human labels.
- 1–10 scales with no anchors, producing noisy averages.
- Asking one prompt to judge five criteria at once.
- Running pairwise comparisons in one order only.
- Letting the judge see which version is "new".

## In the interview

**Q: How do you know your LLM judge is reliable?**
Calibrate it: compare its verdicts to human labels on a sample, measure agreement and failure-recall, analyze disagreements, refine the rubric, and recheck when the judge model changes.

**Q: What biases do LLM judges have?**
Position bias, verbosity bias, self-preference, and leniency. Mitigate with order swapping, explicit rubrics, binary criteria, different judge models, and human calibration.

**Q: Pointwise or pairwise?**
Pairwise is more sensitive for comparing two versions; pointwise with a binary rubric is better for absolute thresholds and monitoring.

## Key takeaways

- LLM judges scale qualitative evaluation, but must be validated like any model.
- One criterion per call, binary verdicts, reasoning before verdict.
- Watch for position, verbosity, and self-preference biases.
- Calibrate against human labels and track failure recall.
