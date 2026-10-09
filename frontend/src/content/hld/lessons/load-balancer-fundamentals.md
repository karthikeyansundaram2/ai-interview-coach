A load balancer spreads requests across many servers so no single one is overwhelmed, and it quietly removes broken servers from rotation. The main design choice is how deep it looks into traffic: at the connection level (L4) or at the request level (L7).

## The analogy

At an airport, an L4 balancer is the staff member who points each arriving passenger to the shortest security line without looking at their ticket. An L7 balancer reads the boarding pass: first class to lane 1, international to lane 4, crew through the side door.

## What a load balancer does

- **Distributes load** across a pool of healthy backends.
- **Health checks** backends (TCP connect or HTTP `/healthz`) and stops sending traffic to failing ones.
- **Hides topology**: clients see one stable address while you add, remove, and replace servers.
- **Terminates TLS** (at L7), offloading crypto from application servers.
- **Drains connections** during deploys so in-flight requests finish.

```text
                    +-------------------+
 Clients --DNS-->   |  L4 LB (anycast)  |
                    +---------+---------+
                              |
                +-------------+-------------+
                |                           |
        +-------v------+            +-------v------+
        |   L7 LB / GW |            |   L7 LB / GW |
        +--+-------+---+            +--+-------+---+
           |       |                   |       |
        /api/*  /static/*           /api/*  /static/*
           v       v                   v       v
       API pool  Static pool       API pool  Static pool
```

## L4 vs L7

| | L4 (transport) | L7 (application) |
|---|---|---|
| Sees | IPs, ports, TCP/UDP | HTTP method, path, headers, cookies |
| Balances | Per connection | Per request |
| TLS | Passes through | Usually terminates |
| Routing features | None beyond IP/port | Path/host routing, header rules, canaries, rewrites, auth, rate limits |
| Performance | Millions of connections, very low overhead | More CPU per request |
| Examples | AWS NLB, Maglev, IPVS | AWS ALB, Envoy, NGINX, HAProxy in HTTP mode |

Large systems often layer them: an L4 tier with anycast for raw scale and DDoS absorption, feeding an L7 tier for smart routing.

## Deployment patterns

- **Hardware / managed edge LB**: the entry point from the internet.
- **Internal LBs** between tiers inside a VPC.
- **Client-side load balancing**: the client library holds the server list (from service discovery) and picks a backend itself, avoiding an extra hop. Common with gRPC.
- **Sidecar proxies** (service mesh): every service has a local Envoy handling balancing, retries, and mTLS.

## Avoiding the LB as a single point of failure

Run load balancers as redundant pairs or fleets. Managed LBs are already distributed across zones. For self-hosted, use active-passive pairs sharing a virtual IP (keepalived/VRRP), or anycast across many nodes advertising the same IP via BGP.

## Session affinity

Sticky sessions pin a client to a backend via a cookie or IP hash. They help with in-memory session state or warm local caches, but they cause uneven load and lose state when a server dies. The better default is stateless servers with session data in Redis or a signed token.

## Long-lived connections

WebSockets and gRPC (HTTP/2) keep a connection open for a long time. An L4 balancer assigns each connection once, so a server that came up later gets little traffic, and a few hot connections can overload one server. Fixes: L7 balancing per request for gRPC, connection max-age so clients periodically reconnect, and least-connections algorithms for WebSocket fleets.

## Common mistakes

- Health checks that only test "process is up", not "can reach its database".
- Health checks that test every dependency, so a database blip removes every server at once.
- Sticky sessions as a crutch for stateful servers.
- Idle timeouts shorter than WebSocket heartbeat intervals.

## In the interview

**Q: When would you choose L4 over L7?**
For non-HTTP protocols, extreme connection counts, TLS passthrough requirements, or as a high-throughput front tier. Choose L7 when you need path-based routing, header inspection, canary splits, or per-request balancing.

**Q: How do you avoid the load balancer being a single point of failure?**
Use a managed multi-zone balancer, or run several balancers behind anycast or a floating IP with automatic failover, and put DNS health checks in front for regional failover.

**Q: How do you deploy without dropping requests?**
Mark the instance as draining, stop sending new requests, let in-flight requests finish within a timeout, then terminate it. Bring new instances in only after they pass readiness checks.

## Key takeaways

- L4 balances connections fast; L7 balances requests with content-aware routing.
- Health checks and draining are as important as the algorithm.
- Keep backends stateless instead of relying on sticky sessions.
- Long-lived connections need special care to stay balanced.
