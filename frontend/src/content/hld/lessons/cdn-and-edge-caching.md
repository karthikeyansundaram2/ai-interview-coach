A CDN is a global network of cache servers that serves your content from a location near each user. For any system with images, video, or static assets, it is usually the single biggest win for latency and cost.

## The analogy

Instead of every reader driving to the one central library in the capital, the library places branch libraries in every town, stocked with the most borrowed books. When a branch lacks a book, it orders a copy from the central library and keeps it for the next reader.

## How it works

```text
User (Chennai) --DNS/anycast--> Edge PoP (Chennai)
                                   | hit?  yes -> respond in ~10-20 ms
                                   | miss
                                   v
                             Regional / shield cache
                                   | miss
                                   v
                             Origin (S3 bucket or your LB in us-east-1)
```

1. DNS or anycast routes the user to the nearest point of presence (PoP).
2. The edge checks its cache by URL (plus any configured headers or query parameters).
3. On a miss it fetches from a mid-tier **origin shield**, then the origin, and stores the response according to cache headers.
4. Later requests in that area are served from the edge.

The origin shield collapses misses from hundreds of edges into one request to your origin, protecting it during a cold start or purge.

## Controlling caching

| Header | Effect |
|---|---|
| `Cache-Control: public, max-age=31536000, immutable` | Cache for a year; ideal for content-hashed asset filenames |
| `Cache-Control: s-maxage=60` | Shared caches (CDN) keep it 60 s; browsers can differ |
| `Cache-Control: private, no-store` | Never cache in shared caches (personal data) |
| `stale-while-revalidate=30` | Serve stale for 30 s while refreshing |
| `ETag` / `Last-Modified` | Lets the edge revalidate cheaply with a 304 |
| `Vary: Accept-Encoding` | Separate cache entries per encoding |

**Cache key design** matters: including unnecessary query parameters or cookies in the key fragments the cache and destroys hit ratio.

## Invalidation

- **Versioned URLs** (`/img/logo.4c1e9.png`): the best approach. New content gets a new URL, so no purge is needed.
- **Purge APIs**: remove a URL or tag across all PoPs; typically takes seconds to a minute.
- **Short TTLs** for content that changes often but tolerates a little staleness.

## Push vs pull

| | Pull CDN | Push CDN |
|---|---|---|
| How content arrives | Fetched on first miss | You upload it ahead of time |
| Good for | Most websites and APIs | Large, predictable files (game patches, video libraries) |
| Downside | First request in each region is slow | You manage storage and uploads |

## What else the edge does

- **TLS termination** close to users, cutting handshake latency.
- **DDoS absorption** and web application firewall rules.
- **Dynamic acceleration**: even uncacheable API calls benefit from persistent, optimized connections between edge and origin.
- **Edge compute**: small functions for redirects, A/B assignment, auth checks, or image resizing.
- **Signed URLs/cookies** for private content with expiry.

## Numbers

Serving from an edge typically cuts time to first byte from 150–300 ms (cross-continent) to 10–30 ms. A 95% CDN hit ratio means your origin handles one request in twenty. CDN egress is also usually cheaper per GB than cloud origin egress.

## Common mistakes

- Caching personalized responses publicly, leaking one user's data to another.
- Forgetting cache-busting, then purging constantly or serving stale JavaScript after deploys.
- Letting tracking query parameters into the cache key.
- No origin shield, so a purge or new release causes a miss storm against the origin.

## In the interview

**Q: How would you serve user-uploaded images to a global audience?**
Store originals in object storage, generate resized variants, and serve them through a CDN with long TTLs and content-addressed URLs. Private images use signed URLs with short expiry.

**Q: Can you cache API responses at the CDN?**
Yes for public, non-personalized responses such as product listings or trending items, using short `s-maxage` and `stale-while-revalidate`. Personalized responses stay private or are split so the shared part is cached and the personal part fetched separately.

**Q: How do you roll out a new frontend without stale assets?**
Fingerprint asset filenames with a content hash and cache them for a year; keep the HTML entry point on a short TTL so it picks up new asset references immediately.

## Key takeaways

- CDNs cut latency, origin load, and egress cost by serving from nearby PoPs.
- Cache behaviour is driven by headers and the cache key; design both deliberately.
- Prefer versioned URLs over purges.
- Use an origin shield and never cache personalized data publicly.
