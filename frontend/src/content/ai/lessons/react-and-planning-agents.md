An agent is an LLM in a loop that chooses its own next action — which tool to call, what to look at, when it's done — based on what it has observed so far. ReAct and plan-and-execute are the two foundational patterns for structuring that loop.

## The analogy

A detective doesn't follow a fixed script. They form a hypothesis, check one clue, update their thinking, check another, and stop when the case is solved (ReAct). A wedding planner works differently: they draw up the full checklist first, then execute item by item, revising the plan only when something falls through (plan-and-execute).

## What makes something an "agent"

A useful spectrum:

```text
 single LLM call ──► fixed chain (workflow) ──► router ──► tool loop ──► autonomous agent
 most predictable                                                    most flexible
```

**Workflows** have code-defined steps; **agents** let the model decide the steps. Prefer the simplest thing that works. Many production "agents" are mostly workflows with one or two model-driven decisions — easier to test, cheaper, more reliable.

## ReAct: reason, act, observe

The model interleaves reasoning with tool calls:

```text
 Thought: The user wants last month's failed payments for Acme. I need the customer id.
 Action: search_customers(name="Acme")
 Observation: [{"id": "C-881", "name": "Acme Pvt Ltd"}]
 Thought: Now query payments for C-881 in September.
 Action: list_payments(customer_id="C-881", status="failed", month="2026-09")
 Observation: 3 payments ...
 Thought: I have what I need.
 Final answer: Acme had 3 failed payments in September ...
```

With native tool calling, the "Action" is a structured tool call and the "Observation" is the tool result message; the reasoning may happen in visible text or in the model's internal thinking.

Strengths: adapts to surprises, simple to implement. Weaknesses: greedy step-by-step decisions, can wander or loop, cost grows with steps.

## Plan-and-execute

```python
from pydantic import BaseModel

class Plan(BaseModel):
    steps: list[str]

def plan_and_execute(llm, executor, task, max_replans=2):
    plan = llm.structured(Plan, f"Break this task into 3-7 concrete steps:\n{task}")
    done: list[tuple[str, str]] = []
    for _ in range(max_replans + 1):
        for step in plan.steps[len(done):]:
            result = executor.run(step, context=done)      # a ReAct sub-agent with tools
            done.append((step, result))
            if result.startswith("FAILED"):
                break
        else:
            return llm.generate(f"Task: {task}\nResults: {done}\nWrite the final answer.")
        plan = llm.structured(Plan, f"Task: {task}\nDone so far: {done}\n"
                                    "The last step failed. Produce a revised full plan.")
    return "Could not complete the task; partial results: " + str(done)
```

Strengths: coherent long tasks, cheaper models can execute steps, the plan is inspectable (and can be shown to a user for approval). Weaknesses: plans go stale when early results surprise you, so you need replanning.

## Other patterns worth naming

- **Reflection / self-critique**: generate, critique against criteria, revise. Good for writing and code (with tests as the critic).
- **Evaluator–optimizer**: one model generates, another scores, loop until a threshold.
- **Orchestrator–workers**: a planner fans out sub-tasks to parallel workers and synthesizes (bridges into multi-agent systems).

## Keeping agents from spinning

| Problem | Guardrail |
|---|---|
| Infinite loops | Max steps, max tokens, wall-clock timeout |
| Repeating a failing call | Detect duplicate calls; inject "this already failed" |
| Cost blowups | Per-task budget; cheaper model for sub-steps |
| Wrong irreversible actions | Human approval gates on side effects |
| Lost context in long runs | Summarize observations; keep a scratchpad of key facts |
| Silent failure | Explicit "give up" path with partial results |

## Evaluating agents

Score both the outcome (did it accomplish the task?) and the trajectory (right tools, reasonable number of steps, no unsafe actions). Use sandboxed tools with deterministic fixtures so runs are reproducible.

## Common mistakes

- Building a fully autonomous agent for a task a three-step workflow would handle.
- No step or budget limits.
- Giving agents broad write permissions with no approval gate.
- Evaluating only the final answer and missing that it took 25 tool calls to get there.

## In the interview

**Q: Explain ReAct.**
The model alternates reasoning and actions: think about what's needed, call a tool, observe the result, and repeat until it can answer. It grounds reasoning in real observations and adapts as it goes.

**Q: When would you choose plan-and-execute over ReAct?**
For longer multi-step tasks where coherence matters, where a plan can be reviewed, or where you want a strong model to plan and cheaper models to execute. Add replanning for when steps fail.

**Q: Workflow or agent?**
Use a workflow when the steps are known; it's cheaper, faster, and testable. Use an agent when the path genuinely depends on intermediate results and can't be enumerated ahead of time.

## Key takeaways

- Agents are LLMs choosing actions in a loop; workflows are code-defined paths.
- ReAct: think → act → observe; adaptive but greedy.
- Plan-and-execute: plan up front, execute, replan on failure.
- Always cap steps, budget cost, gate side effects, and evaluate trajectories.
