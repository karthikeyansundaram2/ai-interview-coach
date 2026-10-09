Comparing a query against every vector works until you have millions of them. Approximate nearest-neighbor (ANN) indexes give up a little accuracy to become orders of magnitude faster, and vector databases wrap those indexes with storage, filtering, and operations.

## The analogy

Finding the closest coffee shop by measuring the distance to every coffee shop on Earth is exact but absurd. Instead you'd go to your neighborhood first (IVF: partition the space), ask locals who know nearby spots and hop between them toward the best one (HNSW: navigate a graph), and carry a compact sketch of each shop rather than full blueprints (PQ: compress vectors).

## Recall, latency, memory: pick your balance

ANN quality is measured by **recall@k**: of the true k nearest neighbors, how many did the index return? Every index has knobs that trade recall for speed and memory.

## HNSW (Hierarchical Navigable Small World)

```text
 layer 2:   A ───────────────── F            (few nodes, long jumps)
 layer 1:   A ──── C ──── F ──── H
 layer 0:   A─B─C─D─E─F─G─H─I─J─K            (all nodes, short links)
 search: enter at top, greedily move closer, drop down a layer, repeat
```

- A multi-layer proximity graph. Search starts at a sparse top layer, greedily hops toward the query, then descends to denser layers to refine.
- Knobs: `M` (links per node — more = better recall, more memory), `ef_construction` (build quality), `ef_search` (search breadth — the main recall/latency dial at query time).
- **Pros**: excellent recall and low latency; supports incremental inserts.
- **Cons**: memory-hungry (full vectors plus graph in RAM); deletions are awkward; build is slower.

## IVF (Inverted File index)

- Run k-means to create `nlist` centroids. Each vector is assigned to its nearest centroid's list.
- At query time, find the `nprobe` closest centroids and only scan their lists.
- Knobs: `nlist` (number of clusters), `nprobe` (clusters searched — higher = better recall, slower).
- **Pros**: lower memory overhead, fast build, good for very large datasets, pairs well with compression.
- **Cons**: needs training on representative data; recall drops for queries near cluster boundaries; data drift degrades clusters.

## PQ (Product Quantization)

- Split each vector into `m` sub-vectors; for each sub-space, learn a codebook of (say) 256 centroids; store each sub-vector as a 1-byte code.
- A 768-dim float32 vector (3,072 bytes) can shrink to e.g. 64 bytes.
- Distances are approximated using lookup tables — fast and tiny, but lossy.
- Usually combined: **IVF-PQ** for billion-scale search, often followed by re-scoring the top candidates with full-precision vectors.

```python
import faiss, numpy as np

d, n = 384, 200_000
xb = np.random.rand(n, d).astype("float32")
faiss.normalize_L2(xb)                              # cosine via inner product

hnsw = faiss.IndexHNSWFlat(d, 32, faiss.METRIC_INNER_PRODUCT)   # M = 32
hnsw.hnsw.efConstruction = 200
hnsw.add(xb)
hnsw.hnsw.efSearch = 64                             # raise for recall, lower for speed

quantizer = faiss.IndexFlatIP(d)
ivfpq = faiss.IndexIVFPQ(quantizer, d, 1024, 48, 8, faiss.METRIC_INNER_PRODUCT)
ivfpq.train(xb[:50_000])                            # learn centroids + codebooks
ivfpq.add(xb)
ivfpq.nprobe = 16

q = xb[:5]
for name, idx in [("hnsw", hnsw), ("ivfpq", ivfpq)]:
    D, I = idx.search(q, 10)
    print(name, I[0][:5])
```

## Comparison

| Index | Memory | Recall | Build | Best for |
|---|---|---|---|---|
| Flat (brute force) | High | Exact | None | < ~100k vectors, ground truth |
| HNSW | High | Very high | Slow-ish | Low-latency, millions of vectors |
| IVF-Flat | Medium | High | Fast | Large sets, frequent rebuilds |
| IVF-PQ | Very low | Medium (re-rank helps) | Needs training | Hundreds of millions to billions |

## Choosing a vector store

Options span: libraries (FAISS, hnswlib), vector extensions of existing databases (e.g. pgvector in Postgres, vector search in OpenSearch/Elasticsearch), and dedicated vector databases. Decide on:

- **Scale and QPS** — tens of thousands of vectors fit anywhere.
- **Filtering** — can it filter by metadata (tenant, permissions, date) *during* ANN search, not just after? Post-filtering can return too few results.
- **Hybrid search** — native BM25 + vector support saves glue code.
- **Operations** — backups, replication, multi-tenancy, updates/deletes, cost.

A pragmatic default for a team already on Postgres: start with pgvector; move only when scale or features demand it.

## Common mistakes

- Benchmarking with random vectors; real embeddings cluster very differently.
- Post-filtering a top-10 ANN result by tenant and returning 1 result.
- Forgetting to re-train IVF centroids after the data distribution shifts.
- Choosing a dedicated vector DB for 50k vectors and adding an extra system to operate.

## In the interview

**Q: Explain HNSW in a sentence or two.**
A layered proximity graph: search enters at a sparse top layer, greedily moves toward the query, and descends into denser layers to refine. `ef_search` trades recall for latency.

**Q: When would you pick IVF-PQ over HNSW?**
When memory is the bottleneck at hundreds of millions or billions of vectors. PQ compresses vectors massively; IVF limits the search to a few clusters. Re-rank top candidates with full vectors to recover accuracy.

**Q: How do you handle multi-tenant filtering in vector search?**
Use pre-filtering or filtered ANN supported by the store, or partition indexes per tenant. Pure post-filtering risks empty or incomplete results and, worse, leakage bugs if filtering is forgotten.

## Key takeaways

- ANN trades a little recall for big gains in speed and memory.
- HNSW: graph navigation, high recall, memory-heavy. IVF: cluster partitioning. PQ: compression.
- Tune `ef_search` / `nprobe` against measured recall on real data.
- Pick a store for filtering, hybrid search, and operations — not just raw speed.
