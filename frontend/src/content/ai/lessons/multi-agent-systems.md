A multi-agent system splits work across several LLM-driven agents, each with its own prompt, tools, and focus, coordinated by some protocol. Done well, it tames complexity and enables parallelism; done badly, it multiplies cost and failure modes.

## The analogy

A newsroom. An editor assigns stories; reporters research in parallel; a fact-checker verifies; a copy editor polishes. Nobody does everything, and each role has its own tools and checklist. But a newsroom also has overhead — meetings, handoffs, miscommunication. Multi-agent systems inherit both the benefits and the overhead.

## Why split at all?

- **Context isolation**: each agent sees only what it needs. A research worker can burn through 100k tokens of web pages and return a 500-token summary, keeping the coordinator's context clean.
- **Specialization**: focused prompts and small tool sets per agent improve tool selection and accuracy.
- **Parallelism**: independent sub-tasks run concurrently, reducing wall-clock time.
- **Separation of duties**: a reviewer agent with no write tools can check a writer agent's work.

## Common topologies

```text
 Supervisor / orchestrator-workers        Handoff (swarm)              Pipeline
        ┌──────────┐                     triage ──► billing          research ──► draft ──► review
        │supervisor│                        │   ◄──                      (fixed order)
        └──┬──┬──┬─┘                        └──► tech_support
           │  │  │                        (agents transfer control)
        w1 w2 w3  (parallel)
```

| Pattern | How it works | Good for |
|---|---|---|
| Supervisor | A coordinator delegates sub-tasks to workers, gathers results, decides next steps | Research, complex analysis |
| Handoff | Agents pass the conversation to a better-suited agent | Customer support routing |
| Pipeline | Fixed sequence of specialized agents | Content generation, ETL-like tasks |
| Debate / critique | Agents propose and critique, a judge decides | Hard reasoning, reviews |

## A supervisor with parallel workers

```python
import asyncio
from pydantic import BaseModel

class SubTask(BaseModel):
    id: str
    instruction: str
    tools: list[str]

class Delegation(BaseModel):
    subtasks: list[SubTask]

async def research(llm, question: str, make_worker, max_workers=4) -> str:
    plan = await llm.astructured(
        Delegation,
        f"Split this research question into at most {max_workers} independent sub-tasks. "
        f"Each must be answerable on its own.\n\nQuestion: {question}",
    )
    async def run(sub: SubTask):
        worker = make_worker(tools=sub.tools, budget_tokens=40_000, max_steps=8)
        try:
            return sub.id, await asyncio.wait_for(worker.arun(sub.instruction), timeout=120)
        except Exception as e:
            return sub.id, f"FAILED: {e}"
    results = await asyncio.gather(*(run(s) for s in plan.subtasks))
    findings = "\n\n".join(f"[{sid}]\n{text}" for sid, text in results)
    return await llm.agenerate(
        f"Question: {question}\n\nWorker findings:\n{findings}\n\n"
        "Synthesize a cited answer. Note any failed sub-tasks or contradictions."
    )
```

Note the essentials: explicit, self-contained instructions for each worker; per-worker budgets and timeouts; failures returned as data; a synthesis step that acknowledges gaps.

## The costs

- **Tokens**: each agent re-reads its own context; multi-agent runs often cost several times a single agent.
- **Coordination errors**: vague delegation produces duplicated or misaligned work. Workers can't ask the supervisor what it meant unless you build that path.
- **Compounding failures**: five agents at 95% reliability each don't make a 95% system.
- **Debuggability**: you need tracing across agents to see who did what.

## When multi-agent is worth it

Good fits: breadth-heavy tasks with independent parts (research across many sources), tasks needing very different tool sets, and workflows that benefit from independent review. Poor fits: tightly coupled tasks where every step depends on shared, evolving context — like most coding edits — where one capable agent with good tools often wins.

## Communication design

- Define the **handoff contract**: what the worker receives (goal, constraints, output format) and returns (findings, sources, confidence).
- Share **state** through a structured object (as in a LangGraph state), not by forwarding entire transcripts.
- Keep the coordinator responsible for the final answer and for noticing contradictions.

## Common mistakes

- Reaching for multi-agent because it sounds advanced, when a single agent with better tools would do.
- Under-specified delegations ("research the market") that produce overlapping work.
- No per-agent limits, so one worker consumes the whole budget.
- Passing full transcripts between agents, defeating context isolation.

## In the interview

**Q: When would you use a multi-agent architecture?**
When the task decomposes into independent sub-tasks that benefit from parallelism, separate contexts, or different tool sets — e.g. broad research — or when you need independent verification. Otherwise a single agent is cheaper and easier to debug.

**Q: Supervisor vs handoff patterns?**
A supervisor keeps control, delegates, and synthesizes — good for decomposable tasks. Handoff transfers the conversation to a specialist agent — good for routing users to the right domain expert.

**Q: What are the main risks?**
Higher token cost, coordination failures from vague delegation, compounding errors, and harder debugging. Mitigate with clear contracts, budgets, tracing, and evals on full trajectories.

## Key takeaways

- Multi-agent buys context isolation, specialization, and parallelism.
- Supervisor, handoff, and pipeline are the core topologies.
- Write explicit delegation contracts; cap each agent's budget.
- It costs more and fails in new ways — use it when decomposition is real.
