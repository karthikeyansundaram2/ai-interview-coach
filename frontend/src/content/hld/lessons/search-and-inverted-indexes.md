A database index finds rows by exact key; search must find documents containing words, tolerate typos, and rank results by relevance. The inverted index is the structure that makes that fast, and search clusters shard and replicate it to handle billions of documents.

## The analogy

The index at the back of a textbook lists each term with the page numbers where it appears. To find pages about "replication" and "Raft", you look up both terms and intersect their page lists. You never read the book cover to cover. An inverted index is exactly that, for millions of documents.

## Building the index

```text
Doc 1: "Fast cache for hot keys"
Doc 2: "Cache invalidation is hard"
Doc 3: "Hot partitions and keys"

Analysis: lowercase, tokenize, remove stop words, stem ("keys" -> "key")

Term          Posting list (doc id: positions)
cache    ->   1:[2], 2:[1]
hot      ->   1:[4], 3:[1]
key      ->   1:[5], 3:[4]
invalid  ->   2:[2]
partit   ->   3:[2]
```

1. **Analysis**: a pipeline of tokenizer and filters (lowercasing, stemming, synonyms, n-grams for partial matching, language-specific rules).
2. **Posting lists**: for each term, a sorted list of document IDs, often with term frequencies and positions (for phrase queries).
3. **Compression**: delta-encoding sorted IDs and variable-length integers make posting lists small.
4. **Segments**: like an LSM tree, new documents go into small immutable segments that are periodically merged; deletes are marked and purged during merges.

## Querying and ranking

- A query is analyzed the same way, then posting lists are intersected (AND) or unioned (OR), using skip pointers to jump ahead quickly.
- **Ranking** scores matches. BM25 is the standard text relevance function: it rewards terms frequent in the document, rare across the corpus, with diminishing returns and document-length normalization.
- Real systems blend text relevance with signals such as popularity, recency, personalization, and location, and often re-rank the top few hundred results with a learned model.
- **Vector (semantic) search** complements keyword search: embeddings with approximate nearest neighbour indexes (HNSW). Hybrid search combines both scores.

## Scaling a search cluster

```text
                Query
                  |
            Coordinator node
       /          |            \
  Shard 0      Shard 1       Shard 2      (each: primary + replicas)
  top-k local  top-k local   top-k local
       \          |            /
       merge, global top-k, fetch documents
```

- **Document partitioning** (each shard holds a subset of documents, all terms): every query fans out to all shards (scatter-gather), each returns its local top-k, and the coordinator merges. Used by Elasticsearch/OpenSearch and most systems.
- **Term partitioning** (each shard holds some terms for all documents): fewer shards per query, but multi-term queries cross shards and hot terms create hot shards. Rarely used.
- **Replicas** serve reads and provide failover.
- Shard count is hard to change later in Elasticsearch; size shards around 10–50 GB.

## Keeping the index in sync

The search index is a derived view, not the source of truth.

```text
Primary DB --CDC / outbox events--> Kafka --> Indexer --> Search cluster
```

- Indexing is asynchronous, so search is eventually consistent (typically a refresh interval of about 1 second plus pipeline lag).
- Rebuild by replaying from the source into a new index, then switching an alias atomically.

## Common mistakes

- Using `LIKE '%term%'` on a relational table at scale; it scans everything.
- Treating the search cluster as the primary database.
- Too many tiny shards, each with fixed overhead, or too few huge ones.
- Different analyzers at index and query time, producing mysterious misses.
- Deep pagination (`from=100000`), which forces every shard to sort huge result sets; use search-after cursors.

## In the interview

**Q: How do you add search to an e-commerce catalogue stored in PostgreSQL?**
Stream product changes through CDC or an outbox into Kafka, index them into Elasticsearch with appropriate analyzers and facets, and query Elasticsearch for search while fetching authoritative price and stock from the primary service at display time.

**Q: How does a query execute across shards?**
The coordinator sends it to one copy of every shard, each computes its local top-k by score, and the coordinator merges those into the global top-k and fetches the documents.

**Q: How do you handle typos?**
Fuzzy matching using edit distance on terms, n-gram analyzers, and "did you mean" suggestions built from query logs.

## Key takeaways

- An inverted index maps terms to sorted posting lists of documents.
- Analysis pipelines determine what matches; use the same analysis at index and query time.
- BM25 plus business signals ranks results; vector search adds semantic matching.
- Shard by document, scatter-gather queries, and keep the index fed from the source of truth via CDC.
