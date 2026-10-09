Real agents need to pause, survive restarts, and wait for a person to say "yes, send it". LangGraph's checkpointers save graph state after every step, which unlocks multi-turn memory, crash recovery, human approval, and even rewinding to an earlier step.

## The analogy

A video game with save points. Every time you clear a room, the game saves. If the power goes out, you resume from the last save. Before a boss fight, the game can pause and ask "are you sure?". And you can reload an older save to try a different path. Checkpoints are save points for your agent.

## Threads and checkpoints

When you compile a graph with a **checkpointer**, LangGraph writes a snapshot of the state after each step (a "super-step"). Snapshots are grouped by a **thread ID** you pass in config — typically one per conversation or job.

```text
 thread "user-42-conv-7":
   ckpt 0: {messages: [user]}                         ← input
   ckpt 1: {messages: [user, ai(tool_call)]}          ← after agent
   ckpt 2: {messages: [..., tool_result]}             ← after tools
   ckpt 3: {messages: [..., ai(final)]}               ← after agent
```

Invoke again with the same thread ID and the graph continues from the latest checkpoint — that's multi-turn memory with no extra code.

```python
from langgraph.checkpoint.memory import InMemorySaver
# production: a durable saver, e.g. the Postgres checkpointer package

graph = builder.compile(checkpointer=InMemorySaver())
cfg = {"configurable": {"thread_id": "user-42-conv-7"}}

graph.invoke({"messages": [("user", "Book a table for 4 tomorrow 8pm")]}, cfg)
graph.invoke({"messages": [("user", "Actually make it 7pm")]}, cfg)   # remembers context

snapshot = graph.get_state(cfg)
print(snapshot.values["messages"][-1].content, snapshot.next)
```

Use an in-memory saver for tests; use a durable store (Postgres, Redis, SQLite for local) in production so state survives deploys and can be shared across workers.

## Human-in-the-loop with interrupts

The `interrupt()` function pauses execution inside a node and surfaces a payload to the caller. The run stops, the checkpoint is saved, and you resume later — seconds or days — with `Command(resume=...)`.

```python
from langgraph.types import interrupt, Command

def send_email_node(state):
    draft = state["draft"]
    decision = interrupt({                       # pauses here
        "action": "send_email",
        "to": draft["to"],
        "subject": draft["subject"],
        "body": draft["body"],
    })
    if decision["approved"]:
        body = decision.get("edited_body", draft["body"])
        email_client.send(draft["to"], draft["subject"], body)
        return {"status": "sent"}
    return {"status": "rejected", "feedback": decision.get("reason", "")}

# 1) run until the interrupt
result = graph.invoke({"request": "Email the vendor about the late shipment"}, cfg)
pending = result["__interrupt__"]              # show this to a human in your UI

# 2) later, when the human clicks Approve (possibly after editing)
graph.invoke(Command(resume={"approved": True, "edited_body": "Hi team, ..."}), cfg)
```

Important detail: when resumed, the interrupted node **re-runs from its start**, with `interrupt()` now returning the resume value. So keep side effects *after* the interrupt, or make earlier code idempotent.

Common HITL patterns:

| Pattern | Use |
|---|---|
| Approve / reject | Before irreversible actions (payments, emails, deletes) |
| Edit | Human tweaks tool arguments or a draft before continuing |
| Review output | Human checks a generated answer before it reaches a customer |
| Ask for input | Agent needs missing info (an account number) |

You can also set static breakpoints at compile time (`interrupt_before=["tools"]`), handy for debugging.

## Time travel

Because every step is checkpointed, you can list a thread's history, pick an earlier checkpoint, optionally modify its state with `update_state`, and resume from there — creating a fork. It's invaluable for debugging ("what if the retrieval had returned this instead?") and for letting users undo.

```python
history = list(graph.get_state_history(cfg))      # newest first
before_tools = next(s for s in history if s.next == ("tools",))
graph.invoke(None, before_tools.config)            # replay from that point
```

## Production considerations

- **Durable checkpointer** with retention policies — checkpoints accumulate fast.
- **Thread IDs** that encode tenant/user, with authorization on resume so one user can't resume another's thread.
- **Long-term memory** across threads lives in a separate store, not in checkpoints.
- **Schema evolution**: changing the state type can break old checkpoints; version your state.
- **Idempotent side effects** because of re-execution on resume and retries.

## Common mistakes

- Performing a side effect before `interrupt()` in the same node — it runs twice.
- Using the in-memory saver in production and losing every paused approval on deploy.
- Reusing one thread ID for everyone.
- Treating checkpoints as long-term user memory.

## In the interview

**Q: How does LangGraph persist conversation state?**
A checkpointer saves state after each step, keyed by thread ID. Re-invoking with the same thread ID resumes from the latest checkpoint; durable backends like Postgres make it survive restarts.

**Q: How would you add human approval before an agent issues a refund?**
Put an `interrupt()` in the refund node (or a breakpoint before it) that surfaces the proposed action; the UI shows it; on approval, resume with `Command(resume=...)`. Keep the refund call after the interrupt and make it idempotent.

**Q: What is time travel useful for?**
Debugging and recovery: replaying from an earlier checkpoint, modifying state to test alternatives, and letting users roll back.

## Key takeaways

- Checkpointers snapshot state per step, grouped by thread ID.
- `interrupt()` + `Command(resume=...)` implements human-in-the-loop.
- Interrupted nodes re-run on resume — order side effects carefully.
- Use durable savers, authorize thread access, and version state schemas.
