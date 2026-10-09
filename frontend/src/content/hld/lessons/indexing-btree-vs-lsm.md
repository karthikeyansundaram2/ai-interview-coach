An index is a sorted structure that lets a database find rows without reading the whole table. The two dominant designs, B-trees and LSM trees, make opposite bets: B-trees optimize reads by updating data in place, LSM trees optimize writes by only ever appending.

## The analogy

A B-tree is a printed encyclopedia with a precise index at the back: finding a topic is quick, but adding a new entry means squeezing it into the right page, sometimes splitting a page in two. An LSM tree is a journalist's notebook: new notes are scribbled quickly on the latest page, and every so often the notebooks are merged and rewritten into a clean, sorted volume. Looking something up may mean checking several notebooks.

## Why indexes matter

Without an index, `SELECT * FROM orders WHERE user_id = 42` scans every row: on 100M rows that is seconds or minutes. With an index on `user_id`, the database descends a tree in a handful of steps and reads only matching rows: milliseconds.

## B-trees

```text
                  [  40  |  80  ]
                 /       |       \
       [10|20|30]   [50|60|70]   [90|95]
          |              |            |
       leaf pages with keys -> row locations (or the rows themselves)
```

- Data lives in fixed-size pages (often 8–16 KB) organized as a balanced tree.
- A lookup reads O(log n) pages; with a high fan-out (hundreds of keys per page), even a billion rows needs only 3–4 levels, and the top levels sit in memory.
- Writes update pages in place, protected by a write-ahead log for crash safety.
- Range scans are efficient because leaves are sorted and linked.
- Used by PostgreSQL, MySQL InnoDB, SQL Server, Oracle.

## LSM trees (log-structured merge)

```text
write --> WAL (append) + Memtable (sorted, in memory)
                          | full (e.g. 64 MB)
                          v
                   flush to SSTable L0 (immutable, sorted file)
                          | background compaction merges files
                          v
                   L1 ... Ln (larger, non-overlapping sorted files)

read --> memtable -> L0 files -> L1 ... (Bloom filters skip files that can't contain the key)
```

- Writes are sequential appends, which disks and SSDs love, giving very high write throughput.
- Reads may check several files; Bloom filters and caches keep this cheap for point lookups.
- Deletes are tombstones removed later during compaction.
- Used by Cassandra, RocksDB, LevelDB, ScyllaDB, HBase, and as the engine under many modern systems.

## Comparison

| | B-tree | LSM tree |
|---|---|---|
| Write pattern | Random in-place updates | Sequential appends |
| Write throughput | Good | Excellent |
| Point read | Very predictable | Good with Bloom filters; can touch several files |
| Range scan | Excellent | Good, merges several sorted runs |
| Write amplification | Page rewrites | Compaction rewrites data multiple times |
| Space | Fragmentation in pages | Temporary duplicates until compacted |
| Latency spikes | Rare | Compaction can cause spikes |
| Best for | Read-heavy, transactional workloads | Write-heavy ingestion, time series, messages |

## Index design in practice

- **Composite indexes** follow the leftmost-prefix rule: an index on `(user_id, created_at)` serves `WHERE user_id = ?` and `WHERE user_id = ? ORDER BY created_at`, but not `WHERE created_at > ?` alone.
- **Covering indexes** include every column the query needs, so the table itself is never touched.
- **Selectivity**: indexing a boolean column rarely helps.
- **Secondary indexes cost writes**: each insert updates every index. Five indexes can make writes several times slower.
- **Hash indexes** give O(1) equality lookups but no range queries.
- In partitioned stores, a **global secondary index** is itself partitioned by the indexed attribute and usually updated asynchronously; a **local** index lives with each partition but requires querying every partition if you do not know the partition key.

## Common mistakes

- Adding an index for every query and wondering why writes slowed.
- Wrong column order in composite indexes.
- Assuming an LSM store has fast arbitrary queries; it is fast at its key design and little else.
- Ignoring compaction settings, then seeing disk usage double and latency spike.

## In the interview

**Q: Why does Cassandra handle heavy writes better than MySQL?**
Cassandra's LSM engine turns every write into a sequential append to a log and an in-memory table, deferring sorting and merging to background compaction. MySQL's B-tree updates pages in place, causing random I/O and page splits.

**Q: How would you index a query for a user's 20 most recent orders?**
A composite index on `(user_id, created_at DESC)`, possibly covering the displayed columns, so the database seeks to the user and reads 20 entries in order.

**Q: What is the cost of adding indexes?**
Slower writes and more storage, since every index must be updated on insert and update, plus more memory needed to keep indexes cached.

## Key takeaways

- Indexes trade write cost and storage for fast reads.
- B-trees update in place and excel at reads and range scans.
- LSM trees append and compact, excelling at write-heavy workloads.
- Design composite indexes around the exact queries, respecting leftmost-prefix order.
