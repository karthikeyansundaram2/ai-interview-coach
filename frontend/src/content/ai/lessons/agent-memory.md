LLMs are stateless: each call knows only what's in its context window. "Memory" is everything you build around the model to decide what it sees — recent turns, summaries of older ones, and facts retrieved from long-term storage.

## The analogy

Think of how you handle a long project. Your working memory holds the current conversation. A notebook holds summaries of past meetings. A filing cabinet holds documents you'll look up only when relevant. You don't reread the whole cabinet before every sentence. Agent memory mirrors this: context window, summaries, and searchable stores.

## The memory types

```text
 ┌─────────────── context window (what the model sees this call) ───────────────┐
 │ system prompt │ profile facts │ relevant long-term memories │ summary │ recent turns │ scratchpad │
 └──────────────────────────────────────────────────────────────────────────────┘
          ▲                ▲                   ▲                  ▲
     user profile    vector / KV store    rolling summary     raw message log
```

| Type | What it holds | Lifetime | Typical storage |
|---|---|---|---|
| Short-term (working) | Recent messages, tool results | One session/thread | In-memory or checkpoint store |
| Summary | Compressed older history | One thread | Text field per thread |
| Long-term semantic | Facts about user/world ("prefers Python") | Across sessions | DB / vector store |
| Episodic | Past interactions and outcomes | Across sessions | Vector store of episodes |
| Procedural | How to do things — learned instructions | Across sessions | Prompt fragments, rules |

## Managing short-term memory

Strategies, from simplest to richest:

1. **Sliding window**: keep the last N turns. Cheap; forgets early details.
2. **Token budget trimming**: keep as many recent turns as fit a budget, always preserving the system prompt and any pinned messages.
3. **Rolling summary**: when history exceeds a threshold, summarize the oldest part and replace it with the summary.

```python
def build_context(system, summary, turns, budget, count_tokens, summarize):
    """Keep recent turns verbatim; fold overflow into a running summary."""
    kept, used = [], count_tokens(system) + count_tokens(summary)
    for msg in reversed(turns):
        t = count_tokens(msg["content"])
        if used + t > budget:
            break
        kept.insert(0, msg); used += t
    overflow = turns[: len(turns) - len(kept)]
    if overflow:
        summary = summarize(previous=summary, new_messages=overflow)   # small model
    ctx = [{"role": "system", "content": system}]
    if summary:
        ctx.append({"role": "system", "content": f"Conversation so far (summary): {summary}"})
    return ctx + kept, summary
```

Keep tool-call messages paired with their results when trimming — orphaned tool results confuse models and some APIs reject them.

## Long-term memory

The hard questions are *what* to store and *when* to retrieve.

- **Writing**: after a conversation (or in the background), an LLM extracts durable facts — preferences, decisions, profile info — as structured records. Deduplicate and update instead of appending contradictions ("moved from Bangalore to Chennai" should replace, not coexist).
- **Reading**: at the start of a turn, retrieve memories relevant to the current message (semantic search, filtered by user), plus a small always-on profile.
- **Scope**: namespace by user and, where relevant, by organization. A memory leak between users is a privacy incident.

```python
class MemoryStore:
    def remember(self, user_id: str, fact: str, kind: str):
        existing = self.search(user_id, fact, k=3, min_score=0.85)
        if existing:
            self.update(existing[0].id, fact)          # supersede near-duplicate
        else:
            self.insert(user_id=user_id, text=fact, kind=kind, embedding=embed(fact))

    def recall(self, user_id: str, query: str, k=5):
        return self.search(user_id, query, k=k, min_score=0.6)
```

## Scratchpads for agents

Long-running agents benefit from an explicit **scratchpad** or state object: the goal, the plan, key findings, open questions. Instead of carrying 40 raw tool outputs, the agent updates a compact state. Frameworks like LangGraph make this explicit as typed graph state persisted by checkpoints.

## Privacy and control

Users should be able to see, correct, and delete what's remembered. Don't store sensitive categories unless clearly needed and consented, apply retention limits, and never let one user's memory be retrievable by another.

## Common mistakes

- Stuffing the entire history into every call until the context overflows or costs explode.
- Storing every message as a "memory", making retrieval noisy.
- Never updating facts, so contradictory memories coexist.
- Memory retrieval without strict per-user filtering.
- Trimming history in a way that splits a tool call from its result.

## In the interview

**Q: How would you give a chatbot memory across long conversations?**
Keep recent turns verbatim within a token budget, fold older turns into a rolling summary, and extract durable facts into a per-user long-term store that's retrieved by relevance each turn.

**Q: What's hard about long-term memory?**
Deciding what's worth storing, resolving contradictions and staleness, retrieving the right memories at the right time, and enforcing privacy and isolation between users.

**Q: Why not just use a model with a very long context window?**
Cost and latency grow with tokens, attention to details in very long contexts degrades, and sessions still end. Selective memory is cheaper and often more accurate.

## Key takeaways

- Models are stateless; memory is context management.
- Short-term: window + token budget + rolling summary.
- Long-term: extract, dedupe, update, and retrieve facts per user.
- Treat memory as user data: isolation, visibility, deletion.
