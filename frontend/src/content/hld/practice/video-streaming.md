A video platform like YouTube or Netflix must ingest huge uploads, transcode them into many formats, and stream them smoothly to millions of concurrent viewers on every kind of network. Almost all of the cost and difficulty lies in the media pipeline and content delivery, not in the metadata.

## Clarify requirements

**Functional**
- Creators upload videos (up to several GB); viewers watch on web, mobile, TV.
- Adaptive streaming that adjusts quality to bandwidth.
- Video metadata, thumbnails, view counts; basic search and recommendations as integrations.
- Resume playback position.
- Out of scope: live streaming (mention differences), comments, monetization.

**Non-functional**
- 500M DAU, 1M uploads/day (UGC model) or a smaller curated catalogue (Netflix model).
- Playback start < 2 s; rebuffering rare.
- Uploads durable once acknowledged; processing may take minutes.
- Highly available playback; global audience.
- Cost efficiency: storage and egress dominate the bill.

## Back-of-the-envelope

- Uploads: 1M/day × average 300 MB = **300 TB/day** of originals.
- Transcoding to ~6 renditions (240p → 4K) in 2 codecs adds about the same again in total size: ~**600 TB/day** stored (before replication). Object storage with tiering is essential.
- Viewing: 500M × 5 videos × 5 minutes = 12.5B minutes/day. At an average 3 Mbps: 12.5B × 60 s × 3 Mb ÷ 8 ≈ **280 PB/day egress**, or ~**26 Tbps** average. Only a CDN (often with ISP-embedded caches) can serve this.
- Metadata: 1M videos/day × 2 KB = 2 GB/day: trivial.
- Transcoding compute: if each minute of video needs ~1 CPU-minute per rendition, 1M × 10 min average × 12 renditions = 120M CPU-minutes/day ≈ **83k CPU cores** continuously; massively parallel.

## API

```text
POST /v1/videos/uploads          { "title", "sizeBytes", "contentType" }
  -> { "videoId", "uploadId", "partUrls": [...presigned multipart URLs] }
POST /v1/videos/{id}/complete    -> 202 (processing)
GET  /v1/videos/{id}             -> metadata, status, manifestUrl, thumbnails
GET  {cdn}/videos/{id}/master.m3u8   -> HLS/DASH manifest listing renditions
GET  {cdn}/videos/{id}/720p/seg_00042.m4s
POST /v1/videos/{id}/progress    { "positionSec": 312 }
```

## Data model

```text
videos: video_id, owner_id, title, description, duration, status (UPLOADING|PROCESSING|READY|FAILED), created_at
renditions: video_id, codec, resolution, bitrate, manifest_key, segment_prefix
watch_progress (KV): (user_id, video_id) -> position, updated_at
view_counts: video_id -> count (aggregated via stream)
Object storage: originals/, segments/{video_id}/{rendition}/seg_N, thumbnails/
```

## High-level design

```text
 Creator --multipart upload (presigned)--> Object storage (originals)
                                                 | ObjectCreated
                                                 v
                                     Kafka "video.uploaded"
                                                 v
                                   Transcoding orchestrator (DAG per video)
                         split into chunks -> parallel encode workers (per chunk x rendition)
                         -> package into HLS/DASH segments + manifests
                         -> thumbnails, content moderation, captions (ASR)
                                                 v
                                   Object storage (segments) --> Origin shield --> CDN PoPs / ISP caches
                                                 |
                                     Metadata DB: status READY

 Viewer --> API (metadata, auth, signed manifest URL) 
        --> CDN (manifest + segments; player picks bitrate per segment)
        --> progress + playback events --> Kafka --> view counts, QoE analytics, recommendations
```

## Deep dives

### 1. Transcoding pipeline

- **Chunked parallel encoding**: split the original at keyframes into ~10 s chunks, encode each chunk for each rendition in parallel across many workers, then stitch. A 1-hour video finishes in minutes instead of hours.
- Represent the work as a DAG (inspect → split → encode × N → package → thumbnails → publish) run by a workflow engine with retries per task; tasks are idempotent (deterministic output keys).
- Codecs: H.264 for compatibility, plus VP9/AV1/HEVC for bandwidth savings on supported devices. Popular videos justify expensive, high-efficiency encodes; the long tail gets cheaper encodes ("per-title" or popularity-based encoding).
- Use spot/preemptible instances for cost, since tasks are retryable.

### 2. Adaptive bitrate streaming

Videos are packaged as HLS or DASH: a manifest lists renditions; each rendition is a sequence of 2–6 s segments. The player measures throughput and buffer level and picks the rendition for each next segment, switching quality without stalling. Short segments allow faster adaptation; longer ones compress better and reduce request overhead. Startup: begin with a lower bitrate to start fast, then ramp up.

### 3. Content delivery at Tbps scale

- Segments are immutable, so cache them with long TTLs at CDN edges.
- An origin shield collapses misses so object storage sees little traffic.
- **Popularity tiers**: pre-position (push) popular titles to edge and ISP-embedded caches during off-peak hours (Netflix Open Connect model); the long tail is pulled on demand.
- Signed URLs or tokens for access control and geo-restrictions; DRM (Widevine, FairPlay) for premium content.
- Steering: the API returns manifest URLs pointing to the best CDN/PoP for the client, based on health and load.

### 4. View counts and analytics

Players emit heartbeat events (every 10–30 s) to Kafka. Stream processing deduplicates (by session ID) and aggregates views and watch time per video per minute; counts are eventually consistent. Quality-of-experience metrics (startup time, rebuffer ratio, bitrate) feed CDN steering and encoding decisions.

## Bottlenecks & scaling

- **Egress cost and capacity**: CDN + ISP caches + efficient codecs. Every 20% bitrate saving is enormous at this scale.
- **Storage**: tier originals and rarely watched renditions to colder storage; delete intermediate files.
- **Transcoding backlog**: autoscale workers on queue depth; prioritize popular creators or short videos for fast availability.
- **Metadata reads**: cached heavily; video pages are hot.
- **Viral video**: CDN absorbs it; ensure manifests also cache, with short TTLs.

## Follow-ups the interviewer may ask

- **How does live streaming differ?** Ingest via RTMP/SRT, transcode in real time, publish segments with low-latency HLS/DASH (1–5 s latency); no time to pre-position, and caches fill as segments appear.
- **How do you resume playback across devices?** Store progress in a KV store keyed by (user, video), written every few seconds and on pause.
- **How do you handle copyright?** Fingerprint uploads (audio/video hashes) against a reference database during processing.
- **How fast can a video become available?** Publish low resolutions first, then higher ones as they finish.
- **What if a CDN provider has an outage?** Multi-CDN with client- or API-level steering based on real-time QoE.
