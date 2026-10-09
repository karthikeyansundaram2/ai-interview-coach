Semantic search finds documents that mean the same thing as your query, even when they share no words with it. It's the retrieval engine underneath most RAG systems, and its weaknesses are just as important to know as its strengths.

## The analogy

A keyword search is a librarian who only checks whether your exact words appear on a page. Ask for "car won't start in cold weather" and they miss the article titled "Winter battery failure". A semantic librarian understands what you're after and walks you to the right shelf regardless of wording.

## How it works

```text
 INDEX TIME
 docs ──► clean ──► chunk ──► embed ──► store (vector + text + metadata)

 QUERY TIME
 query ──► embed (same model) ──► nearest-neighbor search ──► top-k chunks
```

1. Split documents into chunks (a paragraph or a few hundred tokens).
2. Embed each chunk with an embedding model; store the vector alongside the text and metadata (source, date, permissions).
3. At query time, embed the query with the *same* model and find the vectors closest to it.

## A complete minimal implementation

```python
import numpy as np
from sentence_transformers import SentenceTransformer

class SemanticIndex:
    def __init__(self, model_name="all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)
        self.texts, self.meta, self.vecs = [], [], None

    def add(self, chunks: list[str], metas: list[dict]):
        v = self.model.encode(chunks, normalize_embeddings=True, batch_size=64)
        self.vecs = v if self.vecs is None else np.vstack([self.vecs, v])
        self.texts += chunks
        self.meta += metas

    def search(self, query: str, k=5, where: dict | None = None):
        q = self.model.encode([query], normalize_embeddings=True)[0]
        scores = self.vecs @ q                         # cosine similarity
        order = np.argsort(-scores)
        hits = []
        for i in order:
            if where and any(self.meta[i].get(f) != v for f, v in where.items()):
                continue                               # metadata filter
            hits.append((float(scores[i]), self.texts[i], self.meta[i]))
            if len(hits) == k:
                break
        return hits
```

A brute-force scan like this is perfectly fine up to tens or hundreds of thousands of chunks. Beyond that you need an approximate index (next lesson).

## Asymmetric search and instructions

Queries are short questions; documents are long statements. Many embedding models are trained for this **asymmetric** case and expect a prefix such as `"query: "` vs `"passage: "`, or a task instruction. Skipping the documented prefix can noticeably hurt retrieval quality — read the model card.

## Choosing an embedding model

Consider:
- **Retrieval quality on your domain** — public leaderboards are a starting point; your own eval set is the real test.
- **Dimension** — affects storage and speed. Some models support truncating vectors to fewer dimensions with modest quality loss.
- **Max input length** — text beyond it is silently truncated.
- **Language coverage**, **hosting** (API vs self-hosted), and **cost per million tokens**.

## Where semantic search struggles

| Weakness | Example | Mitigation |
|---|---|---|
| Exact terms and IDs | "ERR_4012", SKU numbers, names | Hybrid search with BM25 |
| Negation | "laptops without touchscreens" | Metadata filters, reranking |
| Out-of-domain jargon | Internal codenames | Domain-tuned embeddings, keyword fallback |
| Similar but irrelevant | Old policy vs current policy | Metadata (date, version) filters |

## Evaluating retrieval

Build a small set of `(query, relevant_chunk_ids)` pairs and measure **recall@k** (did a relevant chunk appear in the top k?) and **MRR** (how high was the first relevant one?). Change one thing at a time — chunk size, model, prefix — and compare.

## Common mistakes

- Embedding queries and documents with different models or different settings.
- Never normalizing vectors, then using dot product as if it were cosine.
- Ignoring metadata: returning a deprecated doc version because it's semantically closest.
- Judging quality by eyeballing three queries instead of measuring recall on a test set.
- Re-embedding the corpus on every deploy instead of caching by content hash.

## In the interview

**Q: How does semantic search differ from keyword search?**
Keyword search (e.g. BM25) scores documents by overlapping terms weighted by rarity. Semantic search embeds query and documents into a vector space and ranks by similarity, so it matches paraphrases and intent but can miss exact identifiers.

**Q: How would you evaluate an embedding model for your use case?**
Create a labeled set of real queries with relevant documents, then compare recall@k and MRR across candidate models with identical chunking. Also weigh latency, cost, dimension, and language support.

**Q: Your search returns semantically similar but outdated documents. Fix?**
Add version/date metadata and filter or boost by it; deduplicate superseded content at ingestion; consider a reranker that sees metadata.

## Key takeaways

- Embed chunks and queries with the same model; rank by cosine similarity.
- Brute force is fine at small scale; approximate indexes come later.
- Semantic search is weak on exact identifiers and negation — combine with keywords and filters.
- Measure recall@k and MRR on a labeled set before tuning anything.
