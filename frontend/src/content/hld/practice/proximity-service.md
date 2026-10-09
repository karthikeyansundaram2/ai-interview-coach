A proximity service answers "what businesses are near me?" for apps like Yelp or Google Maps. Business locations change rarely while searches are constant, so the design centres on a read-optimized geospatial index, aggressive caching, and replication.

## Clarify requirements

**Functional**
- Search businesses near a location within a radius (0.5, 1, 2, 5, 20 km), optionally filtered by category and open-now.
- View business details.
- Business owners add, update, or remove listings; changes may appear by the next day (or within minutes as a bonus).
- Out of scope: reviews, photos pipeline, ranking ML (mention as extensions).

**Non-functional**
- 100M DAU, 200M businesses worldwide.
- Search p99 < 200 ms.
- High availability; read-heavy; eventual consistency for business updates is fine.
- Data privacy for user location (do not store precise history unnecessarily).

## Back-of-the-envelope

- Searches: 100M × 5/day = 500M/day → **5k QPS**, peak ~25k QPS.
- Business writes: maybe 100k updates/day → ~1/s. Negligible.
- Business record ~1 KB → 200M × 1 KB = **200 GB** for full details.
- Geo index: (geohash, business_id) pairs ≈ 200M × ~30 B ≈ **6 GB**, small enough to keep entirely in memory on every search server.

## API

```text
GET /v1/search/nearby?lat=13.08&lng=80.27&radius=2000&category=cafe&openNow=true&limit=20&cursor=
  200: { "businesses": [ { "id", "name", "lat", "lng", "distanceM", "rating", "category" } ], "nextCursor" }

GET  /v1/businesses/{id}
POST /v1/businesses           (owner)
PUT  /v1/businesses/{id}      (owner)
DELETE /v1/businesses/{id}
```

## Data model

```text
businesses (relational, primary + read replicas; or sharded by business_id)
  business_id PK, name, lat, lng, address, category, hours, rating, updated_at

geo_index (table or in-memory structure)
  geohash (precision 6, ~1.2 km x 0.6 km) , business_id
  INDEX (geohash)
  (optionally rows at precision 4, 5, 6 to support different radii)
```

Using geohash strings means a plain B-tree index or KV store answers "all businesses in cell X" with a range or key lookup.

## High-level design

```text
 Client --> LB --> Location-based service (LBS, stateless, read-only)
                     |  1. compute geohash for (lat,lng) at precision for radius
                     |  2. get 9 cells (center + 8 neighbours)
                     |  3. fetch business IDs per cell (Redis cache -> geo index replicas)
                     |  4. fetch business summaries (cache), filter by category/open-now
                     |  5. compute exact distance, sort, paginate
                     v
             Redis: geohash -> [business_ids]; business_id -> summary
                     |
             Geo index + businesses DB (read replicas)

 Owners --> Business service --> primary DB --> CDC/nightly job --> rebuild geo index + invalidate cache
```

The LBS is read-only and stateless; the business service handles the rare writes.

## Deep dives

### 1. Choosing the geospatial index

| Option | Pros | Cons |
|---|---|---|
| Geohash in DB/Redis | Simple, works with any KV/B-tree, easy caching per cell | Fixed cell size; boundary issues need neighbour lookup |
| Quadtree in memory | Adapts to density (dense cities split finely) | Must build on each server at startup (minutes for 200M points) and handle updates |
| S2 / H3 cells | Accurate global coverage, multi-resolution | More complex libraries |
| PostGIS R-tree | Rich queries | Single DB becomes the bottleneck at high QPS |

Geohash with neighbour expansion is the simplest strong answer. Choose precision by radius (e.g., precision 6 for ≤ 1 km, 5 for ~5 km, 4 for ~20 km). Querying the centre cell plus 8 neighbours covers the boundary problem; then compute exact haversine distance and discard points outside the radius.

### 2. Handling density differences

In Manhattan, a 1.2 km cell might hold thousands of restaurants; in rural areas, zero. Strategies:
- If too few results, expand to a coarser precision (larger cells) until enough are found or the max radius is reached.
- If too many, filter by category early and rank by distance/rating, returning a page and a cursor.
- A quadtree naturally balances this by splitting cells with more than N businesses; mention it as an alternative.

### 3. Caching and replication

- The entire geo index (~6 GB) fits in memory: each LBS node or a Redis cluster can hold it. Cache `geohash -> business_ids` per precision and `business_id -> summary`.
- Read traffic scales by adding replicas; there are no hot writes.
- Cache by cell, not by exact user coordinates (which almost never repeat).
- Multi-region: replicate the dataset to every region; users hit the nearest.

### 4. Updates propagation

Business edits go to the primary DB. A CDC stream or nightly batch recomputes affected geohash entries and invalidates the relevant cache keys (old cell and new cell if the business moved). Eventual consistency of minutes to a day is acceptable per requirements.

## Bottlenecks & scaling

- **Search QPS**: stateless LBS + in-memory index scales linearly; 25k QPS is a modest fleet.
- **Business details DB**: read replicas and caching; shard by business ID if it grows.
- **Ranking**: once results include rating, popularity, and personalization, add a ranking stage over a few hundred candidates.
- **Hot areas** (tourist centres): their cells are cached everywhere; CDN can cache common public queries keyed by cell + filters.

## Follow-ups the interviewer may ask

- **Why not query `WHERE lat BETWEEN ... AND lng BETWEEN ...`?** A 2D range over two separate indexes still scans a large band; geohash turns it into a few exact key lookups.
- **How do you support "open now"?** Store hours per business; filter after fetching candidates, or precompute an "open" bitmap per hour for fast filtering.
- **How would you handle moving objects like delivery drivers?** That's a different, write-heavy problem: in-memory location store with TTLs and frequent updates (see ride matching).
- **How do you paginate?** Cursor encoding the last distance and business ID for the current query; results are recomputed or cached per query for a short time.
- **What about privacy?** Don't log precise user coordinates long-term; truncate or bucket them for analytics.
