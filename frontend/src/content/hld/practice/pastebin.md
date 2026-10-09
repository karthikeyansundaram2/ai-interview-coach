Pastebin lets users store a block of text and share it via a link, optionally private or self-destructing. It looks like a URL shortener, but the payload is much larger, which shifts the design toward object storage and CDN delivery.

## Clarify requirements

**Functional**
- Create a paste (text up to 10 MB) and receive a unique URL.
- View a paste by URL, including a raw view.
- Optional expiry (10 minutes, 1 day, 1 month, never) and "burn after reading".
- Visibility: public, unlisted (anyone with the link), private (owner only).
- Out of scope: editing, syntax-highlighting service details, comments.

**Non-functional**
- 10M new pastes per day; read:write about 10:1.
- Low read latency globally (p99 < 200 ms for typical sizes).
- Durable: a paste never disappears before expiry.
- Unlisted pastes must not be guessable.

## Back-of-the-envelope

- Writes: 10M / 10^5 s ≈ **100 writes/s**, peak ~500/s.
- Reads: **1,000 reads/s**, peak ~5k/s.
- Average paste size: ~10 KB (most are small; a few are megabytes).
- Content storage: 10M × 10 KB = **100 GB/day**, ~36 TB/year.
- Metadata: 10M × 300 B = 3 GB/day, about 1 TB/year: easy for a sharded DB or a KV store.
- Egress: 1,000/s × 10 KB = 10 MB/s average; trivial, but spiky for viral pastes.
- Keys: base62, 8 characters → 62^8 ≈ 2 × 10^14, ample space and hard to guess at random.

## API

```text
POST /v1/pastes
  body: { "content": "...", "expiresIn": "1d", "visibility": "unlisted", "burnAfterRead": false, "language": "python" }
  201: { "id": "Xk29PqLm", "url": "https://paste.example/Xk29PqLm" }

For large content (> 1 MB):
POST /v1/pastes/uploads -> { "id", "uploadUrl" (presigned PUT) }
client PUTs content directly to object storage, then POST /v1/pastes/{id}/complete

GET /v1/pastes/{id}         -> metadata + content (or contentUrl for large pastes)
GET /raw/{id}               -> text/plain
DELETE /v1/pastes/{id}      -> owner only
```

## Data model

```text
pastes (KV or relational, partitioned by id)
  id              PK (8-char random base62)
  owner_id        nullable
  object_key      e.g. "pastes/Xk/29/Xk29PqLm"
  size_bytes
  language
  visibility      public | unlisted | private
  burn_after_read bool
  created_at
  expires_at      nullable (TTL index)

Object storage: object_key -> compressed content (gzip/zstd)
```

Small pastes (under ~4 KB) could be stored inline in the metadata row to save an extra fetch; everything else lives in object storage.

## High-level design

```text
 Client --> CDN (public/unlisted, cacheable) --> LB --> Paste API
                                                         |    |
                                         metadata  <-----+    +-----> Object storage (S3)
                                       (DynamoDB/                          ^
                                        Postgres)                          |
                                            |                     presigned upload (large)
                                            v
                                   Cleanup worker (expired, burned)
```

**Write path**: the API generates a random ID, compresses the content, stores it in object storage, then writes the metadata row with a conditional "not exists" check (retry with a new ID on the rare collision). Large pastes upload directly via presigned URL so API servers don't stream megabytes.

**Read path**: the CDN serves cached public and unlisted pastes. On a miss, the API reads metadata (cached in Redis), checks visibility and expiry, fetches content from object storage (or returns a short-lived signed URL), and sets cache headers.

## Deep dives

### 1. Why object storage, not the database

Storing 36 TB/year of text blobs in a database bloats storage, backups, and replication, and makes the DB the bottleneck for large reads. Object storage is cheaper per GB, scales automatically, and pairs with CDNs. The database keeps only small, queryable metadata. Compression (text compresses 3–10x) cuts storage and egress substantially.

### 2. Expiry and burn-after-read

- **Expiry**: enforce on read (`now > expires_at` → 404) so correctness doesn't depend on cleanup timing. Physical deletion runs later: database TTL deletes metadata, and object storage lifecycle rules or a cleanup worker remove content. Set CDN cache TTL no longer than the remaining lifetime.
- **Burn after reading**: the first read must atomically mark the paste consumed so two concurrent readers can't both see it. Use a conditional update (`SET burned = true WHERE burned = false`), return content only to the winner, mark the response `Cache-Control: no-store`, and delete the object asynchronously. Never cache these at the CDN.

### 3. Privacy and unguessable IDs

Unlisted pastes rely on secrecy of the ID, so IDs must be random (from a CSPRNG), not sequential. With 62^8 possible IDs and ~3.6B pastes per year, random guessing hits a valid ID with probability around 1 in 50,000 per guess, so add rate limiting on 404s per IP. Private pastes require authentication; serve them with `Cache-Control: private` or via signed URLs, never from the shared CDN cache.

### 4. Viral pastes

A paste linked from a popular site might get 50k views/s. The CDN absorbs this if the paste is cacheable; set `s-maxage` of minutes plus `stale-while-revalidate`. Metadata for hot IDs is cached in Redis and in-process.

## Bottlenecks & scaling

- **Metadata store**: ~100 writes/s and a few thousand reads/s is modest; partition by ID for growth. A KV store with native TTL simplifies expiry.
- **Object storage**: effectively unlimited; use key prefixes spread by ID characters.
- **API tier**: stateless, horizontally scaled; large uploads bypass it.
- **Abuse**: rate limit creation per IP/account, cap size, scan content asynchronously for malware or leaked credentials, and support takedowns that purge the CDN.
- **Cost**: move pastes older than 30 days to infrequent-access storage via lifecycle rules.

## Follow-ups the interviewer may ask

- **How is this different from a URL shortener?** Payloads are kilobytes to megabytes instead of a URL, so content goes to object storage and CDN delivery matters; expiry and privacy are first-class features.
- **How would you add editing?** Store versions as new objects (`id/v2`), point metadata to the latest version, and invalidate the CDN on update.
- **How do you count views?** Emit async view events to a stream and aggregate; CDN logs can supply counts for cached hits.
- **What about search over public pastes?** Index public pastes asynchronously into a search cluster via an event stream; unlisted and private pastes are never indexed.
- **Could you deduplicate identical pastes?** Use a content hash as the object key and reference-count it, saving storage for repeated content, but be careful that deletion of one paste doesn't remove shared content.
