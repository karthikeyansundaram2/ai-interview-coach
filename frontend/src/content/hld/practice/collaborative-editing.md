Collaborative editing like Google Docs lets many people type into the same document at the same time and see each other's changes within milliseconds, with everyone converging on an identical result. The heart of the problem is merging concurrent edits correctly, which is solved by operational transformation (OT) or CRDTs.

## Clarify requirements

**Functional**
- Create, open, and edit rich-text documents.
- Multiple users edit concurrently; changes appear for others in real time.
- Show collaborators' cursors and selections (presence).
- Offline editing with sync on reconnect (at least for short disconnects).
- Version history: view and restore earlier versions.
- Sharing with view/comment/edit permissions.
- Out of scope: spreadsheets, comment threads design details, export formats.

**Non-functional**
- 100M DAU, 1B documents; most docs have 1–5 simultaneous editors, some up to ~100 (and many viewers).
- Edit propagation latency < 200 ms within a region.
- All replicas converge (strong eventual consistency); no lost keystrokes.
- Durable: acknowledged edits survive server failures.

## Back-of-the-envelope

- Active editing sessions at peak: say 10M concurrent documents open, 20M connected clients.
- Operations: an active typist generates ~5 ops/s (batched every ~100 ms); if 5M users are typing at peak → **25M ops/s** before batching; with client-side batching per 100–200 ms, ~**5M messages/s**.
- Per document, rates are small (tens of ops/s), so the problem is many independent small streams, not one huge stream: shard by document.
- Storage: 1B docs × 50 KB snapshot ≈ 50 TB, plus op logs (compacted periodically into snapshots).

## API

```text
REST:
POST /v1/docs                 -> { docId }
GET  /v1/docs/{id}            -> latest snapshot + revision number
GET  /v1/docs/{id}/revisions  -> version history
POST /v1/docs/{id}/share      { userId, role }

WebSocket /v1/docs/{id}/session:
 client -> server: { type: "op", baseRev: 1042, clientOpId, ops: [retain 10, insert "hi", delete 3] }
 server -> client: { type: "ack", clientOpId, rev: 1043 }
 server -> client: { type: "op", rev: 1044, authorId, ops: [...] }        (others' ops, transformed)
 both:             { type: "presence", userId, cursor, selection }
 client -> server: { type: "sync", sinceRev: 1030 }                       (reconnect)
```

## Data model

```text
documents: doc_id, owner_id, title, latest_rev, latest_snapshot_rev, acl_ref, created_at
operations (append-only, partitioned by doc_id, ordered by rev):
  doc_id, rev, author_id, client_op_id, ops (compact binary), ts
snapshots (object storage): doc_id/rev -> full document state (every N ops or minutes)
acl: doc_id, principal, role
presence (in memory on the doc session server, ephemeral)
```

## High-level design

```text
 Clients <==WS==> Gateway fleet --(route by doc_id: consistent hashing / directory)--> Doc session server
                                                                                        (one owner per active doc)
                                                                         - holds doc state in memory
                                                                         - orders ops, assigns rev
                                                                         - transforms (OT) or merges (CRDT)
                                                                         - broadcasts to all sessions
                                                                         - relays presence
                                                                                |
                                                          append op (durable) v
                                                                     Operations log (DB / log store)
                                                                                |
                                                        Snapshotter (compacts ops -> snapshots in object storage)
 REST API --> Docs metadata DB, ACL service, version history
```

**Edit flow**: a client applies its edit locally immediately (optimistic), sends the op with the revision it was based on, and keeps it as pending. The session server transforms the op against any ops committed since that base revision, assigns the next revision, appends it durably, acks the sender, and broadcasts the transformed op to other clients. Clients transform incoming ops against their own pending ops before applying.

## Deep dives

### 1. OT vs CRDT

| | Operational Transformation | CRDT (e.g., RGA, Yjs, Automerge) |
|---|---|---|
| Idea | Transform concurrent ops against each other so intent is preserved | Give every character a unique, ordered ID so merges commute |
| Server | Central server orders ops (simplifies correctness) | Can work peer-to-peer; server optional |
| Offline | Harder for long divergence | Natural; merge any time |
| Metadata overhead | Small | Per-character IDs and tombstones (mitigated by compaction) |
| Used by | Google Docs (server-ordered OT) | Figma-like and many modern editors (Yjs, Automerge) |

Example of why transformation matters: the text is "abc". User 1 inserts "X" at position 0; user 2 concurrently deletes position 2 ("c"). If user 2's delete is applied after user 1's insert without transformation, it deletes "b" instead. OT shifts the delete to position 3. With a central server assigning a single order, OT only needs to transform against ops the client hasn't seen, which is tractable. Either approach is acceptable; state the trade-off and pick one (server-ordered OT for a Google Docs clone, CRDT if strong offline/peer-to-peer support matters).

### 2. One authority per document

Routing all sessions of a document to a single session server makes ordering trivial (that server assigns revisions) and keeps document state in memory. Ownership is assigned by consistent hashing or a directory with leases. If the server crashes, another acquires the lease, loads the latest snapshot plus subsequent ops from the log, and clients reconnect and resend unacknowledged ops (deduplicated by `clientOpId`). A fencing token on the op log append prevents a zombie owner from writing.

### 3. Durability, snapshots, and history

- Each op is appended to the durable log before it is acknowledged, so acknowledged edits are never lost.
- Replaying millions of ops to open a document is slow, so a snapshotter periodically writes a full snapshot (every ~1,000 ops or few minutes); opening a doc = latest snapshot + ops after it.
- Version history is derived from snapshots and op ranges, grouped by author and time into human-meaningful versions; restoring a version is just a new op that sets content.

### 4. Presence and scaling hot documents

- Cursors and selections are ephemeral: relayed by the session server, throttled (~10/s per user), never persisted.
- A doc with 100 editors and 10k viewers: editors connect to the owner; viewers can be served via a fan-out tier that subscribes to the doc's op stream, keeping the owner's load bounded.

## Bottlenecks & scaling

- **Session servers**: sharded by doc; millions of docs spread across many servers; memory holds only active docs.
- **Op log write rate**: millions of small appends/s overall but partitioned by doc; batch ops per client tick.
- **Reconnect storms**: jittered reconnects; resync from revision numbers.
- **Large documents**: chunk the document model (paragraph-level structures) to keep transforms and snapshots efficient.
- **Permissions**: checked when opening a session and re-checked on ACL change events (kick revoked users).

## Follow-ups the interviewer may ask

- **How does offline editing work?** The client queues ops against its last known revision; on reconnect it sends them and the server transforms them against everything that happened meanwhile (or CRDT merges). Very long offline divergence may produce surprising merges; show a notice.
- **How do you guarantee convergence?** With server-ordered OT, every client applies the same ops in the same server order after transformation; transformation functions satisfy the required convergence property for this setup.
- **How do comments anchor to text that moves?** Anchors are positions transformed like cursors (or CRDT IDs), so they follow edits.
- **How do you implement undo?** Per-user undo generates inverse ops of that user's own changes, transformed against later ops by others.
- **Why not lock paragraphs?** Locking hurts the real-time experience and fails under network partitions; OT/CRDTs allow free concurrent editing.
