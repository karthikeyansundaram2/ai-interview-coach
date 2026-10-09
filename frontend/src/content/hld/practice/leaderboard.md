A game leaderboard ranks players by score and answers "who is in the top 100?" and "what is my rank?" instantly, even with millions of players updating scores constantly. The heart of the problem is ranking, which sorted data structures make cheap and relational queries make expensive.

## Clarify requirements

**Functional**
- Update a player's score when a match ends (increment or set best score).
- Get the top N players (N ≤ 100).
- Get a player's rank and score, plus the players just above and below.
- Leaderboards per game and per season (monthly reset); optionally friends-only and regional boards.

**Non-functional**
- 50M monthly active players, 10M daily active.
- Score updates visible in the leaderboard within about a second.
- Reads p99 < 50 ms.
- Scores must not be lost; leaderboard can be rebuilt from durable data.
- Ties broken by who reached the score first.

## Back-of-the-envelope

- Matches: 10M DAU × 10 matches/day = 100M score updates/day → **~1,000 updates/s**, peak ~5k/s.
- Reads: players check the board after each match and in menus: ~5x updates → **~5k–25k reads/s**.
- Memory per entry in a Redis sorted set: roughly 100 bytes including overhead → 50M players × 100 B ≈ **5 GB** per board. Fits on one large Redis node, with replicas.
- Seasonal boards multiply this, but older seasons can be archived.

## API

```text
POST /v1/leaderboards/{boardId}/scores
  body: { "playerId": "p123", "delta": 25, "matchId": "m987" }   (matchId for idempotency)
  200: { "score": 1520, "rank": 18342 }

GET /v1/leaderboards/{boardId}/top?limit=100
GET /v1/leaderboards/{boardId}/players/{playerId}?around=5
  200: { "rank": 18342, "score": 1520, "neighbors": [...] }
```

Score submissions should come from the trusted game server, not the client, to prevent cheating.

## Data model

```text
Durable store (Postgres or DynamoDB):
  match_results(match_id PK, player_id, board_id, delta, created_at)
  player_scores(board_id, player_id) PK -> score, updated_at

Redis sorted set per board:
  key: lb:{game}:{season}
  member: player_id
  score: composite = points * 2^20 + (MAX_TS - reached_at_seconds_bucket)   (tie-break)
```

Redis sorted sets are skip lists plus hash maps: `ZINCRBY` and `ZADD` are O(log n), `ZREVRANK` is O(log n), and `ZREVRANGE 0 99` is O(log n + 100).

Tie-breaking: encoding "earlier is better" into the low bits of the score keeps one sort key. Redis scores are doubles with 53 bits of exact integer precision, so budget bits carefully (e.g., 32 bits for points, 21 bits for a coarse time bucket).

## High-level design

```text
 Game servers --match result--> Score API --(1) write match_result + player_score (txn)--> Postgres
                                      |
                                      +--(2) ZINCRBY lb:game:season --> Redis primary --> replicas
                                      |
 Clients --GET top / my rank--> Leaderboard API --> Redis replicas (reads)
                                      |
                                      +--> Player profile cache (names, avatars)

 Postgres --CDC/outbox--> rebuild job (if Redis is lost)
```

**Update path**: the score API writes the match result idempotently (unique match_id) and updates the durable player score in one transaction, then applies the increment to Redis. If the Redis update fails, a retry from the outbox or a reconciliation job fixes it.

**Read path**: `ZREVRANGE` for top N; `ZREVRANK` + `ZSCORE` for a player, and `ZREVRANGE rank-5 rank+5` for neighbours. Player display data is joined from a profile cache. The top 100 can be cached for one second, since it is requested by everyone.

## Deep dives

### 1. Why not SQL?

`SELECT COUNT(*) FROM scores WHERE score > :myScore` is O(n) per rank lookup — 50M rows scanned per request, at thousands of requests per second. Even with an index, counting rows above a value is linear in the result. Sorted sets maintain rank incrementally. SQL remains the system of record; Redis is the ranking index.

### 2. Scaling beyond one Redis node

5 GB per board fits on one node, and ~25k reads/s is easily served by a primary plus replicas. If a board grows to hundreds of millions of players or write rates exceed ~100k/s:

| Option | How | Trade-off |
|---|---|---|
| Shard by score range | Shard 0 holds scores 0–999, shard 1 1000–1999… rank = local rank + counts of higher shards | Exact; range boundaries need rebalancing as scores grow |
| Shard by player hash | Each shard has a sorted set; top N = merge top N from each shard | Top N is easy; exact rank needs a count from every shard (scatter-gather) |
| Approximate rank for tail | Exact rank for top 10k; percentile buckets (histogram) for others | "Top 3%" is good enough for most players |

Many real games show exact ranks for the top players and percentiles beyond that.

### 3. Durability and recovery

Redis persistence (AOF every second) plus replicas covers most failures, but the leaderboard is derived data: it can always be rebuilt by streaming `player_scores` from the durable store into a new sorted set (50M `ZADD`s in pipelined batches takes a few minutes). During a rebuild, serve the last snapshot.

### 4. Seasons and resets

Use a new key per season (`lb:game:2026-10`) rather than deleting data at midnight. The old key becomes read-only, is snapshotted to the database/object storage for history, and expires later. No downtime and no thundering delete.

## Bottlenecks & scaling

- **Hot reads of top 100**: cache the result for 1 s in the API tier; it's identical for everyone.
- **Write bursts at tournament end**: queue score updates (Kafka) and apply them in batches with pipelining; Redis handles ~100k+ ops/s per node.
- **Friends leaderboards**: for a player with 200 friends, fetch their scores with `ZMSCORE` and sort in memory; no separate sorted set needed.
- **Regional boards**: separate sorted sets per region; update both global and regional on each match.
- **Anti-cheat**: only accept scores from game servers, validate plausibility, and keep match records for audit.

## Follow-ups the interviewer may ask

- **How do you handle ties?** Encode a tie-breaker (earlier achievement time) in the score's low bits, or store a secondary ordering key.
- **What if Redis loses data?** Rebuild from the durable player_scores table; it's derived data.
- **How do you prevent double-counting a match?** Unique match_id in the durable store; only apply the Redis increment once the insert succeeds (or use a `SET NX` dedup key in Redis with TTL).
- **How would you show a daily leaderboard?** A separate sorted set per day with a TTL; increment both daily and all-time keys.
- **Can you support 1B players?** Shard by score range or player hash and provide approximate percentiles for non-top players.
