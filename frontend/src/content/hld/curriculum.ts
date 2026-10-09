import type { Track } from "@/lib/content/types";

export const hld: Track = {
  slug: "hld",
  name: "System Design",
  tagline: "Design systems that scale, survive failure, and hold up under an interviewer's follow-ups.",
  intro:
    "A path from networking fundamentals to multi-region architecture, written for engineers aiming at senior system-design rounds. Each lesson builds the vocabulary and trade-off instincts you need to drive a 45-minute design discussion with confidence.",
  stages: [
    {
      name: "Foundations",
      blurb:
        "How requests actually travel, how clients talk to servers, and how to put numbers on a design before you draw a single box.",
      modules: [
        {
          slug: "how-the-web-works",
          title: "How the Web Works",
          outcome:
            "Trace a request from a browser to a server and explain where DNS, TCP, TLS, and HTTP each add latency.",
          lessons: [
            {
              slug: "dns-explained",
              title: "DNS: The Internet's Phone Book",
              summary: "How a hostname becomes an IP address, and how DNS doubles as a traffic-steering tool.",
              minutes: 8,
            },
            {
              slug: "http-https-tls",
              title: "HTTP, HTTPS, and TLS",
              summary: "Request/response semantics, HTTP/1.1 vs 2 vs 3, and what the TLS handshake costs you.",
              minutes: 10,
            },
            {
              slug: "tcp-vs-udp",
              title: "TCP vs UDP",
              summary: "Reliable ordered streams versus fire-and-forget datagrams, and when each one wins.",
              minutes: 8,
            },
          ],
        },
        {
          slug: "client-server-and-apis",
          title: "Client-Server Communication & APIs",
          outcome:
            "Choose between REST, gRPC, GraphQL, and push-style protocols, and justify the choice for a given client.",
          lessons: [
            {
              slug: "rest-api-design",
              title: "REST API Design",
              summary: "Resources, verbs, status codes, pagination, and versioning for APIs that age well.",
              minutes: 10,
            },
            {
              slug: "grpc-and-graphql",
              title: "gRPC and GraphQL",
              summary: "Binary RPC for service-to-service calls and flexible queries for client-facing aggregation.",
              minutes: 9,
            },
            {
              slug: "realtime-protocols",
              title: "WebSockets, SSE, and Long Polling",
              summary: "Three ways to push data to clients and the operational cost of each.",
              minutes: 9,
            },
          ],
        },
        {
          slug: "estimation-and-performance",
          title: "Estimation, Performance & Availability",
          outcome:
            "Do quick capacity math, reason about latency and concurrency with Little's law, and translate nines into downtime budgets.",
          lessons: [
            {
              slug: "back-of-the-envelope-estimation",
              title: "Back-of-the-Envelope Estimation",
              summary: "Turn user counts into QPS, storage, and bandwidth with the numbers every engineer should know.",
              minutes: 12,
            },
            {
              slug: "latency-throughput-littles-law",
              title: "Latency, Throughput & Little's Law",
              summary: "Why percentiles matter and how concurrency, rate, and wait time are tied together.",
              minutes: 9,
            },
            {
              slug: "availability-and-sla-math",
              title: "Availability & SLA Math",
              summary: "What each extra nine costs, and how availability composes in series and in parallel.",
              minutes: 9,
            },
          ],
        },
      ],
    },
    {
      name: "Core System Design",
      blurb:
        "The building blocks that show up in nearly every design: load balancers, caches, databases, queues, and storage.",
      modules: [
        {
          slug: "load-balancing",
          title: "Load Balancing",
          outcome:
            "Place L4 and L7 load balancers correctly and pick an algorithm that matches the workload.",
          lessons: [
            {
              slug: "load-balancer-fundamentals",
              title: "Load Balancers: L4 vs L7",
              summary: "What a load balancer does, where it sits, and what you gain by looking inside requests.",
              minutes: 9,
            },
            {
              slug: "load-balancing-algorithms",
              title: "Load Balancing Algorithms",
              summary: "Round robin, least connections, power of two choices, and hashing for affinity.",
              minutes: 8,
            },
          ],
        },
        {
          slug: "caching",
          title: "Caching",
          outcome:
            "Design a cache layer with the right write strategy, eviction policy, and protections against stampedes and hot keys.",
          lessons: [
            {
              slug: "caching-strategies",
              title: "Caching Strategies",
              summary: "Cache-aside, read-through, write-through, write-behind, and where each one fits.",
              minutes: 10,
            },
            {
              slug: "cache-eviction-and-invalidation",
              title: "Eviction & Invalidation",
              summary: "LRU, LFU, TTLs, and the hard problem of keeping a cache honest.",
              minutes: 9,
            },
            {
              slug: "cache-stampede-and-hot-keys",
              title: "Cache Stampedes & Hot Keys",
              summary: "What happens when a popular key expires or one key gets all the traffic.",
              minutes: 9,
            },
            {
              slug: "cdn-and-edge-caching",
              title: "CDNs & Edge Caching",
              summary: "Serving bytes close to users and controlling what the edge keeps.",
              minutes: 8,
            },
          ],
        },
        {
          slug: "databases",
          title: "Databases",
          outcome:
            "Pick a data store, design indexes, and scale it with replication, sharding, and consistent hashing.",
          lessons: [
            {
              slug: "sql-vs-nosql",
              title: "SQL vs NoSQL",
              summary: "Relational, key-value, document, wide-column, and graph stores compared on real criteria.",
              minutes: 10,
            },
            {
              slug: "indexing-btree-vs-lsm",
              title: "Indexing: B-Trees vs LSM Trees",
              summary: "How storage engines organize data on disk and why that shapes read and write costs.",
              minutes: 11,
            },
            {
              slug: "database-replication",
              title: "Replication",
              summary: "Leader-follower, multi-leader, and leaderless replication, plus replication lag pitfalls.",
              minutes: 10,
            },
            {
              slug: "partitioning-and-sharding",
              title: "Partitioning & Sharding",
              summary: "Splitting data across machines by range or hash, and handling hot partitions.",
              minutes: 10,
            },
            {
              slug: "consistent-hashing",
              title: "Consistent Hashing",
              summary: "Placing keys on a ring so adding a node moves only a small slice of data.",
              minutes: 9,
            },
          ],
        },
        {
          slug: "messaging",
          title: "Message Queues & Streams",
          outcome:
            "Choose between Kafka, RabbitMQ, and SQS and build consumers that are safe under redelivery.",
          lessons: [
            {
              slug: "queues-vs-streams",
              title: "Queues vs Logs: Kafka, RabbitMQ, SQS",
              summary: "Work queues versus replayable logs, and how the three popular systems differ.",
              minutes: 11,
            },
            {
              slug: "delivery-semantics-and-idempotency",
              title: "Delivery Semantics & Idempotency",
              summary: "At-most-once, at-least-once, effectively-once, and how idempotent consumers close the gap.",
              minutes: 10,
            },
          ],
        },
        {
          slug: "storage",
          title: "Storage Systems",
          outcome: "Decide between object, block, and file storage and design large-file upload paths.",
          lessons: [
            {
              slug: "object-storage",
              title: "Blob & Object Storage",
              summary: "How S3-style stores work and patterns like presigned URLs and multipart upload.",
              minutes: 9,
            },
            {
              slug: "block-and-file-storage",
              title: "Block Storage & Distributed File Systems",
              summary: "Volumes, shared file systems, and the chunked design behind HDFS-style systems.",
              minutes: 8,
            },
          ],
        },
      ],
    },
    {
      name: "Production Systems",
      blurb:
        "What changes when a design has to run for years: consistency trade-offs, traffic control, operability, resilience, and security.",
      modules: [
        {
          slug: "distributed-trade-offs",
          title: "Distributed Systems Trade-offs",
          outcome:
            "Explain CAP and PACELC precisely and pick the consistency model a feature actually needs.",
          lessons: [
            {
              slug: "cap-and-pacelc",
              title: "CAP & PACELC",
              summary: "What the CAP theorem really says, and the latency trade-off PACELC adds.",
              minutes: 9,
            },
            {
              slug: "consistency-models",
              title: "Consistency Models",
              summary: "Linearizable, sequential, causal, read-your-writes, and eventual consistency explained.",
              minutes: 10,
            },
          ],
        },
        {
          slug: "traffic-management",
          title: "Traffic Management",
          outcome:
            "Implement rate limiting and route traffic through gateways and service discovery.",
          lessons: [
            {
              slug: "rate-limiting-algorithms",
              title: "Rate Limiting Algorithms",
              summary: "Token bucket, leaky bucket, fixed and sliding windows compared.",
              minutes: 10,
            },
            {
              slug: "api-gateway-and-service-discovery",
              title: "API Gateways & Service Discovery",
              summary: "A single front door for clients, and how services find each other behind it.",
              minutes: 9,
            },
          ],
        },
        {
          slug: "architecture-and-operations",
          title: "Architecture & Observability",
          outcome:
            "Argue for the right service granularity and instrument a system so you can tell when it is unhealthy.",
          lessons: [
            {
              slug: "microservices-vs-monolith",
              title: "Microservices vs Monolith",
              summary: "The real costs of splitting a system, and the modular monolith as a middle path.",
              minutes: 9,
            },
            {
              slug: "observability-and-slos",
              title: "Observability & SLOs",
              summary: "Logs, metrics, and traces, plus SLIs, SLOs, and error budgets.",
              minutes: 10,
            },
          ],
        },
        {
          slug: "resilience-and-security",
          title: "Resilience & Security",
          outcome:
            "Contain failures with timeouts, retries, circuit breakers, and bulkheads, and secure APIs with OAuth2 and JWTs.",
          lessons: [
            {
              slug: "timeouts-retries-backoff",
              title: "Timeouts, Retries, Backoff & Jitter",
              summary: "Retrying without turning a blip into an outage.",
              minutes: 9,
            },
            {
              slug: "circuit-breakers-and-bulkheads",
              title: "Circuit Breakers & Bulkheads",
              summary: "Failing fast and isolating resources so one bad dependency cannot sink everything.",
              minutes: 9,
            },
            {
              slug: "authn-authz-oauth-jwt",
              title: "AuthN, AuthZ, OAuth2 & JWT",
              summary: "Identity versus permission, delegated access, and the trade-offs of stateless tokens.",
              minutes: 11,
            },
          ],
        },
      ],
    },
    {
      name: "Advanced System Design",
      blurb:
        "Coordination, specialized data systems, global deployments, and a repeatable framework for the interview itself.",
      modules: [
        {
          slug: "distributed-coordination",
          title: "Transactions, Consensus & IDs",
          outcome:
            "Keep data consistent across services, explain how Raft elects leaders, and generate unique IDs at scale.",
          lessons: [
            {
              slug: "two-phase-commit",
              title: "Distributed Transactions & 2PC",
              summary: "Atomic commit across nodes, and why two-phase commit is rarely used across services.",
              minutes: 9,
            },
            {
              slug: "sagas-and-outbox",
              title: "Sagas & the Transactional Outbox",
              summary: "Long-running workflows with compensations, and publishing events without dual writes.",
              minutes: 11,
            },
            {
              slug: "consensus-and-raft",
              title: "Consensus & Raft",
              summary: "How a cluster agrees on an ordered log even when nodes crash.",
              minutes: 11,
            },
            {
              slug: "leader-election-and-coordination",
              title: "Leader Election & Coordination",
              summary: "Leases, fencing tokens, and coordination services like ZooKeeper and etcd.",
              minutes: 9,
            },
            {
              slug: "distributed-id-generation",
              title: "Distributed ID Generation",
              summary: "UUIDs, ticket servers, and Snowflake-style time-ordered IDs.",
              minutes: 8,
            },
          ],
        },
        {
          slug: "specialized-systems",
          title: "Search, Real-time & Geo",
          outcome:
            "Design search indexes, real-time fan-out with presence, and location queries with geohashes or quadtrees.",
          lessons: [
            {
              slug: "search-and-inverted-indexes",
              title: "Search & Inverted Indexes",
              summary: "Tokenizing, posting lists, ranking, and sharding a search cluster.",
              minutes: 10,
            },
            {
              slug: "realtime-fanout-and-presence",
              title: "Real-time Fan-out, Pub/Sub & Presence",
              summary: "Delivering events to millions of connected clients and tracking who is online.",
              minutes: 10,
            },
            {
              slug: "geospatial-indexing",
              title: "Geohash & Quadtrees",
              summary: "Turning 2D location queries into something a normal index can answer.",
              minutes: 10,
            },
          ],
        },
        {
          slug: "data-and-global-scale",
          title: "Data Pipelines & Global Scale",
          outcome:
            "Build batch and streaming pipelines fed by CDC, and design for regional failure with clear RPO/RTO targets.",
          lessons: [
            {
              slug: "batch-vs-stream-processing",
              title: "Batch vs Stream Processing",
              summary: "Bounded versus unbounded data, windows, watermarks, and late events.",
              minutes: 10,
            },
            {
              slug: "change-data-capture",
              title: "Change Data Capture",
              summary: "Streaming a database's changes to caches, search, and warehouses.",
              minutes: 8,
            },
            {
              slug: "multi-region-and-disaster-recovery",
              title: "Multi-Region & Disaster Recovery",
              summary: "Active-passive versus active-active, RPO and RTO, and data residency.",
              minutes: 11,
            },
          ],
        },
        {
          slug: "interview-playbook",
          title: "The System Design Interview",
          outcome:
            "Run a 45-minute design round end to end, with clear time boxes and well-argued trade-offs.",
          lessons: [
            {
              slug: "system-design-interview-framework",
              title: "A Framework for the 45-Minute Round",
              summary: "Requirements, estimates, API, data model, high-level design, deep dives, and wrap-up.",
              minutes: 12,
            },
            {
              slug: "deep-dives-and-trade-offs",
              title: "Driving Deep Dives & Trade-offs",
              summary: "Choosing what to go deep on and how to talk about trade-offs like a senior engineer.",
              minutes: 9,
            },
          ],
        },
      ],
    },
  ],
  practiceLabel: "Design Problems",
  practiceIntro:
    "Classic system-design questions worked end to end, from requirements and estimates to deep dives. Try each one on a whiteboard first, then compare your design against the walkthrough.",
  practice: [
    {
      slug: "url-shortener",
      title: "URL Shortener",
      level: "Easy",
      concepts: ["ID encoding", "Caching", "Read-heavy"],
      minutes: 35,
      summary: "Turn long links into short codes and redirect billions of clicks with low latency.",
    },
    {
      slug: "pastebin",
      title: "Pastebin",
      level: "Easy",
      concepts: ["Object storage", "Expiry", "CDN"],
      minutes: 35,
      summary: "Store and share text snippets with expiry and optional privacy.",
    },
    {
      slug: "unique-id-generator",
      title: "Unique ID Generator",
      level: "Easy",
      concepts: ["Snowflake", "Clock skew", "Coordination"],
      minutes: 30,
      summary: "Generate globally unique, roughly time-ordered 64-bit IDs without a central bottleneck.",
    },
    {
      slug: "leaderboard",
      title: "Real-time Leaderboard",
      level: "Easy",
      concepts: ["Redis sorted sets", "Sharding", "Ranking"],
      minutes: 35,
      summary: "Rank millions of players by score and serve top-N and my-rank queries in milliseconds.",
    },
    {
      slug: "distributed-rate-limiter",
      title: "Distributed Rate Limiter",
      level: "Medium",
      concepts: ["Token bucket", "Redis", "Atomicity"],
      minutes: 40,
      summary: "Enforce per-client request limits consistently across a fleet of API servers.",
    },
    {
      slug: "notification-system",
      title: "Notification System",
      level: "Medium",
      concepts: ["Queues", "Fan-out", "Retries"],
      minutes: 40,
      summary: "Deliver push, SMS, and email notifications reliably with user preferences and rate caps.",
    },
    {
      slug: "news-feed",
      title: "News Feed",
      level: "Medium",
      concepts: ["Fan-out", "Caching", "Ranking"],
      minutes: 45,
      summary: "Build a personalized home feed that stays fast even when celebrities post.",
    },
    {
      slug: "instagram",
      title: "Instagram",
      level: "Medium",
      concepts: ["Media pipeline", "CDN", "Feed"],
      minutes: 45,
      summary: "Upload, process, and serve photos at scale with follows, likes, and a feed.",
    },
    {
      slug: "web-crawler",
      title: "Web Crawler",
      level: "Medium",
      concepts: ["URL frontier", "Politeness", "Dedup"],
      minutes: 45,
      summary: "Crawl billions of pages politely, avoid duplicates, and keep content fresh.",
    },
    {
      slug: "search-autocomplete",
      title: "Search Autocomplete",
      level: "Medium",
      concepts: ["Trie", "Top-K", "Offline aggregation"],
      minutes: 40,
      summary: "Suggest popular completions as users type, within tens of milliseconds.",
    },
    {
      slug: "proximity-service",
      title: "Proximity Service (Yelp)",
      level: "Medium",
      concepts: ["Geohash", "Read replicas", "Caching"],
      minutes: 40,
      summary: "Find nearby businesses within a radius for hundreds of millions of users.",
    },
    {
      slug: "distributed-job-scheduler",
      title: "Distributed Job Scheduler",
      level: "Medium",
      concepts: ["Leases", "Partitioning", "Exactly-once"],
      minutes: 45,
      summary: "Run millions of scheduled and recurring jobs on time, at least once, without duplicates.",
    },
    {
      slug: "metrics-monitoring-system",
      title: "Metrics & Monitoring System",
      level: "Medium",
      concepts: ["Time-series DB", "Downsampling", "Alerting"],
      minutes: 45,
      summary: "Collect, store, query, and alert on millions of time series.",
    },
    {
      slug: "key-value-store",
      title: "Distributed Key-Value Store",
      level: "Hard",
      concepts: ["Consistent hashing", "Quorums", "Anti-entropy"],
      minutes: 50,
      summary: "Build a Dynamo-style store that stays available through node failures.",
    },
    {
      slug: "chat-system",
      title: "Chat System (WhatsApp)",
      level: "Hard",
      concepts: ["WebSockets", "Message ordering", "Presence"],
      minutes: 50,
      summary: "Deliver one-to-one and group messages in real time with offline sync and receipts.",
    },
    {
      slug: "video-streaming",
      title: "Video Streaming (YouTube/Netflix)",
      level: "Hard",
      concepts: ["Transcoding", "Adaptive bitrate", "CDN"],
      minutes: 50,
      summary: "Ingest, transcode, and stream video to millions of concurrent viewers.",
    },
    {
      slug: "cloud-file-storage",
      title: "Cloud File Storage (Dropbox)",
      level: "Hard",
      concepts: ["Chunking", "Sync", "Conflict resolution"],
      minutes: 50,
      summary: "Sync files across devices efficiently with deduplication and versioning.",
    },
    {
      slug: "ride-matching",
      title: "Ride Matching (Uber)",
      level: "Hard",
      concepts: ["Geo-indexing", "Matching", "High write rate"],
      minutes: 50,
      summary: "Track drivers in real time and match riders to nearby drivers within seconds.",
    },
    {
      slug: "ticket-booking",
      title: "Ticket Booking (BookMyShow)",
      level: "Hard",
      concepts: ["Seat holds", "Contention", "Virtual queue"],
      minutes: 50,
      summary: "Sell seats for hot events without double-booking under massive flash-sale traffic.",
    },
    {
      slug: "payment-system",
      title: "Payment System",
      level: "Hard",
      concepts: ["Idempotency", "Ledger", "Reconciliation"],
      minutes: 50,
      summary: "Move money correctly through external processors with a double-entry ledger.",
    },
    {
      slug: "ad-click-aggregation",
      title: "Ad Click Aggregation",
      level: "Hard",
      concepts: ["Stream processing", "Windows", "Exactly-once"],
      minutes: 50,
      summary: "Count billions of ad clicks per day in near real time with accurate billing totals.",
    },
    {
      slug: "collaborative-editing",
      title: "Collaborative Editing (Google Docs)",
      level: "Hard",
      concepts: ["OT/CRDT", "WebSockets", "Versioning"],
      minutes: 50,
      summary: "Let many users edit the same document simultaneously and converge on one result.",
    },
  ],
};
