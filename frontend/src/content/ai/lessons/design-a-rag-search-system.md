"Design a system that lets employees ask questions across all company documents" tests whether you can take RAG from a notebook demo to an enterprise system: many sources, millions of documents, strict permissions, constant updates, and answers people can trust.

## The analogy

A great corporate librarian knows every department's filing system, checks your badge before handing over confidential folders, notices when a policy has been replaced, and always tells you which document an answer came from. We're designing that librarian at the scale of millions of documents.

## 1. Clarify

Assumptions:
- **Users**: ~20k employees; web app plus chat integration.
- **Sources**: wiki, shared drives, ticketing system, code docs, PDFs; ~5M documents, ~50M chunks.
- **Freshness**: edits searchable within ~15 minutes; deletions and permission changes reflected quickly.
- **Permissions**: document-level ACLs from each source; must never leak.
- **Latency**: answer streaming begins within ~2 s; search results within ~500 ms.
- **Success**: answer acceptance rate, citation click-through, reduced time-to-answer, zero ACL leaks.

## 2. Baseline

Plain hybrid search with good snippets — no generation. It's useful on its own, and generation is layered on top for question-style queries.

## 3. Architecture

```text
 INGESTION (async)
 source connectors ─► change events / polling ─► queue ─► parse workers ─► chunk + enrich
     (wiki, drive, tickets)                                     │
                                                    embed workers (batched) ─► vector index (sharded)
                                                                 └──────────► keyword index
                                                    ACL sync ─► principal → groups cache; chunk ACL fields

 QUERY
 user ─► auth (user + groups) ─► query understanding (rewrite, filters, route)
       ─► parallel: BM25 + ANN  (ACL filter applied INSIDE both searches)
       ─► fuse (RRF) ─► rerank top ~100 ─► top ~8 chunks
       ─► answer LLM (grounded, cited) ─► citation verification ─► stream
```

## 4. Deep dives

**Ingestion at scale.** Connectors emit change events (or poll with cursors). Each document is hashed; unchanged ones are skipped. Parsing is layout-aware for PDFs and slides; tables are kept as Markdown. Chunking is structure-aware with title/section prefixes. Embedding runs in batches on a queue with backpressure and retries; a full re-embed (for a model upgrade) runs as a parallel index build and cut-over by alias, not in place.

**Permissions.** The hardest and most important part.

```python
def search(user, query, k=100):
    principals = acl_cache.principals_for(user.id)     # user id + group ids, short TTL
    acl_filter = {"allowed_principals": {"any_of": principals}}
    bm25_hits = keyword_index.search(query.text, filter=acl_filter, k=k)
    ann_hits = vector_index.search(embed(query.text), filter=acl_filter, k=k)
    fused = rrf([bm25_hits, ann_hits])[:k]
    # defense in depth: re-check against source of truth before generation
    return [h for h in fused if acl_service.can_read(user.id, h.doc_id)]
```

- Store allowed principals on each chunk; filter **during** retrieval, never after generation.
- Sync group memberships separately (they change more often than documents).
- On permission revocation, update chunk ACLs promptly; consider a post-retrieval re-check for sensitive sources.
- Never put retrieved content from one user's query into a shared cache.

**Retrieval quality.** Hybrid search with RRF, cross-encoder reranking, query rewriting for conversational follow-ups, metadata filters extracted from queries ("Q3", "HR policy"), recency boosts, and deduplication of near-identical chunks across copies of the same file.

**Vector index sizing.** 50M chunks × 768 dims × 4 bytes ≈ 150 GB raw float32 — too much for one HNSW node in RAM. Options: shard across nodes, reduce dimensions, quantize vectors (int8 or PQ) and re-score top candidates with full precision. Partitioning by tenant or business unit also helps filtering.

**Generation.** Strict grounding prompt, claim-level citations with verification, refusal when evidence is weak, and visible source cards with links so users can check.

## 5. Evaluation

- Golden set of real employee questions per department, with relevant documents labeled; include permission test cases (user A must *not* see doc X).
- Retrieval: recall@k, MRR, per-source slices.
- Generation: faithfulness, citation precision, refusal correctness.
- **ACL leakage tests** run in CI: synthetic users with known permissions; any leak fails the build.
- Online: acceptance (thumbs up), citation clicks, reformulation rate, zero-result rate.

## 6. Production concerns

| Concern | Approach |
|---|---|
| Freshness | Event-driven ingestion; SLO on index lag; dashboards per connector |
| Deletions | Tombstones propagate to both indexes; periodic reconciliation with sources |
| Cost | Batch embeddings; cache embeddings by hash; route simple lookups to search-only |
| Latency | Parallel retrievers; reranker on GPU; stream answers |
| Injection | Documents are untrusted; no side-effecting tools in this system |
| Observability | Trace query → retrieved IDs → answer; per-connector ingestion metrics |

## Common mistakes

- Filtering permissions after retrieval, or only in the UI.
- Re-embedding everything in place when changing models.
- Ignoring duplicates (the same deck in ten folders crowds out other results).
- No deletion path, so removed documents keep being cited.

## In the interview

**Q: How do you enforce document permissions in RAG?**
Store ACL principals on each chunk, resolve the user's groups at query time, and filter inside both keyword and vector search; optionally re-check against the source before generation; test for leaks in CI.

**Q: How do you keep the index fresh?**
Event-driven connectors feeding a queue, content hashing to skip unchanged docs, incremental re-chunk/re-embed, tombstones for deletions, and an index-lag SLO with monitoring.

**Q: How do you change embedding models without downtime?**
Build a new index in parallel, backfill with batch embedding, evaluate on the golden set, then switch traffic via an alias and keep the old index for rollback.

## Key takeaways

- Permissions are enforced inside retrieval and tested in CI.
- Ingestion is an event-driven, incremental pipeline with deletions and reconciliation.
- Hybrid retrieval + reranking + verified citations for trustworthy answers.
- Plan index sizing, sharding, and blue-green re-indexing from the start.
