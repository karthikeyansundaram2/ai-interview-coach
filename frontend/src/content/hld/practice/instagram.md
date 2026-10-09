Instagram combines three systems: a media upload and processing pipeline, a social graph, and a feed. A strong answer focuses on getting bytes in and out efficiently (presigned uploads, transcoding, CDN) and reuses news-feed ideas for the timeline.

## Clarify requirements

**Functional**
- Upload photos (and short videos) with captions.
- Follow users; view a home feed of followed users' posts.
- View a user's profile grid.
- Like and comment (counts shown on posts).
- Out of scope: stories, DMs, reels ranking, search (mention as extensions).

**Non-functional**
- 500M DAU; 100M uploads/day.
- Feed loads in < 300 ms; images load fast globally.
- Uploads must be durable once acknowledged; processing can take seconds.
- Read-heavy: views vastly outnumber uploads.
- Eventual consistency acceptable for feeds, counts.

## Back-of-the-envelope

- Uploads: 100M/day ÷ 10^5 ≈ **1,000 uploads/s**, peak ~3k/s.
- Original size ~3 MB; we store originals plus ~4 resized variants (~1 MB total) → ~4 MB per photo → **400 TB/day**, ~146 PB/year before replication. Object storage, with older originals moved to colder tiers.
- Views: 500M users × 100 images/day = 50B/day → **500k image requests/s**. At ~150 KB per feed-sized image → **75 GB/s** egress. CDN is mandatory.
- Feed reads: 500M × 10/day ≈ **50k/s**.
- Likes: 500M × 20/day = 10B/day → **100k likes/s**: the hottest write path.

## API

```text
POST /v1/media/uploads         { "contentType": "image/jpeg", "size": 3145728 }
  -> { "mediaId": "m1", "uploadUrl": "<presigned PUT>", "expiresIn": 900 }
POST /v1/posts                 { "mediaIds": ["m1"], "caption": "..." } -> { "postId" }
GET  /v1/feed?cursor=...
GET  /v1/users/{id}/posts?cursor=...
POST /v1/posts/{id}/likes      DELETE /v1/posts/{id}/likes
POST /v1/posts/{id}/comments   { "text": "..." }
GET  /v1/posts/{id}/comments?cursor=...
```

## Data model

```text
media:     media_id PK, owner_id, status (UPLOADING|PROCESSING|READY|FAILED), original_key, variants{size->key}, w, h
posts:     (author_id) partition, post_id clustering desc -> caption, media_ids, created_at
follows:   followers(followee_id -> follower_id), following(follower_id -> followee_id)
likes:     (post_id) partition, user_id clustering -> created_at   (+ user_likes(user_id, post_id) for "did I like it")
like_counts: post_id -> count (sharded counter, cached)
comments:  (post_id) partition, comment_id desc -> author_id, text
feed cache: feed:{user_id} -> recent post_ids (Redis)
```

Posts, likes, and comments are high-volume and accessed by key and time, so a wide-column store (Cassandra) or DynamoDB fits. User accounts and relationships with uniqueness constraints can live in a sharded relational DB.

## High-level design

```text
            (1) request upload URL                       (3) ObjectCreated event
 Client ---------------------------> Media API ---------------------------------+
   |                                    |                                       v
   | (2) PUT bytes directly             | create media row (UPLOADING)   Kafka "media.uploaded"
   v                                    v                                       |
 Object storage (originals) <------------------------------------ Processing workers
   |                                                         (validate, strip EXIF, resize,
   |                                                          WebP/AVIF, moderation scan)
   v                                                                    |
 Object storage (variants) --> CDN <-- Clients fetch images              v
                                                              media status READY

 Client --POST /posts--> Post service --> Posts DB --> Kafka "post.created" --> Fan-out workers --> Feed cache
 Client --GET /feed--> Feed service --> feed cache + celebrity pull --> hydrate (post, user, counts caches)
 Likes --> Like service --> likes DB + Kafka --> counter aggregator --> like_counts + cache
```

## Deep dives

### 1. Upload and processing pipeline

- Presigned URLs keep 3 MB uploads off application servers; mobile clients use multipart/resumable uploads on poor networks.
- The client creates the post referencing the media ID; the post becomes visible when media is READY (or the client shows a local preview while processing).
- Workers generate fixed variants (e.g., 150 px thumbnail, 640, 1080) in modern formats; resizing is CPU-heavy, so autoscale workers on queue lag. Videos go to a transcoding pipeline.
- Content-addressed variant keys (hash in the name) allow long CDN TTLs and immutability.
- Idempotent processing: re-running for the same media ID overwrites the same keys.

### 2. Feed generation

Reuse the hybrid fan-out model: push post IDs into followers' Redis feeds for normal accounts; pull and merge celebrity posts at read time; skip inactive users. Feeds hold IDs; hydration batch-fetches posts, author profiles, and counts from caches. Ranking can be added as a re-ranking stage over a few hundred candidates.

### 3. Likes at 100k/s

- Write each like to the likes table (idempotent by `(post_id, user_id)` primary key, so double taps don't double count).
- Don't increment a single counter row synchronously: viral posts would create a hot key. Publish like events to Kafka; an aggregator batches increments per post every second and updates `like_counts`.
- Counts are eventually consistent; the client optimistically shows its own like immediately.
- For "did I like this?" on feed hydration, check `user_likes` or a per-user Bloom filter/cache of recent likes.

### 4. Serving images globally

The CDN handles ~95%+ of image requests. Use responsive variants (the client asks for the size it needs), modern formats, and an origin shield. Private accounts' media uses signed URLs with expiry.

## Bottlenecks & scaling

- **Storage cost**: lifecycle policies move originals older than 90 days to infrequent-access or archive tiers; variants stay hot.
- **Processing spikes** (New Year's Eve): queue absorbs the burst; prioritize thumbnail generation first so posts appear quickly.
- **Hot posts**: cache post objects and counts in-process; sharded counters.
- **Sharding**: posts by author ID, likes and comments by post ID, feeds by user ID.
- **Multi-region**: uploads go to the nearest region; media replicated asynchronously; metadata replicated with a home-region model.

## Follow-ups the interviewer may ask

- **How do you handle duplicate uploads?** Client sends an idempotency key; optionally hash content to deduplicate storage.
- **How do you moderate content?** Async ML classification in the processing pipeline; borderline content is hidden pending human review.
- **How would you add Stories?** Separate store with 24-hour TTL, a "stories tray" built from followees with active stories, and aggressive prefetching of the first frames.
- **How do you keep the profile grid fast?** Query posts by author ID partition (single partition, time-ordered) and cache the first page.
- **How do you delete a post?** Mark it deleted (tombstone in post cache), let hydration filter it, then asynchronously delete media and purge CDN.
