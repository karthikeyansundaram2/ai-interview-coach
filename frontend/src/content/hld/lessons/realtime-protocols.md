Plain HTTP is a client asking and a server answering, but chat messages, live scores, and ride locations need the server to speak first. Long polling, Server-Sent Events, and WebSockets are the three standard ways to push data, and each has a different cost profile.

## The analogy

Short polling is a child in the back seat asking "are we there yet?" every minute. Long polling is asking once and the parent only answering when you actually arrive, then you ask again. SSE is the parent narrating the trip over the car radio, one way. WebSockets is a two-way walkie-talkie that stays on the whole journey.

## How each works

```text
Short polling:   C --GET--> S (nothing)   C --GET--> S (nothing)   C --GET--> S (data)
Long polling:    C --GET--> S ......holds up to 30s...... (data) --> C --GET--> S ...
SSE:             C --GET--> S ==== stream: event, event, event ====> C   (one way)
WebSocket:       C --HTTP Upgrade--> S <====== frames both directions ======>
```

**Short polling**: the client asks on a fixed interval. Simple and stateless, but wasteful and laggy: polling every 5 seconds gives average delay of 2.5 seconds and most responses are empty.

**Long polling**: the server holds the request open until there is data or a timeout, then the client immediately re-requests. Near real-time, works through every proxy, but each message costs a full HTTP round trip and reconnect storms are possible.

**Server-Sent Events (SSE)**: a single long-lived HTTP response with `Content-Type: text/event-stream`. The server writes events; the browser's `EventSource` reconnects automatically and sends `Last-Event-ID` so the server can resume. One direction only (server to client), text only.

**WebSockets**: the client sends an HTTP Upgrade request, then both sides exchange framed messages over the same TCP connection. Full duplex, low overhead per message (a few bytes of framing), binary or text.

## Comparison

| | Long polling | SSE | WebSocket |
|---|---|---|---|
| Direction | Server to client (per request) | Server to client | Both |
| Overhead per message | Full HTTP request | Small | Very small |
| Auto reconnect / resume | Manual | Built in | Manual |
| Proxy / firewall friendliness | Excellent | Good (plain HTTP) | Usually fine, some proxies interfere |
| Load balancing | Easy | Easy-ish | Sticky, long-lived connections |
| Good for | Fallback, low-frequency updates | Feeds, notifications, live dashboards, LLM token streaming | Chat, games, collaborative editing |

## Operating persistent connections

Persistent connections change your capacity math. A server is no longer limited by requests per second but by **concurrent connections** and memory. With tuning, one machine can hold 100k–1M idle WebSocket connections, but each one costs kernel buffers and application state.

Things you must design for:

- **Connection registry**: when a message for user 42 arrives, which gateway server holds that user's socket? Keep a mapping in Redis (`user -> gateway id`) or use pub/sub channels per user.
- **Heartbeats**: send pings every 20–30 seconds to detect dead clients and keep NAT/load balancer idle timers from closing the connection.
- **Deploys**: draining a server disconnects all its clients. Reconnect with jittered backoff to avoid a thundering herd.
- **Load balancers**: must support long-lived connections and upgrades; idle timeouts must exceed your heartbeat interval.
- **Missed messages**: on reconnect, the client sends its last seen sequence number and fetches anything it missed from durable storage.

```text
Client <==WS==> Gateway A ---subscribe user:42---> Redis Pub/Sub <--publish-- Chat service
Client <==WS==> Gateway B ---subscribe user:77--->
```

## Common mistakes

- Choosing WebSockets for a one-way notification stream where SSE would be simpler.
- Treating the socket as durable storage. Messages sent while disconnected must be recoverable from a database or log.
- Forgetting idle timeouts on load balancers, causing mysterious disconnects every 60 seconds.
- Reconnecting all clients instantly after a deploy and overloading the auth service.

## In the interview

**Q: Which would you use for a live sports score page?**
SSE: updates flow one way, it rides on plain HTTP, and the browser handles reconnection with resume. WebSockets would add complexity without a benefit.

**Q: How does a message reach a user connected to a different server?**
The sending service looks up the user's gateway in a presence/connection registry, or publishes to a per-user channel that the owning gateway subscribes to. The gateway then writes the message onto the socket.

**Q: How do you scale to 10 million concurrent connections?**
Run a fleet of stateless-ish gateway servers, each holding around 100k–500k connections, behind an L4 load balancer. Keep routing state in a shared registry and message state in durable storage, so any gateway can die without losing data.

## Key takeaways

- Long polling is the universal fallback; SSE is the simple one-way stream; WebSockets is full duplex.
- Persistent connections shift the bottleneck from QPS to concurrent connections and memory.
- You need a registry to route messages to the server holding a user's connection.
- Always design reconnect, resume, and heartbeat behaviour explicitly.
