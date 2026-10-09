"Find restaurants within 2 km" sounds simple, but a normal index sorts along one dimension and location has two. Geohashes, quadtrees, and similar cell systems turn a 2D proximity question into a handful of 1D lookups that ordinary databases and caches handle well.

## The analogy

Think of a city map divided into a grid of named squares. To find nearby cafés, you check your own square and the eight around it, rather than measuring the distance to every café in the country. Finer grids give smaller squares, like zooming in on the map.

## Why a plain index fails

An index on `(lat, lng)` can narrow by latitude, but within that latitude band it must scan every longitude. With hundreds of millions of points, a bounding-box query still touches far too many rows.

## Geohash

Geohash recursively splits the world in half, alternating longitude and latitude, recording a bit each time, then encodes the bits in base32.

```text
Precision (chars)  Approx cell size
4                  39 km x 20 km
5                  4.9 km x 4.9 km
6                  1.2 km x 0.6 km
7                  153 m x 153 m
8                  38 m x 19 m

Nearby points share prefixes: tdr1y..., tdr1w..., tdr1v...
```

- A point becomes a string; nearby points usually share a prefix, so a prefix query is a B-tree range scan, and cells map neatly onto cache keys or partition keys.
- **Edge problem**: two points close together can sit on opposite sides of a cell boundary with completely different prefixes. Always query the target cell plus its **8 neighbours**, then filter by exact distance.
- To search a radius, choose a precision whose cell is about the radius size, compute the 9 cells, fetch candidates, and compute real distances (haversine).

## Quadtree

A quadtree recursively splits a region into four quadrants until each leaf holds at most N points (for example 100).

```text
+---------------+---------------+
|               |       |  ...  |
|   sparse:     +-------+-------+
|   one leaf    | dense | dense |
|               |  ++   |  ++   |
+---------------+---------------+
Dense downtown areas split deeply; empty areas stay as one large leaf.
```

- **Adapts to density**: cities get small cells, oceans stay coarse. Each leaf holds a manageable number of points.
- Typically built in memory on each server from the database (hundreds of millions of points fit in tens of GB) and rebuilt periodically or updated incrementally.
- Query: descend to the leaf containing the user, then expand to neighbouring leaves until enough results are found.

## Other systems

- **Google S2**: projects the sphere onto a cube and indexes cells along a Hilbert curve, giving 64-bit cell IDs with good locality and accurate cell coverings for arbitrary regions.
- **Uber H3**: hexagonal cells; hexagons have uniform neighbour distances, which helps for aggregation such as surge pricing.
- **R-trees**: bounding-rectangle trees used by PostGIS, good for polygons as well as points.

## Comparison

| | Geohash | Quadtree | S2 / H3 | R-tree (PostGIS) |
|---|---|---|---|---|
| Storage | String column + B-tree | In-memory tree | Integer cell IDs | DB index |
| Adapts to density | No (fixed precision) | Yes | Multi-resolution | Yes |
| Updates | Trivial (recompute hash) | Rebalancing needed | Trivial | Handled by DB |
| Best for | Simple proximity search, caching, sharding | Static points with uneven density | Large-scale geo, aggregation | Rich geo queries on one DB |

## Static vs moving points

- **Businesses (Yelp)**: rarely change; read-heavy. Precompute geohash or a quadtree, replicate widely, cache cell results.
- **Drivers (Uber)**: update every few seconds. Keep locations in memory (for example Redis GEO, which uses geohash-encoded sorted sets, or an in-memory grid keyed by H3 cell), with TTLs so stale drivers vanish, and avoid writing every ping to a disk-based index.

## Common mistakes

- Querying only the user's own cell and missing results just across the boundary.
- Fixed geohash precision in both dense cities and empty regions, giving too many or too few candidates; widen or narrow adaptively.
- Ranking by cell rather than by actual distance.
- Writing high-frequency location updates into a relational spatial index.

## In the interview

**Q: How do you find businesses within 1 km?**
Compute the user's geohash at precision 6, fetch businesses in that cell and its 8 neighbours from an index or cache, compute exact distances, filter to 1 km, and rank.

**Q: Geohash or quadtree?**
Geohash is simpler to store and shard and works with any key-value store or B-tree. A quadtree adapts to density, giving balanced result sizes, but must live in memory and be rebuilt or updated carefully.

**Q: How would you store live driver locations?**
In memory, keyed by cell (geohash or H3), with per-driver TTLs, sharded by region. Persist location history asynchronously through a stream for analytics.

## Key takeaways

- Geospatial indexes map 2D locations to 1D cells that normal indexes can range-scan.
- Geohash: prefix-based cells; always include neighbouring cells.
- Quadtrees adapt to density; S2 and H3 offer hierarchical cells at global scale.
- Separate static point search from high-frequency moving-object tracking.
