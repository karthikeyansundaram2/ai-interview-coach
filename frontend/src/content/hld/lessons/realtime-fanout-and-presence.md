Real-time systems push events to users the moment they happen: a chat message, a like, a driver moving on a map. The core problems are routing each event to the servers holding the right connections, fanning out to many recipients, and knowing who is online.

## The analogy

A radio station broadcasts once and every tuned-in receiver hears it (pub/sub). A courier delivering individual parcels must know which depot each recipient is nearest (connection routing). And the receptionist's board showing who is in the office, updated when people badge in and out, is presence.

## Building blocks

```text
             +-----------------+
 Clients <==>| Gateway servers |  (hold WebSocket/SSE connections, stateless otherwise)
             +--------+--------+
                      | subscribe / publish
             +--------v--------+
             |  Pub/Sub layer  |  (Redis Pub/Sub, NATS, Kafka, managed services)
             +--------+--------+
                      |
             +--------v--------+        +-------------------+
             | Domain services |------->| Durable storage   |
             +-----------------+        | (messages, events)|
                                        +-------------------+
```

- **Gateways** terminate persistent connections. They keep a local map of connection to user and subscribe to the channels their users need.
- **Pub/sub** routes events to whichever gateways are interested.
- **Durable storage** holds the events so clients can catch up after disconnecting; the real-time path is an optimization, not the record.

## Routing strategies

| Strategy | How | Good for | Cost |
|---|---|---|---|
| Per-user channels | Gateway subscribes to `user:{id}` for each connected user | Chat, notifications | Many channels; pub/sub must handle millions of subscriptions |
| Session registry | Store `user -> gateway` in Redis; services send directly to that gateway | Direct messaging | Registry must stay accurate |
| Topic channels | Gateway subscribes to `room:{id}`, `match:{id}` | Group chats, live scores, docs | Big rooms mean large fan-out |
| Broadcast to all gateways | Every gateway gets every event and filters | Small systems | Does not scale |

## Fan-out

When one event has many recipients:

- **Small groups (under a few hundred)**: fan out at write time; publish to each member's channel or to a room channel.
- **Large audiences (live stream with 1M viewers)**: publish once to a topic; each gateway subscribed to the topic delivers to its local viewers. Fan-out happens at the gateway layer, so the pub/sub system sends roughly one copy per gateway, not per viewer.
- **Very large audiences with low interactivity**: sample or aggregate (show "12k people reacted" rather than every reaction), and rate-limit per-client delivery.

Delivery latency targets are typically under 100–200 ms within a region.

## Presence

Presence answers "is this user online?" and "who in this room is online?".

```text
Client heartbeat every 30 s --> Gateway --> SET presence:user:42 = gw-7 EX 60
Disconnect                   --> DEL presence:user:42, publish "user 42 offline"
No heartbeat for 60 s        --> key expires -> considered offline
```

- Store presence with a TTL so crashed gateways do not leave users online forever.
- **Debounce** flapping: wait a few seconds before announcing "offline", since mobile clients reconnect constantly.
- Do not broadcast every presence change to every contact; for users with thousands of contacts, have clients fetch presence for visible contacts on demand or subscribe only to presence of open conversations.
- "Last seen" is just the timestamp written on disconnect.

## Ordering and delivery guarantees

- Assign a per-conversation sequence number at the service that persists the message. Clients order by it and detect gaps.
- Pub/sub like Redis is at-most-once: a gateway that is reconnecting misses events. Clients therefore reconnect with their last seen sequence and fetch missing events from storage.
- Acknowledgements (delivered, read) are just more events flowing back.

## Scaling numbers

A tuned gateway holds 100k–1M mostly idle connections. For 50M concurrent users at 200k per gateway, that is 250 gateways. Each gateway's memory, file descriptors, and heartbeat processing are the real limits, plus the reconnect storm after a deploy, which needs jittered backoff and gradual draining.

## Common mistakes

- Treating pub/sub as reliable delivery; it is a notification path, storage is the truth.
- Broadcasting presence to everyone.
- Sticky state in gateways that cannot be rebuilt after a restart.
- Ignoring reconnect storms.

## In the interview

**Q: How does a message reach a user connected to gateway 37?**
The chat service persists it, then publishes to the user's channel (or looks up the user's gateway in the registry). Gateway 37, subscribed to that channel, writes it onto the user's socket. If the user is offline, a push notification is sent instead.

**Q: How do you implement presence for 100M users?**
Heartbeat-refreshed keys with TTLs in a sharded Redis, debounced offline events, and on-demand or subscription-based presence for visible contacts rather than global broadcast.

**Q: How do you stream comments to a live video with 2M viewers?**
Publish each comment to a topic; gateways subscribe once and deliver to their local viewers. Sample or rate-limit comments shown per client, since no one can read thousands per second.

## Key takeaways

- Gateways hold connections; pub/sub routes events; storage is the source of truth.
- Fan out at the gateway layer for large audiences.
- Presence = heartbeats + TTL keys + debounce, queried on demand.
- Sequence numbers and catch-up from storage handle gaps after reconnects.
