Build a research assistant where a supervisor agent breaks a question into sub-questions, dispatches parallel worker agents to search and read sources, and synthesizes a cited report. It's the clearest real-world case where multiple agents beat one.

## What you'll build

A service (CLI or web) that takes a research question — "How are Indian fintechs approaching UPI credit lines, and what are the regulatory risks?" — and produces a structured Markdown report with:

- An executive summary, sections per sub-topic, and a "contradictions and open questions" section.
- Inline citations linking to the sources actually read.
- A run log: sub-questions, which worker handled each, sources fetched, tokens and cost.

Under the hood: a LangGraph supervisor that plans, fans out workers in parallel with `Send`, collects findings via a reducer, optionally runs a follow-up round for gaps, and hands off to a writer and a reviewer.

## Architecture

```text
 question
    │
    ▼
 ┌──────────┐  plan: 3–6 sub-questions (structured)
 │ planner  │──────────────────────────────────────┐
 └──────────┘                                      │ Send(worker, sub_q) × N  (parallel)
                                                   ▼
                       ┌──────────┐ ┌──────────┐ ┌──────────┐
                       │ worker 1 │ │ worker 2 │ │ worker N │   each: search → fetch → read → notes
                       └────┬─────┘ └────┬─────┘ └────┬─────┘   budget: steps, tokens, time
                            └────────────┼────────────┘
                                         ▼  findings (reducer: list append)
                                  ┌──────────────┐
                                  │ gap check    │── gaps & budget left? ──► another round
                                  └──────┬───────┘
                                         ▼
                                  ┌──────────────┐     ┌──────────────┐
                                  │ writer       │ ──► │ reviewer     │ ── issues ──► writer (max 2)
                                  └──────────────┘     └──────┬───────┘
                                                              ▼
                                                    report.md + run_log.json
```

## Milestones

1. **Single research worker.** A ReAct agent with `web_search`, `fetch_page` (cleaned text, truncated), and `take_note(claim, url, quote)`.
   *Acceptance:* for a focused sub-question it returns 3–8 notes, each with a URL and supporting quote; it stops within its step budget.

2. **Planner + fan-out.** Planner produces 3–6 independent sub-questions with expected output format; workers run in parallel via `Send`; findings merge via a reducer.
   *Acceptance:* wall-clock time with 4 workers is substantially lower than running them sequentially; no findings are lost or overwritten.

3. **Writer with citations.** Writer composes the report only from notes, citing note IDs that map to URLs.
   *Acceptance:* every factual sentence has a citation; programmatic check confirms each cited note exists and its quote appears in the fetched page.

4. **Reviewer loop.** A reviewer checks coverage of the original question, unsupported claims, and contradictions; writer revises at most twice.
   *Acceptance:* on a test question with conflicting sources, the report surfaces the contradiction explicitly.

5. **Budgets and resilience.** Per-worker step/token/time limits, overall cost cap, worker failures captured as data.
   *Acceptance:* killing one worker's network access still yields a report that notes the missing sub-topic.

6. **Evaluation.** 10 research questions with expert-written key points; judge coverage of key points, citation validity, and factual accuracy; compare against a single-agent baseline.
   *Acceptance:* a comparison table of quality, cost, and latency — honest about where multi-agent did and didn't help.

## Key code

```python
import operator
from typing import Annotated, TypedDict
from pydantic import BaseModel
from langgraph.graph import StateGraph, START, END
from langgraph.types import Send

class SubQuestion(BaseModel):
    id: str
    question: str
    why_it_matters: str

class Plan(BaseModel):
    sub_questions: list[SubQuestion]

class Note(BaseModel):
    id: str
    claim: str
    url: str
    quote: str
    sub_question_id: str

class ResearchState(TypedDict):
    question: str
    plan: list[SubQuestion]
    notes: Annotated[list[Note], operator.add]        # parallel workers append safely
    failures: Annotated[list[str], operator.add]
    rounds: int
    report: str

class WorkerInput(TypedDict):
    sub: SubQuestion

def planner(state: ResearchState):
    plan = planner_llm.with_structured_output(Plan).invoke(
        "Break this research question into 3-6 independent, specific sub-questions. "
        f"Avoid overlap.\n\nQuestion: {state['question']}")
    return {"plan": plan.sub_questions, "rounds": state.get("rounds", 0) + 1}

def fan_out(state: ResearchState):
    return [Send("worker", {"sub": s}) for s in state["plan"]]

def worker(inp: WorkerInput):
    try:
        notes = run_research_agent(inp["sub"], max_steps=8, max_tokens=40_000, timeout_s=120)
        return {"notes": notes}
    except Exception as e:
        return {"failures": [f"{inp['sub'].id}: {e}"]}

def gap_check(state: ResearchState):
    covered = {n.sub_question_id for n in state["notes"]}
    missing = [s for s in state["plan"] if s.id not in covered]
    if missing and state["rounds"] < 2 and within_budget(state):
        return [Send("worker", {"sub": s}) for s in missing]
    return "writer"

def writer(state: ResearchState):
    notes = "\n".join(f"[{n.id}] {n.claim} (quote: \"{n.quote}\")" for n in state["notes"])
    report = writer_llm.invoke(
        f"Question: {state['question']}\nNotes:\n{notes}\nFailed areas: {state['failures']}\n"
        "Write a report using only these notes; cite note ids like [n3]; "
        "include a 'Contradictions and open questions' section.").content
    return {"report": report}

g = StateGraph(ResearchState)
g.add_node("planner", planner)
g.add_node("worker", worker)
g.add_node("collect", lambda s: {})
g.add_node("writer", writer)
g.add_edge(START, "planner")
g.add_conditional_edges("planner", fan_out, ["worker"])
g.add_edge("worker", "collect")
g.add_conditional_edges("collect", gap_check, ["worker", "writer"])
g.add_edge("writer", END)          # add reviewer node + loop as a milestone
graph = g.compile()
```

## Stretch goals

- Source quality scoring (domain reputation, recency) that workers use to prioritize.
- Deduplicate notes across workers with embeddings before writing.
- Stream progress to a UI: plan, worker status, notes as they arrive.
- Human checkpoint after planning so users can edit sub-questions.
- Cache fetched pages and search results across runs.

## What to say about it in interviews

- **Why multi-agent here**: breadth-first research decomposes into independent sub-questions; workers get isolated contexts full of raw pages while the supervisor sees only compact notes.
- **Coordination contracts**: structured sub-questions in, structured notes out, reducers for safe parallel merges.
- **Cost and failure handling**: per-worker budgets, failures as data, a gap-filling round, and an overall cost cap.
- **Evidence over vibes**: your comparison against a single-agent baseline — quality, cost, latency — including where multi-agent wasn't worth it.
- **Trust**: citation verification against fetched content, and surfacing contradictions instead of smoothing them over.
