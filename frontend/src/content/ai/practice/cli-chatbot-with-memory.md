Build a terminal chatbot that streams its replies, survives restarts, and stays coherent over a 200-turn conversation without blowing past the context window. It's small, but it forces you to handle the fundamentals every LLM product depends on.

## What you'll build

A Python CLI (`chat`) that:

- Streams model output token by token to the terminal.
- Persists conversations to SQLite so you can resume with `chat --session work`.
- Manages context with a token budget: recent turns verbatim, older turns folded into a rolling summary.
- Extracts durable facts ("prefers Python examples", "works on a payments service") into a small long-term memory that's injected into future sessions.
- Supports slash commands: `/memory` (show facts), `/forget <id>`, `/summary`, `/cost`, `/new`.
- Is provider-agnostic: one small adapter interface so you can swap model APIs.

## Architecture

```text
 terminal (prompt_toolkit / input)
        │
        ▼
 ┌──────────────┐   build context    ┌───────────────────┐
 │  REPL loop   │ ─────────────────► │ ContextBuilder    │
 │  + commands  │                    │  system prompt    │
 └──────┬───────┘                    │  + memory facts   │
        │                            │  + rolling summary│
        │                            │  + recent turns   │
        │                            └─────────┬─────────┘
        │ stream                               │ messages
        ▼                                      ▼
 ┌──────────────┐                    ┌───────────────────┐
 │ LLM adapter  │ ◄───────────────── │  token counter    │
 │ (stream API) │                    └───────────────────┘
 └──────┬───────┘
        │ reply + usage
        ▼
 ┌──────────────────────────────────────────────┐
 │ SQLite: sessions, messages, summaries, facts, usage │
 └──────────────────────────────────────────────┘
        ▲
        └── background: summarize overflow, extract facts (cheap model)
```

## Milestones

1. **Streaming REPL.** Read input, send it with a system prompt, stream the reply.
   *Acceptance:* first characters appear well before the full reply finishes; Ctrl+C during generation cancels the stream without killing the app.

2. **Persistence.** Store every message with session ID, role, content, timestamp, and token usage.
   *Acceptance:* quitting and running `chat --session work` restores the conversation; `/cost` shows total input/output tokens for the session.

3. **Token-budgeted context.** Count tokens with the target model's tokenizer (or a close approximation) and keep only as many recent turns as fit a configurable budget.
   *Acceptance:* a scripted 200-turn conversation never exceeds the budget; the system prompt is always included.

4. **Rolling summary.** When turns fall out of the window, summarize them with a cheaper model and merge into the existing summary.
   *Acceptance:* tell it your name and project at turn 1; at turn 150 it still knows both. The summary stays under a fixed token cap.

5. **Long-term facts.** After each exchange (or every N turns), extract durable facts as structured JSON, dedupe against existing facts, and inject the top relevant ones into new sessions.
   *Acceptance:* a fact stated in session A is used in a new session B; `/forget` removes it and it no longer appears.

6. **Robustness.** Retries with backoff on rate limits/timeouts, clear errors, and a `--model` flag.
   *Acceptance:* simulated 429s are retried; a hard failure prints a friendly message and the conversation remains intact.

## Key code

```python
import sqlite3, json
from dataclasses import dataclass

@dataclass
class Msg:
    role: str
    content: str

class ContextBuilder:
    def __init__(self, db: sqlite3.Connection, llm, count_tokens, budget=6000, summary_cap=600):
        self.db, self.llm, self.count = db, llm, count_tokens
        self.budget, self.summary_cap = budget, summary_cap

    def build(self, session_id: str, system: str) -> list[dict]:
        turns = [Msg(r, c) for r, c in self.db.execute(
            "SELECT role, content FROM messages WHERE session_id=? AND folded=0 ORDER BY id",
            (session_id,))]
        summary = self._summary(session_id)
        facts = self._facts(limit=10)
        header = system + ("\n\nKnown about the user:\n- " + "\n- ".join(facts) if facts else "")
        used = self.count(header) + self.count(summary)

        kept: list[Msg] = []
        for m in reversed(turns):
            t = self.count(m.content)
            if used + t > self.budget:
                break
            kept.insert(0, m); used += t

        overflow = turns[: len(turns) - len(kept)]
        if overflow:
            summary = self._fold(session_id, summary, overflow)

        msgs = [{"role": "system", "content": header}]
        if summary:
            msgs.append({"role": "system", "content": f"Earlier conversation summary:\n{summary}"})
        return msgs + [{"role": m.role, "content": m.content} for m in kept]

    def _fold(self, session_id, summary, overflow):
        text = "\n".join(f"{m.role}: {m.content}" for m in overflow)
        new = self.llm.complete(model="small", max_tokens=self.summary_cap, messages=[
            {"role": "system", "content": "Update the running summary. Keep names, decisions, "
             "open questions, and user preferences. Be terse."},
            {"role": "user", "content": f"Current summary:\n{summary}\n\nNew turns:\n{text}"}]).text
        self.db.execute("UPDATE messages SET folded=1 WHERE session_id=? AND folded=0 AND id IN "
                        "(SELECT id FROM messages WHERE session_id=? AND folded=0 ORDER BY id LIMIT ?)",
                        (session_id, session_id, len(overflow)))
        self.db.execute("INSERT OR REPLACE INTO summaries(session_id, text) VALUES (?, ?)",
                        (session_id, new))
        self.db.commit()
        return new

    def _summary(self, sid):
        row = self.db.execute("SELECT text FROM summaries WHERE session_id=?", (sid,)).fetchone()
        return row[0] if row else ""

    def _facts(self, limit):
        return [r[0] for r in self.db.execute(
            "SELECT text FROM facts ORDER BY updated_at DESC LIMIT ?", (limit,))]
```

## Stretch goals

- Retrieve relevant facts by embedding similarity instead of recency.
- Add a `/search` command over past sessions using SQLite FTS5 plus embeddings.
- Render Markdown and code blocks nicely in the terminal (e.g., with `rich`).
- Add tool calling for one safe tool (calculator or current time).
- Write an eval: scripted long conversations with recall questions, scored automatically.

## What to say about it in interviews

- **Context is a budget**, not a transcript: explain the recent-window + rolling-summary + long-term-facts design and why each exists.
- **Trade-offs**: summaries lose detail (mitigated by keeping decisions and names explicitly); fact extraction can store wrong facts (mitigated by dedupe, user-visible `/memory`, and `/forget`).
- **Cost awareness**: you tracked tokens per session and used a cheaper model for summarization and extraction.
- **Reliability**: streaming with cancellation, retries with backoff, and persistence that survives crashes.
- **How it scales**: the same design maps to a web chat backend — SQLite becomes Postgres, background folding becomes a queue worker, facts become a per-user store with privacy controls.
