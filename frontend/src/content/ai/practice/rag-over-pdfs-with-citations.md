Build a question-answering service over a collection of PDFs that cites the exact page behind every claim and says "I don't know" when the documents don't support an answer. This is the canonical RAG project, done to production standards.

## What you'll build

A FastAPI service plus a simple UI where you upload PDFs (annual reports, manuals, policy documents) and ask questions. It:

- Parses PDFs with layout awareness, keeping page numbers and tables.
- Chunks by structure, enriches chunks with document and section context.
- Retrieves with hybrid search (BM25 + vectors) and reranks with a cross-encoder.
- Rewrites conversational follow-ups into standalone queries.
- Generates grounded answers with claim-level citations `[doc, page]`, verified in code.
- Refuses when reranker scores are too low.
- Streams answers and shows clickable source cards.

## Architecture

```text
 UPLOAD
 PDF ─► parser (text + tables + page numbers, OCR fallback) ─► structure-aware chunker
     ─► enrich ("Doc title > Section" prefix) ─► embed ─► vector store
                                               └────────► BM25 index
 ASK
 question + history ─► condense/rewrite (small model)
                    ─► BM25 top-50  ┐
                    ─► vector top-50┴► RRF ─► cross-encoder rerank ─► top 6 (score ≥ τ?)
                                                              │ no ─► "Not found in documents"
                                                              ▼ yes
                         answer LLM (structured: claims[] with source_id + quote)
                                    │
                         verify quotes ∈ cited chunk ─► drop/flag bad claims
                                    │
                         stream answer + source cards (doc, page, snippet, link)
```

## Milestones

1. **Parsing that preserves structure.** Extract text per page, detect headings, keep tables as Markdown, OCR scanned pages.
   *Acceptance:* for three sample PDFs (one with tables, one scanned), extracted text spot-checks correctly, and every chunk carries `doc_id` and `page`.

2. **Indexing.** Structure-aware chunks (~300–500 tokens) with contextual prefixes; dense and BM25 indexes.
   *Acceptance:* re-uploading an unchanged PDF is a no-op (hash check); deleting a PDF removes its chunks from both indexes.

3. **Retrieval with evaluation.** Build 40+ question → (doc, page) pairs; implement hybrid + rerank.
   *Acceptance:* report recall@5 and MRR for dense-only, hybrid, and hybrid+rerank; hybrid+rerank is best or you can explain why not.

4. **Grounded generation with citations.** Structured output: list of claims with `source_id` and supporting quote; render as prose with `[n]` markers.
   *Acceptance:* every claim has a citation; programmatic verification confirms quotes appear in cited chunks for ≥ 95% of claims on the eval set.

5. **Refusal and follow-ups.** Threshold on reranker score; conversational query rewriting.
   *Acceptance:* 10 unanswerable questions are refused at least 8 times; "what about the previous year?" after a revenue question retrieves the right pages.

6. **Serving.** Streaming endpoint, source cards with page links, request tracing (retrieved IDs, scores, tokens, latency).
   *Acceptance:* first token under a few seconds locally; each answer's trace shows the retrieved chunks.

## Key code

```python
from pydantic import BaseModel

class Claim(BaseModel):
    text: str
    source_id: str            # e.g. "S3"
    quote: str                # verbatim supporting span from that source

class GroundedAnswer(BaseModel):
    answerable: bool
    claims: list[Claim]

SYSTEM = """Answer the question using ONLY the sources. For each factual claim,
give the source id and a short verbatim quote that supports it.
If the sources don't answer the question, set answerable=false and return no claims."""

def answer(question: str, history: list[dict], llm, retriever, reranker, tau=0.3):
    standalone = condense(llm, question, history)                 # small model
    candidates = retriever.hybrid(standalone, k=50)               # BM25 + dense + RRF
    ranked = reranker.rank(standalone, candidates)[:6]
    if not ranked or ranked[0].score < tau:
        return {"text": "I couldn't find this in the uploaded documents.", "sources": []}

    sources = {f"S{i + 1}": c for i, c in enumerate(ranked)}
    context = "\n\n".join(
        f'<source id="{sid}" doc="{c.doc_title}" page="{c.page}">\n{c.text}\n</source>'
        for sid, c in sources.items())
    out = llm.structured(GroundedAnswer, system=SYSTEM,
                         user=f"{context}\n\n<question>{standalone}</question>", temperature=0)

    if not out.answerable:
        return {"text": "The documents don't cover this.", "sources": []}

    verified, used = [], {}
    for claim in out.claims:
        src = sources.get(claim.source_id)
        if src and normalize(claim.quote) in normalize(src.text):
            n = used.setdefault(claim.source_id, len(used) + 1)
            verified.append(f"{claim.text} [{n}]")
    if not verified:
        return {"text": "I found related material but couldn't verify an answer.", "sources": []}

    cards = [{"n": n, "doc": sources[sid].doc_title, "page": sources[sid].page,
              "snippet": sources[sid].text[:200]} for sid, n in used.items()]
    return {"text": " ".join(verified), "sources": cards}

def normalize(s: str) -> str:
    return " ".join(s.lower().split())
```

## Stretch goals

- Parent–child retrieval: match small chunks, send their parent section.
- Highlight the cited quote inside a rendered PDF page.
- Multi-document comparison questions via query decomposition.
- Add per-user document collections with access control enforced in retrieval.
- Wire up the eval harness project to gate changes in CI.

## What to say about it in interviews

- **Debugging by stage**: you measured retrieval (recall@5, MRR) separately from generation (faithfulness, citation validity), and can say which changes moved which metric.
- **Parsing matters**: concrete examples of table and multi-column failures you fixed.
- **Hybrid + rerank**: why each piece exists and the measured gains.
- **Trust features**: verified citations, refusal thresholds, and the trade-off between refusing too often and hallucinating.
- **Production path**: incremental ingestion, permissions at retrieval, tracing, and cost per answer.
