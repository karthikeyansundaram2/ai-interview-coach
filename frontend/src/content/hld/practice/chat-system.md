A chat system like WhatsApp delivers one-to-one and group messages in real time, stores them for offline users, and shows delivery and read receipts. The core challenges are routing messages to the server holding each recipient's connection, ordering, and never losing a message.

## Clarify requirements

**Functional**
- One-to-one and group chats (groups up to 500 members).
- Real-time delivery when online; delivered later when offline (with push notification).
- Message status: sent, delivered, read.
- Online presence and last seen.
- Multi-device sync (phone + web) and message history.
- Media messages via upload (reuse object storage + CDN).
- Out of scope: voice/video calls; end-to-end encryption design details (mention it).

**Non-functional**
- 500M DAU, 50B messages/day.
- Delivery latency < 200 ms when both online in the same region.
- No message loss; per-conversation ordering.
- High availability; mobile networks are unreliable.

## Back-of-the-envelope

- Messages: 50B / 10^5 ≈ **500k messages/s** average, peak ~1.5M/s.
- Storage: 50B × 200 B (text + metadata) = **10 TB/day**, ~3.6 PB/year (before replication). Many systems keep server copies only until delivered (WhatsApp style); others keep full history.
- Concurrent connections: maybe 200M online at peak; at 500k connections per gateway server ≈ **400 gateway servers**, plan for ~800 with headroom.
- Group fan-out: if 10% of messages go to groups of average 50 members → 50k/s × 50 = 2.5M deliveries/s.

## API

Persistent WebSocket connection for real-time traffic:

```text
Client -> Server frames:
  send     { clientMsgId, conversationId, body/mediaRef, ts }
  ack      { conversationId, upToSeq }           (delivered)
  read     { conversationId, upToSeq }
  sync     { conversationId, sinceSeq }          (after reconnect)

Server -> Client frames:
  message  { conversationId, seq, msgId, senderId, body, serverTs }
  sendAck  { clientMsgId, msgId, seq }           (server persisted it)
  receipt  { conversationId, userId, type, upToSeq }
  presence { userId, online, lastSeen }

REST: POST /v1/conversations, GET /v1/conversations/{id}/messages?beforeSeq=, POST /v1/media/uploads
```

`clientMsgId` makes sends idempotent across retries.

## Data model

```text
messages (Cassandra / HBase / DynamoDB)
  PRIMARY KEY ((conversation_id, bucket), seq)   -- bucket by month to bound partition size
  msg_id, sender_id, body or media_ref, server_ts, client_msg_id

conversations: conversation_id -> type, members, last_seq
user_inbox (per user, per conversation): user_id, conversation_id -> last_delivered_seq, last_read_seq, unread_count
sessions (Redis): user_id -> [ {device_id, gateway_id} ]   TTL refreshed by heartbeat
presence (Redis): user_id -> online / last_seen
```

## High-level design

```text
  Client A <==WS==> Gateway 12 ---+                          +--- Gateway 77 <==WS==> Client B
                                  |                          |
                                  v                          |
                           Chat service (stateless) ---------+  (deliver via gateway lookup / pub-sub)
                             | 1. dedup clientMsgId
                             | 2. assign seq (per conversation)
                             | 3. persist message
                             | 4. ack sender
                             | 5. route to recipients' gateways
                             v
                       Messages DB         Session registry (Redis)
                             |
                     Kafka "messages" --> Group fan-out workers
                                       --> Push notification service (offline users)
                                       --> Search / analytics (optional)
```

**Send flow (1:1)**: A sends over WebSocket to gateway 12, which forwards to the chat service. The service deduplicates by `clientMsgId`, assigns the next sequence number for the conversation, writes to the messages store, and acknowledges A (one tick). It looks up B's sessions; for each online device, it sends to that gateway, which pushes to B. B acks delivery; the receipt flows back to A (two ticks). If B is offline, a push notification goes out; B syncs on reconnect.

## Deep dives

### 1. Routing to the right connection

Gateways are the only stateful layer (they hold sockets). A session registry in Redis maps `user -> [(device, gateway)]`, written on connect and refreshed by heartbeats with a TTL. The chat service sends directly to the gateway via an internal RPC or a per-gateway queue. Alternative: each gateway subscribes to pub/sub channels for its connected users. If the registry is stale (gateway died), the send fails, and the message waits in storage for the client's sync.

### 2. Ordering and sequence numbers

Client clocks are unreliable, so the server assigns a per-conversation, monotonically increasing `seq`. Options: an atomic counter per conversation in Redis or the conversations table (conditional increment), or routing all writes for a conversation to one partition owner that assigns seqs. Clients display by seq and detect gaps ("I have 41 and 43, fetch 42"). Global ordering across conversations isn't needed.

### 3. Reliable delivery and offline sync

- Persist before acknowledging the sender, so an acknowledged message is never lost.
- Real-time push is best effort; the source of truth is the stored message plus each device's `last_delivered_seq`.
- On reconnect, the client sends its last seq per conversation (or a global per-user change cursor) and receives everything newer, paging if large.
- Multi-device: each device tracks its own cursor; read receipts sync across the user's devices as events.

### 4. Group messages

For small groups (≤ 500), write the message once to the group conversation, then fan out delivery to each member's online devices (via Kafka workers to avoid blocking the sender). Per-member delivered/read state is updated in `user_inbox`; aggregate receipts ("read by 12") are computed lazily. For huge broadcast channels, switch to pull: members fetch from the channel rather than per-member delivery.

## Bottlenecks & scaling

- **Gateways**: horizontal scale; L4 load balancing with least-connections; jittered reconnects on deploys.
- **Messages store**: write-heavy, partitioned by conversation with time buckets to prevent huge partitions.
- **Sequence assignment hot spot**: a very busy group serializes on one counter; acceptable at chat rates (hundreds/s per group at most).
- **Presence fan-out**: don't broadcast to all contacts; subscribe only to presence of open conversations.
- **Multi-region**: users connect to the nearest region; conversations have a home region for seq assignment; cross-region delivery via replicated queues.

## Follow-ups the interviewer may ask

- **How does end-to-end encryption change things?** The server stores and routes ciphertext only; keys are exchanged between devices (Signal protocol); server-side search becomes impossible, and multi-device requires per-device encryption.
- **How are media messages sent?** Upload to object storage via presigned URL, send a message with the media reference; recipients download via CDN.
- **What if the sender retries after a timeout?** `clientMsgId` dedup returns the original seq; no duplicate message.
- **How do you show "typing…"?** Ephemeral events sent via gateways, never persisted, rate-limited.
- **How long do you keep messages?** Depends on product: until delivered (privacy-focused) or indefinitely with cold storage tiers for old partitions.
