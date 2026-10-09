Vector search finds meaning; keyword search finds exact terms; a reranker reads the candidates closely and puts the best on top. Production RAG systems almost always combine all three because each covers the others' blind spots.

## The analogy

Hiring for a role: first, an ATS keyword filter catches résumés that mention "Kafka" exactly. Separately, a recruiter skims for people with relevant experience described in other words. Then the hiring manager carefully reads the merged shortlist of 50 and picks the top 5. Cheap and broad first, expensive and precise last.

## The two retrievers

**BM25 (sparse / keyword).** Scores documents by query-term matches, boosting rare terms and normalizing for document length. Excellent for IDs, error codes, names, acronyms, and exact phrases. Blind to synonyms.

**Dense (embeddings).** Matches paraphrase and intent. Weak on exact tokens and rare jargon.

| Query | BM25 | Dense |
|---|---|---|
| "ERR_CONN_RESET on checkout" | Strong | Weak |
| "payment page keeps failing" | Weak | Strong |
| "SOC 2 report request process" | Good | Good |

## Fusing results: Reciprocal Rank Fusion

Scores from BM25 and cosine similarity live on different scales, so adding them is messy. **Reciprocal Rank Fusion (RRF)** sidesteps that by using only ranks:

```text
 RRF(doc) = Σ over retrievers  1 / (k + rank_in_that_retriever)      (k ≈ 60)
```

A document ranked well by both rises to the top; one ranked highly by only one still survives.

```python
from collections import defaultdict
from rank_bm25 import BM25Okapi

def rrf(rankings: list[list[str]], k: int = 60) -> list[str]:
    scores = defaultdict(float)
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] += 1.0 / (k + rank)
    return sorted(scores, key=scores.get, reverse=True)

def hybrid_search(query, bm25: BM25Okapi, ids, vindex, n=50):
    bm25_scores = bm25.get_scores(query.lower().split())
    bm25_rank = [ids[i] for i in bm25_scores.argsort()[::-1][:n]]
    dense_rank = [hit.id for hit in vindex.search(query, k=n)]
    return rrf([bm25_rank, dense_rank])[:n]
```

Alternatives: weighted score blending after normalization (tunable, but sensitive), or learned sparse models that expand terms. RRF is a strong, parameter-light default.

## Reranking with cross-encoders

Embedding models are **bi-encoders**: query and document are encoded separately, so comparison is a cheap dot product, but the model never sees them together. A **cross-encoder** feeds `[query, document]` jointly through a transformer and outputs a relevance score. It's far more accurate — it can notice that the document answers a *different* question — but too slow to run over the whole corpus.

```text
 corpus (millions) ──► hybrid retrieve top 50–100 ──► cross-encoder rerank ──► top 5–8 to LLM
       cheap, high recall                                expensive, high precision
```

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def rerank(query: str, candidates: list[dict], top_n=6, min_score=None):
    pairs = [(query, c["text"]) for c in candidates]
    scores = reranker.predict(pairs, batch_size=32)
    ranked = sorted(zip(scores, candidates), key=lambda x: x[0], reverse=True)
    if min_score is not None:
        ranked = [r for r in ranked if r[0] >= min_score]   # drop weak context
    return [c for _, c in ranked[:top_n]]
```

Rerankers come as open models, hosted APIs, or you can use an LLM to grade relevance (slower and pricier, sometimes better for nuanced domains).

## Why fewer, better chunks matter

Sending 30 loosely related chunks costs tokens and invites the model to latch onto the wrong one. A reranker lets you send 5 highly relevant chunks — cheaper, faster, and usually more accurate. A reranker score threshold also gives you a principled "nothing relevant found" signal for refusing to answer.

## Latency budget

| Stage | Typical cost |
|---|---|
| BM25 + ANN in parallel | Tens of ms |
| Cross-encoder over 50 candidates | Tens to a few hundred ms (GPU helps) |
| LLM generation | Usually dominant |

Run the two retrievers concurrently; cap reranker candidates.

## Common mistakes

- Adding raw BM25 scores to cosine scores without normalization.
- Reranking only the top 5 from retrieval — the reranker can't rescue what isn't in the candidate set. Retrieve wide, rerank narrow.
- Skipping the keyword index because "embeddings understand everything".
- Tokenizing BM25 badly (no lowercasing, splitting `ERR_4012` into noise).

## In the interview

**Q: Why hybrid search?**
Dense retrieval handles paraphrase; BM25 handles exact terms like IDs and acronyms. Real queries mix both, so fusing them (e.g., with RRF) improves recall over either alone.

**Q: Bi-encoder vs cross-encoder?**
Bi-encoders embed query and document independently — fast, indexable, less precise. Cross-encoders score the pair jointly — much more accurate, too slow for full-corpus search. Use bi-encoders to retrieve and cross-encoders to rerank.

**Q: How many chunks do you retrieve and pass to the LLM?**
Retrieve broadly (say 50–100) for recall, rerank to a handful (say 5–8) for precision, and tune both against recall@k and answer-quality evals plus latency and cost budgets.

## Key takeaways

- BM25 and dense retrieval fail differently; combine them.
- RRF fuses rankings without score calibration.
- Retrieve wide with cheap methods, rerank narrow with a cross-encoder.
- Fewer, better chunks improve accuracy, cost, and refusals.
