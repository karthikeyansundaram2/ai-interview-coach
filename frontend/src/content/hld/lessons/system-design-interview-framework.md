A system-design round is less a test of whether you know the "right" architecture and more a test of whether you can lead an ambiguous technical discussion to a sound, defensible design in 45 minutes. A repeatable structure keeps you from drifting, running out of time, or skipping the parts interviewers score.

## The analogy

An architect meeting a client does not start by sketching rooms. They ask how many people will live there, what the budget is, and what matters most, then sketch the floor plan, then detail the kitchen and staircase, and finally explain what they would change if the budget doubled. The interview follows the same order.

## The framework with time boxes (45 minutes)

```text
 0-5   Requirements (functional, non-functional, scope)
 5-9   Back-of-the-envelope estimates
 9-13  API design
13-17  Data model and storage choice
17-27  High-level architecture, walk one request end to end
27-40  Deep dives on 2-3 hardest parts
40-45  Bottlenecks, failure modes, trade-offs, extensions
```

Adjust by signal: if the interviewer waves away estimation, move on; if they push into one component early, follow them. The time boxes are a guide, not a script.

### 1. Requirements (about 5 minutes)

- **Functional**: list 3–5 core features and confirm which are in scope. "Users post photos, follow others, and see a home feed. Comments and DMs are out of scope."
- **Non-functional**: scale (DAU, data size), latency targets, availability, consistency needs, durability, geography, read/write ratio.
- Write them down visibly. They are the yardstick for every later decision.

### 2. Estimates (3–5 minutes)

QPS (average and peak), storage growth, bandwidth, and maybe memory for caching. Then say what each number implies: "50k reads/s means we need caching; 7 PB/year means object storage."

### 3. API (3–5 minutes)

Define the main endpoints or RPCs with key parameters and responses: `POST /v1/posts`, `GET /v1/feed?cursor=`. Mention pagination, idempotency keys, and auth. This anchors the design in concrete operations.

### 4. Data model (3–5 minutes)

Main entities, keys, and the access patterns each must serve. Choose a store per entity and justify it ("posts by user, sorted by time: wide-column partitioned by user_id").

### 5. High-level design (about 10 minutes)

Draw clients, load balancers or gateway, services, data stores, caches, queues, and CDN. Then **walk through the main flows** (a write and a read) step by step. A diagram without a walkthrough is half an answer.

```text
Client -> CDN -> LB/Gateway -> Service A -> Cache -> DB
                                  |
                                  +-> Queue -> Workers -> Object store
```

### 6. Deep dives (10–13 minutes)

Pick the two or three hardest problems, or ask the interviewer which they prefer: hot keys, fan-out, consistency of a booking, ordering of messages, sharding strategy, failure handling. For each: state the problem, give two or three options, compare them, choose one, and say why.

### 7. Wrap-up (about 5 minutes)

Identify bottlenecks and single points of failure, explain how the design handles a 10x growth, a region outage, or a dependency failure, and mention monitoring and what you would do with more time.

## What interviewers score at senior level

| Signal | What it looks like |
|---|---|
| Problem navigation | Clarifies scope, prioritizes, does not boil the ocean |
| Solution design | Sensible components that work together end to end |
| Technical depth | Real mechanisms, numbers, and failure modes in deep dives |
| Trade-offs | Names alternatives and justifies choices against requirements |
| Communication | Thinks aloud, checks in, adapts to hints |
| Operational maturity | Monitoring, failure handling, rollout, cost |

## Common mistakes

- Jumping to a diagram before asking a single question.
- Spending 15 minutes on estimates or on listing features.
- Naming technologies ("use Kafka") without saying why or how.
- Designing for 1B users when the requirements said 1M.
- Going silent while thinking; the interviewer cannot score what they cannot hear.
- Never revisiting the requirements to show the design meets them.

## In the interview

**Q: The interviewer says "Design Twitter." What do you say first?**
Ask which features to focus on (posting, timeline, search?), the scale (DAU, posts per day), latency and consistency expectations, then confirm a scoped list before designing.

**Q: How do you decide what to deep dive on?**
Pick what is hardest or most specific to this problem (feed fan-out for Twitter, seat contention for ticketing), or ask the interviewer. Avoid generic components everyone already understands.

**Q: What if you realize a mistake midway?**
Say so and fix it: "Given the 100:1 read ratio, I'd change this to precompute feeds." Self-correction is a positive signal.

## Key takeaways

- Requirements, estimates, API, data model, high-level design, deep dives, wrap-up.
- Keep to time boxes, roughly 5/4/4/4/10/13/5 minutes.
- Walk requests through the diagram; tie every choice back to requirements.
- Spend the most depth on the problem's unique hard parts.
