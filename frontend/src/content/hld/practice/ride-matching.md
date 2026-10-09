A ride-hailing service like Uber tracks millions of moving drivers and, within seconds, matches each ride request to a suitable nearby driver. It combines a very high write rate of location updates with a matching step that must never assign one driver to two riders.

## Clarify requirements

**Functional**
- Drivers send location updates while online.
- Riders request a ride from pickup to destination and see an ETA and price estimate.
- System matches the rider with a nearby available driver; driver accepts or declines.
- Both see each other's live location during the trip; trip lifecycle (accepted, arrived, started, completed).
- Out of scope: payments details, surge pricing model, ratings (mention as integrations).

**Non-functional**
- 5M active drivers at peak, 20M rides/day.
- Match within ~5–10 seconds; location freshness within ~5 s.
- A driver is never matched to two rides at once (strong consistency on assignment).
- Highly available per city/region; degrade gracefully.

## Back-of-the-envelope

- Location updates: 5M drivers every 4 s → **1.25M updates/s**. This is the dominant load.
- Each update ~100 B → 125 MB/s ingress.
- Ride requests: 20M/day ÷ 10^5 ≈ **200/s** average, peaks ~2k/s (concerts, rain, New Year).
- Live location storage: 5M × 100 B = **500 MB**: fits in memory easily (sharded for throughput, not size).
- Location history for analytics: 1.25M × 86,400 × 100 B ≈ 10 TB/day → stream to a data lake, not an OLTP DB.

## API

```text
Driver (persistent connection, WebSocket/gRPC stream):
  location { driverId, lat, lng, heading, speed, ts, status: AVAILABLE|ON_TRIP|OFFLINE }
  offer    <- { rideId, pickup, expiresInSec }
  respond  { rideId, accept: true/false }

Rider:
  POST /v1/rides/estimate   { pickup, dropoff } -> { etaSec, priceRange }
  POST /v1/rides            { pickup, dropoff, product, idempotencyKey } -> { rideId, status: MATCHING }
  GET  /v1/rides/{id}       (or live updates over WebSocket: driver location, status)
  POST /v1/rides/{id}/cancel
```

## Data model

```text
Live location index (in memory, sharded by geo cell, e.g. H3 resolution 8-9):
  cell_id -> { driverId -> (lat, lng, ts, status, vehicle type) }
  driver_cell (KV): driverId -> current cell, last ts   (TTL ~30 s)

Drivers (DB): driver_id, vehicle, status, current_ride_id, version
Rides (DB, sharded by ride_id or city):
  ride_id, rider_id, driver_id, status, pickup, dropoff, timestamps, fare, version
Location history: Kafka -> data lake
```

## High-level design

```text
 Drivers <==stream==> Gateway --> Location service --(update in-memory cell index)--> Geo index shards
                                       |                                             (by city/cell)
                                       +--> Kafka "driver.locations" --> history, ETA models, surge

 Rider --> API --> Ride service --(create ride MATCHING)--> Rides DB
                        |
                        v
                  Matching service (per city/region partition)
                    1. query geo index: available drivers in nearby cells
                    2. rank by ETA (routing service), vehicle type, driver score
                    3. reserve best driver (atomic), send offer
                    4. accept -> assign ride; decline/timeout -> next candidate
                        |
                        v
                  Trip service: live updates to rider (driver location relayed via gateway)
```

## Deep dives

### 1. Ingesting 1.25M location updates per second

- Updates go over persistent connections to gateways, then to location service nodes partitioned by geography (city → cells). Each node holds its cells' drivers in memory and updates a hash map entry: O(1) per update.
- When a driver crosses a cell boundary, remove them from the old cell and add to the new one (both usually on the same node; cross-node moves are handled by the owner of the new cell).
- No disk write on the hot path; updates are published to Kafka asynchronously for history and analytics.
- Stale entries expire: if no update for ~30 s, the driver is treated as offline.
- Alternative: Redis GEO (geohash-encoded sorted sets) per city shard; fine at moderate scale, but custom in-memory cells handle higher rates.

### 2. Finding candidates

Convert the pickup point to its cell, take that cell plus k rings of neighbours (H3's hexagonal rings make this natural), collect AVAILABLE drivers matching the product type, and expand rings until there are enough candidates or a max radius is reached. Straight-line distance is a poor proxy for arrival time (rivers, one-way streets), so rank the top ~10–20 candidates by road ETA from a routing service, with cached travel-time estimates per cell pair to stay fast.

### 3. Assignment without double booking

Several matchers (or concurrent requests) may pick the same driver. Use an atomic reservation:

```text
UPDATE drivers SET status='RESERVED', ride_id=:ride, version=version+1
 WHERE driver_id=:d AND status='AVAILABLE' AND version=:v
```

(or a Redis `SET driver_lock:{d} ride NX PX 15000`). Only one wins; the loser tries the next candidate. The offer has a timeout (~10–15 s); on decline or timeout, release the reservation and move on. Partitioning matching by city/region lets one matcher instance own a region, reducing contention further, with the conditional write as the safety net. Ride creation uses an idempotency key so rider retries don't create duplicate rides.

### 4. Batch matching

Greedy "nearest driver to each request" is locally optimal but globally poor in busy areas. Many systems accumulate requests for 1–2 seconds per region and solve an assignment problem (minimize total ETA) over requests × drivers. This trades a tiny delay for better overall pickup times.

## Bottlenecks & scaling

- **Location ingestion**: scale by geographic partitioning; hot cities get more partitions (split cells).
- **Hot spots** (stadium exit): many requests in one cell; batch matching and per-cell sharding of the matcher.
- **Routing/ETA service**: heavily cached; precomputed cell-to-cell ETAs refreshed with traffic data.
- **Failover**: if a region's matching node dies, another node takes ownership of its cells (leases); in-memory locations rebuild within seconds from the next round of driver updates.
- **Multi-region**: cities are independent; deploy per region for latency and blast radius.

## Follow-ups the interviewer may ask

- **How do riders see the driver moving?** The trip service subscribes to the assigned driver's location stream and forwards updates to the rider's connection every few seconds.
- **How does surge pricing fit in?** A streaming job computes supply (available drivers) and demand (requests) per cell per minute and outputs multipliers used by the estimate API.
- **What if the driver's app loses connectivity mid-trip?** The trip continues server-side; the app buffers locations and syncs on reconnect; ETA updates degrade gracefully.
- **Why not store locations in a relational DB with a spatial index?** 1.25M updates/s of overwrite-heavy, short-lived data would crush it; memory with TTL is the right tool.
- **How do you prevent drivers gaming location?** Validate speed/jumps, cross-check with GPS signal quality, and flag anomalies.
