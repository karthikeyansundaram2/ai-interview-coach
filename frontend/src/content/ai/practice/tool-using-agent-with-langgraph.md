Build an agent in LangGraph that uses real tools to get work done, remembers conversations across restarts, and pauses for your approval before doing anything risky. You'll come away able to explain state graphs, checkpoints, and human-in-the-loop from experience.

## What you'll build

A "personal ops assistant" for a developer, exposed via CLI or a small web UI, with tools such as:

- `search_github_issues(repo, query, state)` — read-only.
- `get_ci_status(repo, branch)` — read-only.
- `query_db(sql)` — read-only SQL against a sample Postgres/SQLite database (SELECT only).
- `create_issue(repo, title, body, labels)` — **side effect, needs approval**.
- `send_slack_message(channel, text)` — **side effect, needs approval** (or a mock webhook).

The agent plans, calls tools, recovers from tool errors, and pauses for approval before side effects. State is checkpointed so conversations resume by thread ID, even after a restart.

## Architecture

```text
            ┌────────────┐
 START ───► │  agent     │ ─── no tool calls ───────────────────► END
            └─────┬──────┘
                  │ tool calls
                  ▼
            ┌────────────┐   all read-only   ┌───────────┐
            │  router    │ ─────────────────►│ run_tools │──┐
            └─────┬──────┘                   └───────────┘  │
                  │ any side-effecting call                  │
                  ▼                                          │
            ┌────────────┐  approve/edit ─► run_tools ───────┤
            │  approval  │  reject ─► tool message "rejected"│
            │ (interrupt)│ ──────────────────────────────────┤
            └────────────┘                                   ▼
                                                     back to agent
 Checkpointer (SQLite/Postgres) saves state after every node, keyed by thread_id.
 State: messages, step_count, pending_approval
```

## Milestones

1. **Tools with schemas.** Implement tools with typed arguments, docstrings, concise outputs, and errors returned as data.
   *Acceptance:* unit tests for each tool; `query_db` rejects non-SELECT statements; outputs are truncated to a sane size.

2. **Basic agent graph.** Agent node + tool node + conditional edge; step cap in state.
   *Acceptance:* "Which open issues mention 'timeout' in repo X, and is CI green on main?" triggers two parallel tool calls and a correct summary; a forced loop stops at the step cap with a helpful message.

3. **Persistence.** Compile with a durable checkpointer; thread IDs per conversation.
   *Acceptance:* ask a question, kill the process, restart, and a follow-up on the same thread uses prior context.

4. **Human-in-the-loop.** Interrupt before side-effecting tools; UI shows exact arguments; approve, edit, or reject.
   *Acceptance:* `create_issue` never runs without approval; edited arguments are what actually execute; rejection results in the agent acknowledging and adapting.

5. **Observability.** Trace each node and tool call with timings and token usage.
   *Acceptance:* for any thread you can list steps, tools called, approvals, and total tokens.

6. **Evaluation.** 20 scripted tasks with sandboxed tool fixtures; score task success, tool-selection accuracy, and steps taken.
   *Acceptance:* a report table; at least one improvement (prompt or tool description change) shown to move a metric.

## Key code

```python
from typing import Annotated, TypedDict
from langchain_core.messages import AnyMessage, ToolMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.types import interrupt
from langgraph.checkpoint.sqlite import SqliteSaver   # separate package; Postgres saver for prod

SIDE_EFFECTS = {"create_issue", "send_slack_message"}
MAX_STEPS = 10

class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    steps: int

tools = [search_github_issues, get_ci_status, query_db, create_issue, send_slack_message]
llm = make_chat_model().bind_tools(tools)
tool_node = ToolNode(tools, handle_tool_errors=True)

def agent(state: State):
    return {"messages": [llm.invoke(state["messages"])], "steps": state["steps"] + 1}

def route(state: State):
    last = state["messages"][-1]
    if not getattr(last, "tool_calls", None) or state["steps"] >= MAX_STEPS:
        return END
    if any(tc["name"] in SIDE_EFFECTS for tc in last.tool_calls):
        return "approval"
    return "tools"

def approval(state: State):
    last = state["messages"][-1]
    decision = interrupt({"tool_calls": last.tool_calls})       # pause for a human
    if decision["action"] == "approve":
        return {}                                                 # continue to tools
    if decision["action"] == "edit":
        edited = last.model_copy(update={"tool_calls": decision["tool_calls"]})
        return {"messages": [edited]}                             # same id -> replaces message
    return {"messages": [ToolMessage(content=f"User rejected: {decision.get('reason', '')}",
                                     tool_call_id=tc["id"]) for tc in last.tool_calls]}

def after_approval(state: State):
    return "agent" if isinstance(state["messages"][-1], ToolMessage) else "tools"

g = StateGraph(State)
g.add_node("agent", agent)
g.add_node("tools", tool_node)
g.add_node("approval", approval)
g.add_edge(START, "agent")
g.add_conditional_edges("agent", route, ["tools", "approval", END])
g.add_conditional_edges("approval", after_approval, ["tools", "agent"])
g.add_edge("tools", "agent")

# with SqliteSaver.from_conn_string("agent.db") as saver:
#     graph = g.compile(checkpointer=saver)
#     cfg = {"configurable": {"thread_id": "karthi-ops-1"}}
#     graph.invoke({"messages": [("user", "File an issue for the flaky test")], "steps": 0}, cfg)
#     ... show __interrupt__ payload, then graph.invoke(Command(resume={...}), cfg)
```

## Stretch goals

- Plan-and-execute variant: a planner node produces steps; show the plan for approval up front.
- Long-term memory store across threads (preferred repos, channels).
- Stream node updates and tokens to a web UI.
- Time travel: let the user rewind to an earlier checkpoint and branch.
- Replace in-process tools with MCP servers.

## What to say about it in interviews

- **Why LangGraph over a while-loop**: explicit control flow, checkpointing, interrupts, streaming, and testability of individual nodes.
- **Safety design**: side-effect classification, approval with editable arguments, read-only SQL enforcement, and step caps.
- **Gotchas you hit**: interrupted nodes re-running on resume (so side effects live after the interrupt), and keeping tool calls paired with tool results.
- **Evaluation**: sandboxed fixtures, trajectory metrics (tool choice, step count), not just final answers.
- **Production path**: Postgres checkpointer, per-user thread authorization, tracing, and per-thread cost limits.
