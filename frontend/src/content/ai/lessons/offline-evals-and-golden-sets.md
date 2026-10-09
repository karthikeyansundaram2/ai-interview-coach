You can't improve what you don't measure, and with LLMs "it looked fine when I tried it" is how regressions ship. Offline evals turn prompt and pipeline changes into measurable experiments, the same way unit tests turned refactoring from scary into routine.

## The analogy

A restaurant changing a recipe doesn't serve it to every customer and hope. The chef cooks the new version and a panel tastes it next to the old one, scoring it against the house standards. The panel's tasting menu — the same dishes every time — is the golden set. Only when the new version wins does it go on the menu.

## The eval loop

```text
 golden set (inputs + expectations)
        │
        ▼
 run pipeline version X ──► outputs ──► graders ──► scores per example
        │                                            │
        └────────────── compare to baseline ◄────────┘
                               │
                  pass thresholds? ──► merge / ship
                  regressions?     ──► inspect failures, iterate
```

## Building a golden set

A golden set is a curated collection of inputs with what "good" looks like.

- **Sources**: real (anonymized) production queries, support tickets, domain-expert-written cases, and adversarial cases.
- **Coverage**: tag examples by category (intent, difficulty, language, edge case) so you can see *where* quality moves.
- **Expectations** vary by task: an exact label, required facts, a reference answer, relevant document IDs, or a rubric.
- **Size**: start with 50–100 well-chosen examples; grow toward hundreds as failures are found. Every production bug becomes a new test case.
- **Hygiene**: version the dataset, keep a held-out slice you don't tune against, and refresh as the product changes.

## Choosing graders

| Grader | Good for | Caveat |
|---|---|---|
| Exact / regex match | Classification, extraction fields | Brittle for free text |
| Programmatic checks | JSON validity, schema, length, required keywords, SQL runs | Only checks what you encode |
| Reference similarity | Short answers vs reference | Embedding/overlap scores correlate weakly with quality |
| LLM-as-judge | Helpfulness, faithfulness, rubric criteria | Needs calibration (next lesson) |
| Human review | Ground truth, ambiguous cases | Slow and costly — use for calibration and spot checks |

Prefer the cheapest grader that's reliable for each criterion, and combine several.

## A minimal harness

```python
import json, statistics
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor

@dataclass
class Case:
    id: str
    input: str
    expected: dict          # e.g. {"label": "billing"} or {"must_include": ["30 days"]}
    tags: list[str]

def grade(case: Case, output: str) -> dict:
    scores = {}
    if "label" in case.expected:
        scores["label_correct"] = float(output.strip().lower() == case.expected["label"])
    if "must_include" in case.expected:
        hits = [s.lower() in output.lower() for s in case.expected["must_include"]]
        scores["facts_recall"] = sum(hits) / len(hits)
    return scores

def run_eval(pipeline, cases: list[Case], workers=8) -> dict:
    with ThreadPoolExecutor(workers) as ex:
        outputs = list(ex.map(lambda c: pipeline(c.input), cases))
    rows = [{"id": c.id, "tags": c.tags, "output": o, **grade(c, o)} for c, o in zip(cases, outputs)]
    metrics = {k: statistics.mean(r[k] for r in rows if k in r)
               for k in {k for r in rows for k in r} - {"id", "tags", "output"}}
    json.dump(rows, open("eval_rows.json", "w"), indent=2)     # keep for diffing failures
    return metrics

# CI gate
# baseline = {"label_correct": 0.91, "facts_recall": 0.84}
# assert all(metrics[k] >= baseline[k] - 0.02 for k in baseline), "quality regression"
```

## Evals in CI

- Run a fast subset on every PR that touches prompts, models, retrieval, or tools; run the full suite nightly or before release.
- Compare against the **current production baseline**, not an absolute number.
- Allow a small tolerance for noise; for non-deterministic outputs, run multiple samples on key cases.
- Report per-tag metrics — an overall average can hide a collapse in one category.
- Track cost and latency alongside quality; a 1-point gain that doubles cost may not be worth it.

## Offline vs online

Offline evals catch regressions before shipping. Online signals — thumbs up/down, escalation rate, task completion, A/B tests — tell you whether real users are better off. You need both, and online failures should feed back into the golden set.

## Common mistakes

- Tuning prompts against the whole eval set until it passes (overfitting) — keep a held-out slice.
- Only happy-path examples; no adversarial, ambiguous, or out-of-scope cases.
- One aggregate score with no breakdown.
- Eval sets that drift out of date with the product.
- Upgrading the model version without re-running evals.

## In the interview

**Q: How do you evaluate an LLM feature before launch?**
Build a golden set from realistic and adversarial inputs, define criteria per task, combine programmatic checks with calibrated LLM judges and some human review, measure against a baseline, and gate releases in CI.

**Q: How big should an eval set be?**
Big enough to detect the differences you care about. Start with ~100 diverse, tagged cases; grow with production failures. Smaller sets are fine for catching big regressions, not subtle ones.

**Q: How do you handle non-determinism in evals?**
Use low temperature where appropriate, sample key cases several times, compare distributions rather than single runs, and allow small tolerances in gates.

## Key takeaways

- Golden sets + graders + baselines = evals; treat them like tests.
- Use the cheapest reliable grader per criterion; combine several.
- Tag cases and report per-slice metrics; keep a held-out slice.
- Gate changes in CI; feed production failures back into the set.
