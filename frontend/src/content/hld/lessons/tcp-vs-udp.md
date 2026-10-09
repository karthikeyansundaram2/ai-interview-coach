TCP and UDP are the two transport protocols almost everything is built on. TCP gives you a reliable, ordered byte stream at the cost of handshakes and waiting; UDP gives you raw speed and leaves every guarantee up to you.

## The analogy

TCP is registered mail: every package is numbered, the recipient signs for it, missing packages are re-sent, and they are handed over in order. UDP is dropping postcards in a mailbox: cheap and quick, but some may get lost or arrive out of order, and nobody tells you.

## How TCP works

- **Connection setup**: a three-way handshake (SYN, SYN-ACK, ACK) costs one round trip before data flows.
- **Reliability**: every byte has a sequence number; the receiver acknowledges, and the sender retransmits anything not acknowledged in time.
- **Ordering**: bytes are delivered to the application in order. If packet 5 is lost, packets 6–10 wait in a buffer until 5 is retransmitted. This is **head-of-line blocking**.
- **Flow control**: the receiver advertises a window so a fast sender cannot overwhelm a slow reader.
- **Congestion control**: algorithms such as CUBIC or BBR probe for available bandwidth and back off when loss signals congestion. New connections start slow (slow start), which is another reason to reuse connections.

## How UDP works

UDP adds only ports and a checksum on top of IP. There is no handshake, no retransmission, no ordering, and no congestion control. Each datagram stands alone. Applications that use UDP rebuild whatever guarantees they need: sequence numbers for ordering, selective retransmission for important data, forward error correction for media.

## Comparison

| Property | TCP | UDP |
|---|---|---|
| Setup cost | 1 RTT handshake | None |
| Delivery | Guaranteed or connection error | Best effort |
| Ordering | Strict | None |
| Head-of-line blocking | Yes | No |
| Congestion control | Built in | Up to the application |
| Header size | 20+ bytes | 8 bytes |
| Typical uses | HTTP/1.1 and 2, databases, message brokers, SSH | DNS, VoIP, video calls, online games, QUIC (HTTP/3) |

```text
TCP stream with a lost packet:
  sent:      [1][2][3][4][5][6]
  received:  [1][2][ ][4][5][6]
  delivered: [1][2] ...wait... (retransmit 3) [3][4][5][6]

UDP with a lost packet:
  sent:      [1][2][3][4][5][6]
  delivered: [1][2]   [4][5][6]   (app decides whether 3 matters)
```

## Why real-time media prefers UDP

In a video call, a frame that arrives 300 ms late is worthless; you would rather skip it and show the next one. TCP would stall everything behind the lost packet and retransmit data that is already stale. UDP-based protocols (RTP, WebRTC) let the application drop, conceal, or partially recover loss instead.

## QUIC: the best of both

QUIC runs over UDP but implements reliability, congestion control, and encryption in user space, with independent streams so a loss on one stream does not block the others. It merges the transport and TLS handshakes, so a new connection needs one round trip and a resumed one can need zero. It also identifies connections by an ID rather than the IP/port pair, so a phone moving from Wi-Fi to cellular keeps its connection.

## Common mistakes

- Picking UDP for "speed" in a system that actually needs every message, then reinventing TCP badly.
- Ignoring the cost of new TCP connections. Handshakes plus slow start make short-lived connections expensive; use pools.
- Forgetting that some corporate networks block or throttle UDP. Always keep a TCP fallback.
- Assuming TCP means end-to-end delivery to the application. A TCP acknowledgement only means the kernel received the bytes, not that your service processed them, so you still need application-level acknowledgements.

## In the interview

**Q: Which transport would you use for a multiplayer game's position updates?**
UDP, because each update supersedes the previous one; resending a stale position is wasteful. Critical events such as purchases go over a reliable channel, either TCP or a reliable layer on top of UDP.

**Q: Why does HTTP/3 use UDP if it needs reliability?**
Building on UDP lets QUIC implement per-stream reliability, avoiding TCP's connection-wide head-of-line blocking, and lets it ship improvements in user space without waiting for operating system kernels to change.

**Q: Does a TCP ACK mean the server processed my message?**
No. It means the receiving kernel buffered the bytes. Application-level acknowledgements (for example a broker confirming a publish) are what tell you the work was accepted.

## Key takeaways

- TCP provides ordered, reliable delivery with handshakes, flow control, and congestion control.
- UDP is minimal and is preferred when late data is useless, such as live audio, video, and games.
- Head-of-line blocking is TCP's core cost; QUIC removes it while keeping reliability.
- Transport-level delivery is not application-level success; design your own acknowledgements.
