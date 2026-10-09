A ticket booking platform like BookMyShow or Ticketmaster sells seats for movies, concerts, and matches. Normal days are easy; the real problem is a hot on-sale where hundreds of thousands of fans compete for a few thousand seats, and the system must never sell the same seat twice.

## Clarify requirements

**Functional**
- Browse events/shows by city, venue, date; view a seat map with availability.
- Select seats and hold them for a few minutes while paying.
- Complete payment and receive a confirmed booking (e-ticket).
- Holds expire automatically if payment is not completed.
- Cancel/refund per policy.
- Out of scope: dynamic pricing, resale marketplace (extensions).

**Non-functional**
- 50M MAU; normal peak a few thousand bookings/min.
- Flash sales: 1M users arriving within minutes for a 50k-seat concert.
- **No double booking** (strong consistency on seat inventory).
- Browsing highly available and fast; seat map slightly stale is acceptable, final booking must be correct.
- Fairness during flash sales; bot resistance.

## Back-of-the-envelope

- Normal: 10M bookings/month ÷ 2.5 × 10^6 s ≈ **4 bookings/s**, browsing maybe 2k QPS.
- Flash sale: 1M users × refreshing seat maps every few seconds → **100k–300k QPS** on availability reads; seat hold attempts maybe **20k/s** at the opening moment, almost all contending for the same 50k seats.
- Inventory data: a venue with 50k seats × 50 B per seat status = 2.5 MB per show: tiny. The challenge is contention, not size.
- Bookings: 120M/year × 1 KB ≈ 120 GB/year.

## API

```text
GET  /v1/events?city=chennai&date=...
GET  /v1/shows/{showId}/seats            -> seat map with status (AVAILABLE|HELD|BOOKED), cacheable ~1-2 s
POST /v1/shows/{showId}/holds            { "seatIds": ["A12","A13"], "idempotencyKey": "..." }
  201: { "holdId", "expiresAt" }   409: seats unavailable
POST /v1/holds/{holdId}/checkout         { "paymentMethod": ... } -> { "paymentIntent" / redirect }
POST /v1/payments/webhook                (from payment gateway)
GET  /v1/bookings/{bookingId}
DELETE /v1/holds/{holdId}
```

## Data model

```text
events, venues, shows (relational; show_id, venue_id, start_time, pricing tiers)

show_seats (relational, partitioned by show_id)        -- the inventory, source of truth
  show_id, seat_id, status (AVAILABLE|HELD|BOOKED), hold_id, hold_expires_at, booking_id, version
  PRIMARY KEY (show_id, seat_id)

holds:    hold_id, show_id, user_id, seat_ids, expires_at, status
bookings: booking_id, user_id, show_id, seat_ids, amount, payment_id, status (PENDING|CONFIRMED|CANCELLED)
```

For general-admission events (no seat numbers), inventory becomes a counter per ticket tier.

## High-level design

```text
 Users --> CDN (static, event pages) --> LB / API gateway (auth, rate limit, bot checks)
                                              |
            +---------------------------------+------------------------------+
            v                                 v                              v
     Catalog service                  Waiting room / queue            Booking service
     (events, shows; cached)          (flash sales only)              - hold seats (txn)
                                              |                       - create booking
                                       admits N users/min ----------> - payment orchestration
                                                                             |
     Seat map read model (Redis, per show,  <---- CDC / events --------  Inventory DB (show_seats)
     refreshed ~1 s, served to browsers)                                     |
                                                                       Payment gateway
     Hold expiry worker (releases expired holds)                       Notification (e-ticket)
```

## Deep dives

### 1. Preventing double booking

All seat state changes go through the inventory DB with atomic conditional updates in one transaction:

```text
BEGIN;
UPDATE show_seats
   SET status='HELD', hold_id=:h, hold_expires_at=now()+interval '8 min', version=version+1
 WHERE show_id=:s AND seat_id IN (:seats)
   AND (status='AVAILABLE' OR (status='HELD' AND hold_expires_at < now()));
-- if rows_updated != number of requested seats -> ROLLBACK, return 409
COMMIT;
```

Either all requested seats are held or none. Because the predicate checks status, two concurrent holds on the same seat cannot both succeed. Partitioning `show_seats` by show keeps each show's contention on one shard, where row-level locks or optimistic concurrency resolve it. Redis (`SETNX` per seat) can act as a fast pre-filter during flash sales, but the database remains the source of truth.

### 2. Hold expiry and payment

- Holds last ~5–10 minutes. Expiry is enforced lazily (the conditional update above treats expired holds as available) and actively by a worker that releases expired holds so seat maps update.
- Checkout: create a booking in PENDING with an idempotency key; start payment with the gateway using the same key.
- On payment success webhook: in one transaction, verify the hold is still ours and unexpired (or grace-extended), mark seats BOOKED, booking CONFIRMED. If the hold expired and seats were taken by someone else, refund automatically.
- Extend the hold when the user enters the payment flow to avoid expiring during 3-D Secure.
- This is a small saga: hold → pay → confirm, with compensations (release seats, refund).

### 3. Flash sale traffic: the virtual waiting room

Letting 1M users hit the booking service simultaneously would melt it and reward the fastest bots.

- Before the sale, users join a **waiting room** served by a CDN-backed static page and a lightweight queue service. Each gets a signed token with a random or arrival-ordered position.
- The queue admits users at a controlled rate (e.g., 2,000/min) matched to booking capacity; admitted users get a short-lived access token required by the booking API.
- Show estimated wait time; users can't bypass by refreshing.
- Combined with bot defences (CAPTCHA, device fingerprinting, per-account purchase limits), this improves fairness and protects the core system.

### 4. Seat map reads at 200k QPS

Serving seat maps from the inventory DB would compete with the critical writes. Instead, maintain a read model per show in Redis (a bitmap or hash of seat statuses) updated from inventory changes via CDC/events, and serve it with ~1 s staleness, cached at the API tier. The UI may show a seat as available that was just taken; the hold request will fail with 409 and the UI refreshes. Correctness lives in the write path, not the read path.

## Bottlenecks & scaling

- **Hot show contention**: one show's seats on one shard; the waiting room keeps writes to a level that shard handles (thousands of transactions/s).
- **Payment gateway latency and limits**: asynchronous confirmation via webhooks; retries with idempotency keys.
- **Read traffic**: CDN for static content, Redis read models for availability, aggressive caching of catalog data.
- **Notifications**: e-tickets via async queue.
- **Multi-region**: inventory for a show lives in one region (single writer); browsing is served globally.

## Follow-ups the interviewer may ask

- **Why not lock seats in Redis only?** Redis failover can lose locks and there's no transactional link to the booking; use it as an accelerator, not the source of truth.
- **How do you handle general admission?** A counter per tier: `UPDATE tiers SET sold = sold + :n WHERE id=:t AND sold + :n <= capacity`; for extreme contention, pre-split inventory into buckets across shards.
- **What if payment succeeds but the confirm step fails?** The webhook is retried idempotently; a reconciliation job compares gateway records with bookings and fixes or refunds.
- **How do you stop scalpers?** Per-user limits, verified accounts, waiting room with bot detection, and named tickets.
- **How do you support seat suggestions ("best 4 together")?** Compute from the read model, then attempt a hold; on conflict, recompute.
