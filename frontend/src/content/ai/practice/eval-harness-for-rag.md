Build the evaluation system that tells you — with numbers — whether a change to your RAG app made it better or worse, and blocks the merge when it got worse. This is the project that most clearly separates "built a demo" from "ran an AI system in production".

## What you'll build

A reusable eval harness (a Python package + CLI) that plugs into an existing RAG app (for example, the RAG-over-PDFs project) and:

- Loads a versioned golden dataset of questions with relevant documents, reference answers, and tags.
- Runs the RAG pipeline with concurrency, capturing retrieved IDs, answers, citations, tokens, and latency.
- Scores **retrieval** (recall@k, MRR), **generation** (faithfulness, answer relevance, correctness, citation validity), and **behavior** (refusal correctness).
- Uses calibrated LLM judges for qualitative criteria, with an agreement report against human labels.
- Compares runs against a baseline, with per-tag breakdowns and a diff of regressed cases.
- Runs in CI and fails the build on regressions beyond tolerance.

## Architecture

```text
 golden/ (versioned JSONL)          config.yaml (pipeline version, judges, thresholds)
        │                                   │
        ▼                                   ▼
 ┌──────────────┐   per case    ┌──────────────────────┐
 │ runner       │ ────────────► │ RAG app adapter      │ → {retrieved_ids, answer, claims, usage}
 │ (async, N=8) │               └──────────────────────┘
 └──────┬───────┘
        ▼
 ┌──────────────────────────── scorers ─────────────────────────────┐
 │ retrieval: recall@k, MRR    │ programmatic: citation quote check  │
 │ judges: faithfulness, relevance, correctness (binary, cached)     │
 │ behavior: refusal on unanswerable                                  │
 └──────────────────────────────┬────────────────────────────────────┘
                                ▼
 results/run_<id>.jsonl ─► report (overall + per-tag) ─► compare(baseline) ─► CI exit code
                                                          └► regressions.md (case diffs)
```

## Milestones

1. **Golden dataset.** 60–100 cases: real-style questions, relevant doc/page labels (not chunk IDs), short reference answers, tags (topic, difficulty, multi-hop, unanswerable).
   *Acceptance:* schema-validated JSONL; at least 10% unanswerable; a held-out split you won't tune against.

2. **Runner + retrieval metrics.** Async runner with an adapter interface; compute recall@{1,5,10} and MRR.
   *Acceptance:* a full run is reproducible; metrics match a hand-checked sample of 5 cases.

3. **Programmatic checks.** Citation validity (quotes present in cited chunks), schema validity, latency, token cost.
   *Acceptance:* report includes citation-validity rate and p50/p95 latency and cost per question.

4. **LLM judges.** Separate binary judges for faithfulness, answer relevance, and correctness; reasoning before verdict; responses cached by (judge version, input hash).
   *Acceptance:* re-running without changes costs nothing for cached judgments.

5. **Calibration.** Label ~50 outputs by hand per criterion; compute agreement and recall on failures; refine rubrics.
   *Acceptance:* calibration report showing agreement before and after rubric changes; judge failure-recall above an agreed bar.

6. **Baselines and CI.** `eval run`, `eval compare --baseline main`, per-tag tables, regression list; GitHub Actions job on PRs touching prompts/retrieval.
   *Acceptance:* a deliberately degraded prompt fails CI with a readable summary of what regressed.

## Key code

```python
import asyncio, hashlib, json, statistics
from dataclasses import dataclass, field

@dataclass
class Case:
    id: str
    question: str
    relevant: set[str]                 # "doc_id#page" keys
    reference: str | None
    answerable: bool
    tags: list[str] = field(default_factory=list)

async def run_case(app, judges, case: Case, sem: asyncio.Semaphore) -> dict:
    async with sem:
        out = await app.answer(case.question)            # adapter: answer, retrieved, claims, usage
    got = [f"{r.doc_id}#{r.page}" for r in out.retrieved]
    row = {"id": case.id, "tags": case.tags,
           "recall@5": len(set(got[:5]) & case.relevant) / len(case.relevant) if case.relevant else None,
           "mrr": next((1 / (i + 1) for i, g in enumerate(got) if g in case.relevant), 0.0),
           "citation_valid": out.citation_valid_rate, "latency_ms": out.latency_ms,
           "cost_usd": out.cost_usd}
    if not case.answerable:
        row["refusal_correct"] = float(out.refused)
    elif not out.refused:
        ctx = "\n\n".join(r.text for r in out.retrieved[:6])
        row["faithful"] = await judges.faithfulness(case.question, ctx, out.text)
        row["relevant"] = await judges.relevance(case.question, out.text)
        if case.reference:
            row["correct"] = await judges.correctness(case.question, case.reference, out.text)
    return row

def summarize(rows: list[dict]) -> dict:
    keys = {k for r in rows for k, v in r.items() if isinstance(v, (int, float))}
    return {k: round(statistics.mean(r[k] for r in rows if r.get(k) is not None), 4) for k in keys}

def compare(current: dict, baseline: dict, tolerance: dict[str, float]) -> list[str]:
    failures = []
    for metric, tol in tolerance.items():
        if metric in baseline and current.get(metric, 0) < baseline[metric] - tol:
            failures.append(f"{metric}: {baseline[metric]:.3f} -> {current.get(metric, 0):.3f}")
    return failures

async def main(app, judges, cases, baseline_path, tolerance):
    sem = asyncio.Semaphore(8)
    rows = await asyncio.gather(*(run_case(app, judges, c, sem) for c in cases))
    report = summarize(rows)
    baseline = json.load(open(baseline_path))
    failures = compare(report, baseline, tolerance)
    print(json.dumps(report, indent=2))
    if failures:
        print("REGRESSIONS:\n  " + "\n  ".join(failures))
        raise SystemExit(1)

def judge_cache_key(judge_version: str, *parts: str) -> str:
    return hashlib.sha256("|".join([judge_version, *parts]).encode()).hexdigest()
```

## Stretch goals

- Per-tag regression gates (no tag may drop more than X).
- Multiple samples per case to estimate variance and use significance tests.
- Synthetic question generation to grow coverage, flagged separately from real questions.
- A small dashboard showing metric trends across commits.
- Pull production traces with negative feedback into a review queue that feeds the golden set.

## What to say about it in interviews

- **Component metrics**: you separated retrieval from generation and can show how a chunking change moved recall while a prompt change moved faithfulness.
- **Judges are models too**: your calibration process, agreement numbers, and the rubric changes that improved failure recall.
- **CI as a quality gate**: tolerance-based comparisons against a baseline, per-tag breakdowns, and readable regression reports.
- **Cost control**: judge caching, concurrency limits, and running a fast subset on PRs with the full set nightly.
- **Dataset discipline**: real-question sourcing, unanswerable cases, held-out split, and versioning.
