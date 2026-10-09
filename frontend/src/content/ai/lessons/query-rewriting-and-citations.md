Users ask vague, conversational, or multi-part questions that make poor search queries. Query rewriting fixes the input before retrieval; citations make the output checkable after generation. Together they turn RAG from "plausible" into "trustworthy".

## The analogy

A good reference librarian doesn't search the catalog for exactly what you mumbled. "That thing about the leave policy we discussed — does it apply to contractors?" becomes two precise lookups: "parental leave policy" and "contractor eligibility for leave benefits". And when they hand you the answer, they tell you which page of which handbook it came from, so you can check.

## Query rewriting techniques

```text
 user turn ──► [condense with history] ──► [expand / decompose] ──► retrieval
```

| Technique | What it does | Example |
|---|---|---|
| Conversational condensing | Resolves pronouns and context from chat history into a standalone query | "what about for contractors?" → "Does the parental leave policy apply to contractors?" |
| Multi-query expansion | Generates several paraphrases; retrieve for each and fuse | Adds "leave eligibility non-employees", "contractor benefits" |
| Decomposition | Splits compound questions into sub-questions | "Compare 2024 and 2025 travel policy" → two retrievals |
| HyDE | Generates a hypothetical answer and embeds *that* | Answers look more like documents than questions do |
| Step-back | Asks a more general question first for background | "What are leave policy eligibility rules?" |
| Metadata extraction | Pulls filters out of the query | "Q3 2025 sales deck" → `{quarter: Q3, year: 2025, type: deck}` |

```python
from pydantic import BaseModel

class SearchPlan(BaseModel):
    standalone_question: str
    sub_queries: list[str]           # 1-3 focused retrieval queries
    filters: dict[str, str]          # e.g. {"year": "2025"}

REWRITE_PROMPT = """Given the chat history and the latest user message,
produce a search plan. Resolve pronouns using the history. Split compound
questions into at most 3 sub-queries. Extract explicit filters only."""

def plan_and_retrieve(llm, retriever, history, message):
    plan = llm.structured(SearchPlan, system=REWRITE_PROMPT,
                          user=f"History:\n{history}\n\nLatest: {message}",
                          model="small-fast")            # cheap model is enough
    rankings = [retriever.search(q, filters=plan.filters, k=30) for q in plan.sub_queries]
    return plan.standalone_question, rrf_merge(rankings)[:40]
```

Rewriting adds an LLM call (latency + cost), so use a small, fast model, run sub-queries in parallel, and skip rewriting when the message is already standalone (a cheap heuristic or classifier can decide).

## Routing

A related step is **routing**: deciding *where* to search (product docs vs HR policies vs SQL database) or whether to search at all ("thanks!" doesn't need retrieval). A small classifier or an LLM with structured output works.

## Citations: making answers verifiable

Citations serve users (trust, drill-down), auditors (traceability), and you (debugging and evaluating faithfulness).

**Approach 1: cite chunk IDs inline.** Label each chunk in the prompt and require bracketed references.

```text
 <source id="S1" title="Leave Policy 2025" page="4"> ... </source>
 <source id="S2" title="Contractor Handbook" page="12"> ... </source>

 Answer: Contractors are not eligible for paid parental leave [S2],
 but full-time employees receive 26 weeks [S1].
```

**Approach 2: structured output with quotes.** Ask for claims plus the exact supporting quote and source ID, then *verify* each quote actually appears in the cited chunk.

```python
def verify_citations(answer: dict, sources: dict[str, str]) -> list[str]:
    problems = []
    for claim in answer["claims"]:
        src = sources.get(claim["source_id"])
        if src is None:
            problems.append(f"unknown source {claim['source_id']}")
        elif normalize(claim["quote"]) not in normalize(src):
            problems.append(f"quote not found in {claim['source_id']}")
    return problems     # non-empty -> regenerate, drop the claim, or flag
```

Some model APIs offer built-in citation features that return character spans from provided documents; when available they're usually more reliable than prompt-only schemes.

## Refusing gracefully

When retrieval returns nothing above a relevance threshold, don't let the model improvise. Return a clear "I couldn't find this in the knowledge base" with suggestions (rephrase, contact support). Measuring the refusal rate — and how often refusals were correct — is part of RAG evaluation.

## Common mistakes

- Embedding the raw follow-up "and for contractors?" with no history — retrieval returns noise.
- Over-expanding queries so retrieval drifts off-topic; cap sub-queries and fuse with RRF.
- Trusting citation markers without verification — models can cite the wrong source fluently.
- Citing chunk IDs users can't open; map IDs to titles, pages, and links.

## In the interview

**Q: How do you handle follow-up questions in conversational RAG?**
Condense the latest message plus relevant history into a standalone query with a small LLM before retrieval, and keep the original message for the final answer prompt.

**Q: What is HyDE and when does it help?**
Hypothetical Document Embeddings: generate a plausible answer and embed it, since answer-shaped text sits closer to documents in embedding space than a short question. It helps for terse queries; it can hurt if the hypothetical answer is confidently off-topic.

**Q: How do you ensure citations are correct?**
Label sources in the prompt, require claim-level citations with quotes, then programmatically verify quotes exist in the cited chunks; measure citation precision in evals.

## Key takeaways

- Rewrite queries: condense with history, decompose, expand, extract filters.
- Use a cheap model and parallel retrieval to keep latency down.
- Require citations, then verify them in code.
- Refuse when retrieval comes back empty — don't let the model guess.
