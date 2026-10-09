Every request your system serves starts with a lookup most engineers never think about: turning `api.example.com` into an IP address. DNS is that lookup, and because it sits in front of everything, it also acts as your first and cheapest tool for steering traffic.

## The analogy

Think of calling a friend whose number you don't remember. You check your own phone first (local cache). If it isn't there, you ask a family member who keeps a big contact book (the recursive resolver). If they don't know either, they call the city directory, which points them to the neighbourhood directory, which finally gives the number. Next time, everyone along the way remembers the answer for a while.

## How a lookup works

```text
 Browser/OS cache
       |  miss
       v
 Recursive resolver (ISP, 8.8.8.8, VPC resolver)
       |  1. "who handles .com?"
       +------------------> Root server  --> "ask the .com TLD servers"
       |  2. "who handles example.com?"
       +------------------> .com TLD     --> "ask ns1.example-dns.net"
       |  3. "A record for api.example.com?"
       +------------------> Authoritative --> 203.0.113.10 (TTL 60s)
       v
 Answer cached at each layer for TTL seconds
```

1. The OS and browser check their caches.
2. On a miss, the stub resolver asks a **recursive resolver**.
3. The resolver walks the hierarchy: root, then top-level domain, then the **authoritative** nameserver for the zone.
4. The answer comes back with a **TTL**, and every cache along the path keeps it for that long.

A cold lookup can take 50–200 ms. A cached one is effectively free, which is why DNS rarely shows up in steady-state latency but often shows up in first-page-load latency.

### Record types worth knowing

| Record | Purpose |
|---|---|
| A / AAAA | Hostname to IPv4 / IPv6 address |
| CNAME | Alias one name to another (cannot sit at the zone apex) |
| ALIAS / ANAME | Provider-specific apex alias, e.g. Route 53 alias to a load balancer |
| NS | Which servers are authoritative for a zone |
| MX | Mail servers |
| TXT | Verification, SPF, DKIM, arbitrary metadata |
| SRV | Host and port for a service, used by some discovery systems |

## DNS as a traffic tool

Authoritative providers such as Route 53 or Cloudflare can return different answers based on who is asking:

- **Weighted routing**: send 5% of resolutions to a canary stack.
- **Latency or geo routing**: return the IP of the nearest region.
- **Failover routing**: health-check the primary and return the secondary when it fails.
- **Round-robin multiple A records**: crude load spreading across several IPs.

The catch is that you do not control caches. A resolver may hold a stale answer for the full TTL, and some clients (old JVMs were notorious) cache far longer than the TTL says. DNS failover is therefore measured in minutes, not seconds.

## Trade-offs of TTL choices

| TTL | Benefit | Cost |
|---|---|---|
| Short (30–60 s) | Fast failover, quick migrations | More queries, more cold lookups, higher provider bill |
| Long (hours) | Fewer lookups, resilient if DNS provider has an outage | Changes take hours to propagate |

A common practice is to lower the TTL a day before a planned migration, cut over, then raise it again.

## Common mistakes

- Treating DNS failover as instant. Plan for the TTL plus misbehaving client caches.
- Pointing DNS straight at individual servers. Put a load balancer or anycast address behind the name so instance churn never touches DNS.
- Forgetting that DNS is itself a dependency. Use a provider with anycast and a high SLA, or two providers for critical zones.
- Assuming round-robin A records balance load evenly. Caching resolvers send whole populations of users to one IP.

## In the interview

**Q: How would you route users to the nearest region?**
Use latency-based or geo DNS at the authoritative layer to return a regional load balancer address, with health checks so an unhealthy region is removed from answers. For faster failover, combine it with anycast IPs (for example a global accelerator) so routing changes happen at the network layer rather than waiting on DNS caches.

**Q: Why not use DNS alone for load balancing?**
Resolvers cache answers, so you cannot react to load or failures faster than the TTL, and large ISP resolvers can pin many users to one address. DNS is good for coarse, regional steering; fine-grained balancing belongs in an L4/L7 load balancer.

**Q: What happens to latency on a user's first request?**
Before any bytes of your API are exchanged, there can be a DNS lookup, a TCP handshake, and a TLS handshake. Keeping DNS answers cacheable and using connection reuse removes most of that on later requests.

## Key takeaways

- DNS resolves names through a hierarchy of caches and servers, each honouring a TTL.
- Authoritative DNS can do weighted, geo, latency, and failover routing.
- Failover via DNS is bounded by TTLs and client caching, so expect minutes.
- Use DNS for coarse regional steering and load balancers for fine-grained balancing.
