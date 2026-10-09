HTTP is the language almost every client and service speaks, and TLS is the envelope that keeps it private. Knowing what each version of HTTP changes, and what a TLS handshake costs, lets you explain where the first few hundred milliseconds of a request go.

## The analogy

HTTP is like ordering at a counter: you state what you want ("GET the menu", "POST this order"), and the clerk replies with a status and the goods. TLS is doing that conversation inside a sealed booth after both of you have checked each other's ID badge. HTTP/2 is the same counter, but you can shout five orders at once and the clerk hands them back as each is ready.

## How HTTP works

A request has a method, a path, headers, and an optional body. A response has a status code, headers, and a body.

| Method | Safe | Idempotent | Typical use |
|---|---|---|---|
| GET | Yes | Yes | Read a resource |
| PUT | No | Yes | Replace a resource |
| DELETE | No | Yes | Remove a resource |
| POST | No | No | Create or trigger an action |
| PATCH | No | Not by default | Partial update |

Status code families: `2xx` success, `3xx` redirect, `4xx` client error (400 bad input, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 429 too many requests), `5xx` server error (500, 502 bad gateway, 503 unavailable, 504 gateway timeout).

Headers carry the interesting system-design knobs: `Cache-Control`, `ETag` / `If-None-Match` for conditional requests, `Authorization`, `Content-Encoding` for compression, and `Connection: keep-alive` for reuse.

## HTTP versions

| Version | Transport | Key change | Remaining pain |
|---|---|---|---|
| HTTP/1.1 | TCP | Persistent connections | One in-flight request per connection; browsers open ~6 per host |
| HTTP/2 | TCP | Binary framing, many streams multiplexed on one connection, header compression | A single lost TCP packet stalls every stream (head-of-line blocking) |
| HTTP/3 | QUIC over UDP | Independent streams, faster handshakes, connection migration across networks | UDP is sometimes blocked; more CPU in user space |

## What TLS adds

```text
Client                                   Server
  |--- TCP SYN ------------------------------>|
  |<-- SYN-ACK -------------------------------|   1 RTT (TCP)
  |--- ACK + ClientHello (key share) -------->|
  |<-- ServerHello, cert, Finished -----------|   1 RTT (TLS 1.3)
  |--- Finished + HTTP request -------------->|
  |<-- HTTP response -------------------------|
```

TLS 1.3 needs one round trip after TCP (TLS 1.2 needed two), and supports 0-RTT resumption for repeat visitors at the cost of replay risk on those early requests. With a 100 ms round trip, a fresh HTTPS request is roughly 300 ms before the first response byte; a reused connection is about 100 ms. That gap is why connection pooling, keep-alive, and terminating TLS near the user (at a CDN edge) matter so much.

TLS provides three things: **confidentiality** (encryption), **integrity** (tampering is detected), and **authentication** (the certificate proves the server owns the domain). Mutual TLS (mTLS) also authenticates the client, which is common between internal services in a service mesh.

## Where to terminate TLS

- **At the load balancer**: simplest; backends speak plain HTTP inside a private network. Offloads CPU and centralizes certificates.
- **Re-encrypt to backends**: required by many compliance regimes; costs extra CPU.
- **Passthrough (L4)**: backends hold certificates; the balancer cannot inspect HTTP.

## Common mistakes

- Making POST endpoints that should be retryable without an idempotency key.
- Opening a new connection per request between services. Pool connections and reuse them.
- Returning `200` with an error body. Clients, caches, and monitors all depend on accurate status codes.
- Assuming HTTP/2 removes all head-of-line blocking. It removes it at the HTTP layer, not the TCP layer.

## In the interview

**Q: Why is the first request to a service slow and later ones fast?**
The first request pays for DNS, the TCP handshake, and the TLS handshake, roughly three round trips. Later requests reuse the warm connection and cached DNS, paying only one round trip.

**Q: Which HTTP status should a rate limiter return?**
`429 Too Many Requests`, ideally with a `Retry-After` header so well-behaved clients can back off.

**Q: When would you choose HTTP/3?**
For mobile clients on lossy networks or ones that switch between Wi-Fi and cellular, since QUIC avoids TCP head-of-line blocking and survives IP changes. Keep an HTTP/2 fallback for networks that block UDP.

## Key takeaways

- Method semantics (safe, idempotent) decide what clients and proxies may retry or cache.
- HTTP/2 multiplexes streams; HTTP/3 moves to QUIC to remove TCP-level head-of-line blocking.
- TLS 1.3 costs one extra round trip; connection reuse and edge termination hide it.
- Terminate TLS at the load balancer unless compliance requires end-to-end encryption.
