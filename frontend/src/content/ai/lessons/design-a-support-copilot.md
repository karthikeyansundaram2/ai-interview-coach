"Design an AI assistant for our customer support team" is one of the most common AI system design prompts. This worked example applies the framework end to end: answers from a knowledge base, actions on customer accounts, guardrails, human handoff, and metrics.

## The analogy

Think of the best senior support agent you've worked with: they know where every help article lives, can look up any order in seconds, follow refund policy exactly, never share one customer's data with another, and know when to say "let me get my manager". We're designing that agent's habits into a system.

## 1. Clarify

Assumptions we'd confirm with the interviewer:
- **Users**: end customers via web chat and app; later, an agent-assist mode for human agents.
- **Tasks**: answer how-to and policy questions; check order status; initiate returns/refunds within policy; escalate the rest.
- **Scale**: ~100k conversations/day, peaks ~50 concurrent new conversations/second.
- **Latency**: first token under ~1.5 s; full answer a few seconds.
- **Data**: ~20k help articles and policies (updated daily); order/account APIs.
- **Risk**: wrong refunds cost money; wrong policy answers create liability; PII everywhere.
- **Success**: resolution without human (deflection) at target CSAT, escalation quality, cost per resolved conversation.

## 2. Baseline

Agent-assist first: the model drafts replies that human agents approve. Low risk, gathers data, builds a golden set from real conversations. Then graduate intents with proven quality to customer-facing automation.

## 3. Architecture

```text
 chat client ─► gateway (auth, rate limit) ─► conversation service
                                                │
                     ┌──────────────────────────┼─────────────────────────────┐
                     ▼                          ▼                             ▼
             input guardrails           intent router (small model)     session/memory store
             (abuse, injection, PII)     ├─ FAQ/policy ─► RAG pipeline ─────────┐
                                         ├─ account task ─► tool agent ─────────┤
                                         └─ sensitive / angry / legal ─► human  │
                                                                                ▼
                                                           answer LLM ─► output guardrails ─► stream to user
                                                                                │
                                      traces + feedback ─► observability ─► eval/golden set
 OFFLINE: help-center CMS ─► ingest/chunk/embed (hourly) ─► hybrid index
```

## 4. Deep dives

**Retrieval.** Hybrid BM25 + vector search over articles, chunked by headings with title/section prefixes; filters for product, region, and locale; cross-encoder reranking to ~5 chunks; refuse when reranker scores fall below threshold. Policy documents carry effective dates, and only current versions are indexed.

**Tools.** A small set of task-level tools:

```python
TOOLS = [
    tool("get_orders", "List the signed-in customer's recent orders.", {"limit": "int"}),
    tool("get_order_status", "Status and tracking for one of the customer's orders.", {"order_id": "str"}),
    tool("check_return_eligibility", "Policy check for a return.", {"order_id": "str", "reason": "enum"}),
    tool("create_return", "Start a return. Requires eligibility check first.",
         {"order_id": "str", "reason": "enum"}, side_effect=True),
    tool("escalate_to_human", "Hand off with a summary.", {"summary": "str", "priority": "enum"}),
]

def execute(call, session):
    # identity comes from the authenticated session, never from model arguments
    if "order_id" in call.args and not orders.belongs_to(call.args["order_id"], session.customer_id):
        return {"error": "Order not found for this account."}
    if call.side_effect and not session.confirmed(call):
        return {"needs_confirmation": render_confirmation(call)}   # UI shows a button
    return registry[call.name](customer_id=session.customer_id, **call.args)
```

Key decisions: identity is bound server-side; side effects require explicit customer confirmation; refund amounts above a threshold route to humans; tools are idempotent with request keys.

**Model choice.** Small fast model for routing, rewriting, and simple FAQ answers; a stronger model for multi-step account tasks; cascade on validation failure.

**Handoff.** Escalate on explicit request, negative sentiment, repeated failure, low retrieval confidence, or sensitive topics. Pass a structured summary so the human doesn't re-ask everything.

## 5. Evaluation

- **Golden set** from historical tickets: tagged by intent, language, and difficulty, including adversarial (injection, abuse) and out-of-scope cases.
- **Component metrics**: router accuracy; retrieval recall@5; faithfulness; tool-selection and argument accuracy against sandboxed fixtures; policy compliance for refunds.
- **Online**: deflection rate *with* CSAT (deflection alone rewards stonewalling), escalation rate and reasons, reopen rate, cost per resolution.
- **Release**: shadow mode → agent-assist → limited rollout by intent → A/B test.

## 6. Production concerns

| Concern | Approach |
|---|---|
| Prompt injection | Untrusted content delimited; tools bound to session identity; no outbound arbitrary HTTP |
| PII | Pseudonymize before model calls where feasible; redact traces; retention limits |
| Cost | Prefix caching of system prompt + tool defs; routing; short answers; cached retrieval |
| Latency | Stream; run guardrails and retrieval in parallel; small router |
| Reliability | Provider fallback; graceful "connecting you to an agent" on outages |
| Freshness | Hourly incremental ingestion; policy effective dates |

## Common mistakes

- Letting the model supply customer IDs in tool calls.
- Optimizing deflection without CSAT or reopen rate.
- One giant prompt handling routing, retrieval decisions, and actions.
- No path to a human, or a handoff that loses context.

## In the interview

**Q: How do you stop the copilot from refunding the wrong customer's order?**
Bind identity server-side from the authenticated session; validate ownership on every tool call; require explicit confirmation for side effects; cap automated refund amounts; log and audit all actions.

**Q: What metrics define success?**
Resolution rate paired with CSAT and reopen rate, escalation quality, policy compliance, and cost per resolved conversation — plus component metrics to diagnose regressions.

**Q: How would you roll it out safely?**
Agent-assist first to build data and trust, then automate intent by intent with evals and A/B tests, monitoring escalations and complaints.

## Key takeaways

- Route by intent: RAG for knowledge, tool agent for account tasks, humans for sensitive cases.
- Bind identity server-side and confirm side effects.
- Measure deflection together with CSAT and reopen rate.
- Roll out from agent-assist to automation, intent by intent.
