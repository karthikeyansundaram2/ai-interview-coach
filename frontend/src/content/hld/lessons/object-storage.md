Object storage such as Amazon S3 holds files (images, videos, backups, logs) as immutable objects addressed by key, with near-unlimited capacity and very high durability. Almost every system design that mentions "uploads" should put the bytes here and keep only metadata in a database.

## The analogy

Object storage is a vast valet coat check. You hand over a coat, get a ticket (the key), and can retrieve the exact coat later from anywhere in the building. You cannot alter a sleeve while it hangs there; you bring a new coat and swap it under the same ticket. The coat check never runs out of room and keeps copies in several back rooms in case one floods.

## The model

- **Bucket**: a namespace with policies, region, and lifecycle rules.
- **Object**: bytes plus metadata, addressed by a key like `users/42/avatars/9f3a.jpg`. Keys look like paths, but the namespace is flat.
- **Operations**: PUT, GET (with byte ranges), DELETE, LIST by prefix, HEAD for metadata.
- **Immutable writes**: you replace whole objects rather than editing in place. Versioning can keep old copies.
- **Consistency**: S3 now offers strong read-after-write consistency for objects; many other stores are similar.

Under the hood, objects are split, erasure-coded or replicated across many disks and availability zones, which is how S3 advertises eleven nines (99.999999999%) of durability.

## Object vs block vs file

| | Object | Block | File |
|---|---|---|---|
| Access | HTTP API by key | Raw volume attached to one machine | POSIX paths, shared mounts |
| Latency | Tens of ms first byte | Sub-millisecond | Low milliseconds |
| Scale | Effectively unlimited | Size of volume | Large, but bounded per file system |
| Edits | Replace whole object | Random in-place writes | Random in-place writes |
| Examples | S3, GCS, Azure Blob | EBS, local NVMe | EFS, NFS, Lustre |
| Best for | Media, backups, data lakes, static sites | Databases, boot disks | Shared files for legacy apps, ML training data |

## Upload and download patterns

**Presigned URLs**: the client asks your API for permission; the API returns a short-lived signed URL; the client uploads directly to object storage. Your servers never handle the bytes.

```text
1. Client --POST /uploads--> API  (auth, quota check, create metadata row "pending")
2. API --returns presigned PUT URL (expires in 15 min)--> Client
3. Client --PUT bytes--> Object storage
4. Object storage --event (ObjectCreated)--> Queue --> Processor (thumbnails, virus scan)
5. Processor --mark "ready"--> Metadata DB
```

**Multipart upload**: split large files into parts (5 MB–5 GB each), upload in parallel, retry individual parts, then complete. Needed for files over a few hundred MB and for resumable uploads.

**Range GETs**: download parts in parallel or seek inside large files, which video players rely on.

**CDN in front**: serve popular objects from edge caches; keep buckets private and let the CDN authenticate to the origin.

## Storage classes and lifecycle

| Class | Use | Trade-off |
|---|---|---|
| Standard | Hot data | Highest storage price, no retrieval fee |
| Infrequent access | Accessed monthly | Cheaper storage, retrieval fee |
| Archive (Glacier-like) | Compliance, backups | Very cheap; retrieval in minutes to hours |

Lifecycle rules move objects between classes by age and expire temporary data automatically.

## Key design

Older guidance recommended randomized key prefixes to spread load; modern S3 scales automatically per prefix (thousands of requests per second per prefix), so meaningful prefixes are fine, but very hot workloads still benefit from spreading across prefixes.

## Common mistakes

- Streaming uploads through application servers, tying up threads and bandwidth.
- Storing large binaries as database BLOBs.
- Public buckets for private user content instead of signed URLs.
- Using object storage like a file system with frequent small edits or appends.
- Forgetting orphan cleanup when uploads are abandoned (use lifecycle rules for incomplete multipart uploads).

## In the interview

**Q: How do you handle 2 GB video uploads from mobile clients on flaky networks?**
Multipart upload with presigned URLs per part, so the client uploads parts in parallel, retries failed parts, and resumes after interruptions. On completion, an event triggers transcoding.

**Q: Where do you store image metadata versus the image?**
Bytes in object storage under a generated key; metadata (owner, dimensions, key, status, timestamps) in a database for querying.

**Q: How do you keep private photos private but still use a CDN?**
Keep the bucket private, let only the CDN read it via an origin access identity, and issue short-lived signed URLs or cookies to authorized users.

## Key takeaways

- Object storage is cheap, durable, and effectively infinite; use it for all large blobs.
- Keep metadata in a database and bytes in object storage.
- Presigned URLs and multipart uploads keep bytes off your servers and make uploads resumable.
- Use lifecycle rules and storage classes to control cost.
