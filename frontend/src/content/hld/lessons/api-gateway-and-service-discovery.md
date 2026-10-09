Once a system has many services, clients need one front door and services need a way to find each other as instances come and go. The API gateway solves the first problem; service discovery solves the second.

## The analogy

An API gateway is a hotel reception desk: guests never wander the corridors looking for housekeeping or the kitchen; they ask reception, which checks their room key and routes the request. Service discovery is the staff phone directory that is updated automatically whenever someone starts a shift or goes home, so reception always calls someone who is actually on duty.

## API gateway responsibilities

```text
Mobile / Web / Partners
          |
   +------v-------------------------------+
   | API Gateway                          |
   |  TLS termination   AuthN (JWT/OAuth) |
   |  Rate limiting     Request routing   |
   |  Request/response transformation     |
   |  Caching           Logging, tracing  |
   +--+-------------+-------------+-------+
      v             v             v
  User svc      Order svc     Search svc
```

- **Routing** by path, host, header, or version (`/v1/orders` to the order service).
- **Cross-cutting concerns** in one place: authentication, rate limiting, request validation, CORS, compression, request IDs.
- **Protocol translation**: REST/JSON outside, gRPC inside.
- **Aggregation**: combine several backend calls into one response (or leave that to a BFF).
- **Canary and blue-green routing**: send a percentage of traffic to a new version.

Examples: AWS API Gateway, Kong, Envoy-based gateways, NGINX, Apigee.

### Backend for frontend (BFF)

Different clients need different shapes. A BFF is a thin, client-specific gateway layer (one for mobile, one for web) owned by the client team, which aggregates and trims responses. It prevents one general gateway from accumulating every client's special cases.

### Risks

- The gateway is on every request: it must be horizontally scaled, multi-zone, and fast.
- Business logic creeping into the gateway turns it into a fragile monolith. Keep it to cross-cutting concerns.
- Extra hop latency (typically 1–5 ms).

## Service discovery

Instances scale up and down and move around, so hard-coded addresses do not work. Discovery keeps a live registry of healthy instances.

**Registry options**: Consul, etcd, ZooKeeper, Eureka, Kubernetes (Endpoints/EndpointSlices with DNS), AWS Cloud Map.

**Registration**:
- *Self-registration*: the instance registers itself and sends heartbeats.
- *Third-party registration*: the platform (Kubernetes, an ECS agent) registers instances and removes them when health checks fail.

**Lookup patterns**:

| Pattern | How | Pros | Cons |
|---|---|---|---|
| Server-side discovery | Client calls a load balancer or DNS name; it resolves instances | Clients stay simple, language-agnostic | Extra hop; LB must be HA |
| Client-side discovery | Client library fetches instance list and balances itself | No extra hop, smarter balancing | Logic in every language's client |
| Service mesh | Sidecar proxy (Envoy) per instance gets endpoints from a control plane | Retries, mTLS, metrics with no app code | Operational complexity, extra resource cost |

```text
Order svc --> [sidecar] ----mTLS----> [sidecar] --> Payment svc instance 3
                 ^                         ^
                 +---- control plane (endpoints, policies, certs)
```

## Health and freshness

The registry is only useful if it is accurate. Use readiness checks (can this instance serve traffic now?) separately from liveness checks (should it be restarted?). Use short heartbeat TTLs so dead instances disappear within seconds, and have clients retry another instance on connection failure, since the registry is always slightly behind reality.

## Common mistakes

- Putting business orchestration in the gateway.
- One gateway shared by every team with a single config file, creating a deploy bottleneck.
- Caching discovery results for too long, sending traffic to terminated instances.
- Using DNS-based discovery with clients that ignore TTLs.

## In the interview

**Q: What belongs in the API gateway versus the services?**
Cross-cutting, request-level concerns (auth token validation, rate limits, routing, TLS, logging) belong in the gateway. Domain logic and fine-grained authorization ("can this user edit this document?") belong in services.

**Q: How do services find each other in Kubernetes?**
Each service gets a stable DNS name and virtual IP; kube-proxy or a mesh routes to the current healthy pods, which are tracked through readiness probes.

**Q: Is the gateway a single point of failure?**
Only if deployed as one. Run multiple stateless gateway instances across zones behind an L4 load balancer, and keep its configuration in a replicated store.

## Key takeaways

- The API gateway centralizes routing, auth, and rate limiting for external clients.
- Keep business logic out of the gateway; use BFFs for client-specific shaping.
- Service discovery tracks healthy instances via registration and health checks.
- Client-side, server-side, and mesh-based discovery trade simplicity for control.
