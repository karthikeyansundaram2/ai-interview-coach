A news feed shows each user a list of recent posts from the people they follow, ranked and paginated. The central question is when to do the work of assembling feeds: at write time, at read time, or a mix, especially when some authors have millions of followers.

## Clarify requirements

**Functional**
- Users create posts (text, optional media references).
- Users follow/unfollow others.
- Home feed: posts from followed accounts, newest or ranked first, paginated (infinite scroll).
- Out of scope: comments, ads, search, notifications (mention as extensions).

**Non-functional**
- 300M DAU, 1B total users; average 200 follows; some accounts have 50M+ followers.
- Feed load p99 < 300 ms.
- New posts appear in followers' feeds within a few seconds (eventual consistency is fine).
- Highly available reads; occasional staleness acceptable.

## Back-of-the-envelope

- Posts: 300M × 1 post every 2 days ≈ 150M/day → **~1,500 posts/s**, peak ~5k/s.
- Feed reads: 300M × 10 opens/day = 3B/day → **~30k feed reads/s**, peak ~100k/s.
- Fan-out on write: 1,500 posts/s × average 200 followers = **300k feed inserts/s**. Celebrity posts are the problem: one 50M-follower post = 50M inserts.
- Feed cache: store 500 post IDs per user × 8 B (plus overhead ~16 B) ≈ 8 KB/user; for 300M active users ≈ **2.4 TB** in a Redis cluster (sharded, plus replicas).
- Posts storage: 150M/day × 1 KB ≈ 150 GB/day of metadata; media separately in object storage.

## API

```text
POST /v1/posts                 { "text": "...", "mediaIds": [...] }   -> 201 { postId }
POST /v1/users/{id}/follow     DELETE /v1/users/{id}/follow
GET  /v1/feed?cursor=<opaque>&limit=20
  200: { "items": [ { post, author, counts } ], "nextCursor": "..." }
```

## Data model

```text
posts (wide-column / KV, partitioned by author_id, clustered by post_id desc)
  author_id, post_id (Snowflake, time-ordered), text, media_refs, created_at

follows (two tables for both directions)
  followers: (followee_id) -> follower_id ...
  following: (follower_id) -> followee_id ...

feed cache (Redis, per user): feed:{user_id} -> list/sorted set of post_ids (cap 500)

users: user_id -> profile, follower_count, is_celebrity flag
```

Time-ordered Snowflake post IDs mean sorting by ID sorts by time, which simplifies merging and cursors.

## High-level design

```text
 Client --POST--> LB --> Post service --> Posts DB
                              |
                              +--> Kafka "post.created"
                                         |
                                  Fan-out workers --(get followers in pages)--> Follows DB
                                         |
                                         +--> ZADD feed:{follower} post_id (Redis feed cache)

 Client --GET /feed--> LB --> Feed service
                                 1. read feed:{me} (post IDs)
                                 2. merge with recent posts of followed celebrities (pull)
                                 3. rank / filter (blocked, deleted)
                                 4. hydrate: post cache + user cache (multi-get)
                                 5. return page + cursor
 Media served from CDN.
```

## Deep dives

### 1. Fan-out on write vs on read vs hybrid

| Approach | Write cost | Read cost | Problem |
|---|---|---|---|
| Push (fan-out on write) | O(followers) per post | One cache read | Celebrities: 50M writes per post; wasted work for inactive followers |
| Pull (fan-out on read) | O(1) | Fetch recent posts from each of ~200 followees and merge | Slow reads at 100k/s × 200 lookups |
| Hybrid | Push for normal authors; pull for celebrities | Cache read + a few celebrity lookups | More logic, but best of both |

Hybrid is the standard answer: authors above a threshold (say 100k followers) are not fanned out. At read time, the feed service fetches the user's precomputed feed plus the latest posts from the (few) celebrities they follow, which are themselves heavily cached, and merges by post ID. Also skip fan-out to users inactive for 30+ days; build their feed on demand when they return.

### 2. Feed cache design

- Store only post IDs (and maybe author ID and score), not full posts, to keep memory small and avoid invalidating copies when posts are edited.
- Cap at ~500 entries; older pages fall back to a pull-based query.
- Hydrate with multi-get against a post cache and user cache; these are hot and highly cacheable.
- Deleted posts: filter at hydration time (tombstone in post cache) rather than removing from millions of feeds.

### 3. Ranking

Start with reverse chronological. For ranked feeds, retrieve a candidate set (a few hundred IDs from cache and celebrity pulls), compute features (author affinity, engagement, recency), score with a model, and return the top items. Precompute heavy features offline; keep online scoring within ~50 ms. Cursor pagination over a ranked list needs a stable snapshot: store the ranked list for the session briefly, or paginate by score + ID.

### 4. Follow/unfollow consistency

On follow, backfill the follower's feed with the followee's recent posts (async). On unfollow, filter at read time and lazily purge. Both are eventually consistent within seconds, which is acceptable.

## Bottlenecks & scaling

- **Fan-out workers**: 300k inserts/s spread across Kafka partitions and a Redis cluster with pipelined writes; autoscale on lag. Prioritize fan-out to recently active users.
- **Redis feed cluster**: shard by user ID; replicas for read availability. If a shard is lost, rebuild feeds on demand via pull.
- **Hot celebrity posts**: cached in-process on feed servers for a few seconds.
- **Posts DB**: partitioned by author ID; celebrity "recent posts" reads are served from cache.
- **Multi-region**: replicate posts and follows asynchronously; each region maintains its own feed caches.

## Follow-ups the interviewer may ask

- **How do you handle a user following 5,000 accounts?** Cap the merge set for pull, rely on push for most, and rank only a bounded candidate set.
- **What if the fan-out lags during a spike?** Feeds are slightly stale; read-time merging of very recent posts from close connections can patch the gap.
- **How do you insert ads?** A separate ads service returns ad candidates, blended into the ranked list at fixed slots.
- **How does an edit or delete propagate?** Feeds store IDs only; hydration reads the latest post or a tombstone.
- **How would you measure success?** Feed load latency, freshness lag (post to visible), engagement metrics, and fan-out queue lag.
