REST is not the only way to expose an API. gRPC shines for fast, strongly typed calls between your own services, while GraphQL shines when many different clients need to fetch exactly the data they want in one round trip.

## The analogy

gRPC is like two departments in the same company exchanging pre-printed forms: both sides agreed on the form's fields in advance, so the exchange is fast and nobody misreads anything. GraphQL is a restaurant that lets you write your own order on a blank card ("the soup, but only the broth, plus half the salad"), and the kitchen assembles exactly that plate from several stations.

## gRPC

gRPC defines services and messages in a Protocol Buffers schema, generates client and server code in many languages, and sends compact binary messages over HTTP/2.

```text
service OrderService {
  rpc GetOrder(GetOrderRequest) returns (Order);
  rpc StreamUpdates(OrderId) returns (stream OrderEvent);
}
```

What you get:

- **Smaller payloads and faster parsing** than JSON, often several times less CPU per message.
- **Strong contracts**: field numbers in the schema allow backward-compatible evolution (add fields, never reuse numbers).
- **Streaming**: unary, server-streaming, client-streaming, and bidirectional streams on one HTTP/2 connection.
- **Deadlines** propagate across calls, so a downstream service knows how much time the caller has left.

What it costs:

- Browsers cannot speak native gRPC; you need gRPC-Web and a proxy.
- Binary payloads are harder to inspect with curl and logs.
- HTTP/2 long-lived connections confuse L4 load balancers, which balance per connection, not per request. You need L7 balancing or client-side balancing.

## GraphQL

GraphQL exposes a single endpoint and a typed schema. The client sends a query describing the shape of the response.

```text
query {
  user(id: "42") {
    name
    orders(last: 3) { id total items { name } }
  }
}
```

A server-side **resolver** fetches each field, possibly from different backend services. This solves two REST pain points: **over-fetching** (getting fields you do not need) and **under-fetching** (needing several calls to build one screen).

What it costs:

- **N+1 queries**: a naive resolver loads each order's items separately. Batching tools such as DataLoader collect IDs and issue one query.
- **Caching is harder**: everything is a POST to one URL, so HTTP caches and CDNs do not help without persisted queries.
- **Expensive queries**: a client can ask for deeply nested data. You need depth limits, cost analysis, and timeouts.
- **Authorization per field** must be designed carefully.

## Choosing

| Criterion | REST | gRPC | GraphQL |
|---|---|---|---|
| Best for | Public APIs, simple CRUD | Internal service-to-service | Client-facing aggregation (mobile, web) |
| Payload | JSON text | Protobuf binary | JSON text |
| Contract | OpenAPI (optional) | Required .proto | Required schema |
| HTTP caching | Excellent | Poor | Poor without persisted queries |
| Streaming | Via SSE/WebSockets | Native | Subscriptions |
| Browser support | Native | Needs proxy | Native |

A common architecture uses all three: GraphQL or a REST backend-for-frontend facing clients, gRPC between internal services, and REST for public partner APIs.

```text
Mobile/Web --GraphQL--> BFF / Gateway --gRPC--> User svc
                                       --gRPC--> Order svc
Partners  --REST-----> Public API     --gRPC--> Payment svc
```

## Common mistakes

- Using gRPC behind an L4 load balancer and seeing all traffic pinned to a few backends.
- Shipping GraphQL without query cost limits, letting one client hammer every backend.
- Ignoring N+1 resolution and blaming GraphQL for slowness.
- Changing protobuf field numbers, which silently corrupts data for old clients.

## In the interview

**Q: Why use gRPC internally if REST works?**
Lower serialization cost and payload size matter at high internal call volumes, generated clients remove a class of contract bugs, and deadline propagation plus streaming come built in. The trade-off is tooling friction and the need for L7 or client-side load balancing.

**Q: How would you cache GraphQL responses?**
Use persisted queries (the client sends a hash of a pre-registered query) so requests can become cacheable GETs, cache at the resolver level with a data loader and Redis, and use normalized client-side caches.

**Q: How do you protect a GraphQL server from abusive queries?**
Enforce maximum depth, compute a cost score per query and reject expensive ones, apply per-client rate limits based on cost, and set resolver timeouts.

## Key takeaways

- gRPC: binary, typed, streaming, ideal between services; needs L7-aware balancing.
- GraphQL: one flexible query per screen; watch N+1, caching, and query cost.
- REST remains the best default for public and cache-friendly APIs.
- Mixing styles by audience is normal and often the right answer.
