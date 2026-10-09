A cloud file storage service like Dropbox or Google Drive keeps a user's files in sync across all their devices and lets them share folders. The key ideas are splitting files into chunks so only changed parts move, separating metadata from content, and reconciling edits made on different devices.

## Clarify requirements

**Functional**
- Upload, download, delete files; folders.
- Automatic sync across a user's devices (desktop client watches a folder).
- Version history (restore older versions for 30 days).
- Share files/folders with other users (view/edit).
- Out of scope: real-time co-editing of documents, full-text search (extensions).

**Non-functional**
- 100M DAU, 500M total users; files up to 50 GB.
- Sync latency: changes visible on other devices within seconds.
- Strong durability (no data loss) and consistency of metadata (no corrupted folder trees).
- Efficient bandwidth on slow networks; resumable uploads.

## Back-of-the-envelope

- Storage: 500M users × 10 GB average used = **5 EB** logical. Deduplication and compression may save 30–50%.
- File changes: 100M DAU × 20 file updates/day = 2B/day → **~20k file commits/s**, peak ~60k.
- Chunk traffic: if an average change uploads 2 MB of new chunks: 2B × 2 MB = 4 PB/day upload ≈ **46 GB/s**.
- Metadata: 500M users × 1,000 files × 300 B ≈ **150 TB**, more with revisions: far beyond one database, so it must be sharded.
- Sync notifications: 100M connected devices with long-poll/WebSocket.

## API

```text
POST /v1/files/commit
  { "path": "/docs/plan.pdf", "parentRev": "r41",
    "chunks": ["sha256:ab..", "sha256:9f..", ...], "size": 7340032, "mtime": ... }
  -> 200 { "rev": "r42" }  or  409 { "missingChunks": [...] } or 409 conflict

POST /v1/chunks/check   { "hashes": [...] } -> { "missing": [...] }
PUT  /v1/chunks/{hash}  (presigned URL to block storage)
GET  /v1/chunks/{hash}  (presigned/CDN URL)

GET  /v1/changes?cursor=...      -> list of metadata changes since cursor (for sync)
GET  /v1/changes/longpoll?cursor -> returns when something changed
POST /v1/shares  { "path", "granteeId", "role" }
GET  /v1/files/{id}/revisions
```

## Data model

```text
Metadata DB (sharded by namespace_id = user root or shared folder):
  files: file_id, namespace_id, path/parent_id, name, latest_rev, is_deleted
  revisions: file_id, rev, chunk_list[], size, mtime, author_device, created_at
  namespace_journal: namespace_id, seq (monotonic), file_id, rev, op   -- change log for sync
  shares: namespace_id, user_id, role

Block store (object storage):
  key = sha256(chunk) -> compressed (and encrypted) chunk bytes, ~4 MB each
  chunk_refs: hash -> reference count (for garbage collection)
```

## High-level design

```text
 Desktop/mobile client
  - watcher detects changes
  - chunker (4 MB, content hashes)
  - local DB of synced state
     |                    |                         ^
     | metadata API       | chunk upload/download   | notifications (long poll / WS)
     v                    v                         |
  Metadata service    Block service --> Object storage (chunks)
     |                                                  
     v                                                  
  Metadata DB (sharded by namespace, with journal)       
     |
     +--> Notification service: "namespace N has new seq" --> clients of all devices/users with access
     +--> Kafka --> search indexing, thumbnails, virus scan, GC
```

**Upload flow**: the client chunks the changed file and hashes each chunk; asks which hashes are missing; uploads only missing chunks directly to object storage; then commits the new revision (chunk list) with the parent revision it was based on. The metadata service appends to the namespace journal and notifies watchers.

**Download/sync flow**: other devices are notified, call `/changes?cursor=` to get journal entries since their last cursor, fetch missing chunks by hash, and reassemble the file locally.

## Deep dives

### 1. Chunking and deduplication

- Splitting files into ~4 MB chunks means editing one part of a 1 GB file re-uploads only the changed chunks, and uploads are resumable chunk by chunk.
- Fixed-size chunks shift entirely when bytes are inserted at the start; **content-defined chunking** (rolling hash such as Rabin fingerprints picks boundaries based on content) keeps most chunks stable after inserts.
- Chunks are addressed by content hash, so identical chunks across versions, files, or users are stored once (dedup). Cross-user dedup can leak information ("does anyone have this file?"), so some services limit it to within a user or encrypt per-user.
- Reference counting or mark-and-sweep GC deletes chunks no longer referenced by any revision after retention.

### 2. Metadata consistency and the journal

- File metadata must be strongly consistent: a commit either fully applies or not; folder trees never break. Use a relational DB (sharded MySQL/Postgres, or a NewSQL store) with transactions within a namespace.
- Each namespace has an append-only journal with a monotonically increasing sequence. Clients sync by cursor ("give me entries after seq 1052"), which makes sync incremental, ordered, and resumable.
- Sharding by namespace keeps all operations for a user's tree (or a shared folder) on one shard; shared folders are their own namespaces mounted into members' trees.

### 3. Conflicts

Two devices edit the same file offline. Each commit includes `parentRev`. The first commit to reach the server wins (r42). The second commit's parent (r41) is no longer latest, so the server rejects it with a conflict; the client saves its version as a separate "conflicted copy" file and uploads it. This is simpler and safer than trying to merge arbitrary binary files. Renames and deletes follow similar optimistic concurrency.

### 4. Notifications at scale

100M devices can't poll constantly. Clients hold a long poll (or WebSocket) to a notification service subscribed to their namespaces; when a namespace's journal advances, the service signals "changes available", and the client calls the changes API. Notifications carry no data, so loss is harmless (clients also poll periodically as a fallback).

## Bottlenecks & scaling

- **Block storage**: object storage scales; tier old versions to cold storage.
- **Metadata hot namespaces**: a huge shared company folder concentrates load on one shard; split very large namespaces or rate-limit.
- **Upload bandwidth**: compression, dedup, and delta sync; clients throttle on metered networks.
- **Large initial syncs**: prioritize recently used files; download others lazily (on-demand "smart sync" placeholders).
- **Security**: encrypt chunks at rest with per-namespace keys; signed URLs for chunk access.

## Follow-ups the interviewer may ask

- **How do you support version history?** Every commit creates a revision pointing to its chunk list; restoring re-commits an old chunk list. Chunks are kept until no retained revision references them.
- **How do you handle a 50 GB file?** Chunked, parallel, resumable upload; the commit happens only after all chunks are present.
- **Why not store files directly as objects?** Whole-file uploads waste bandwidth on small edits, prevent dedup, and make resumable sync harder.
- **What happens when a user loses access to a share?** Remove the share row; their clients see the namespace unmounted in the next sync and delete local copies.
- **How would you add search?** Index file names and extracted text asynchronously from the journal into a search cluster, filtered by access rights at query time.
