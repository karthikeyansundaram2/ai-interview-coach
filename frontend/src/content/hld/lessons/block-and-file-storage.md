Not everything fits the object-storage model. Databases need low-latency random writes on block devices, and some workloads need a shared, mountable file system. Distributed file systems like HDFS and GFS show how to store huge files across thousands of machines.

## The analogy

Block storage is a blank notebook issued to one person: they can write on any page, erase, and rewrite instantly, but nobody else can use it at the same time. A shared file system is a library reading room where many people can open the same folders. A distributed file system is a library that tears very large books into chapters, stores each chapter in three different buildings, and keeps a central card catalogue of where each chapter lives.

## Block storage

- Exposes a raw volume of fixed-size blocks; the operating system puts a file system on it.
- Attached to one instance at a time (mostly), like a virtual disk.
- Very low latency (sub-millisecond on SSD) and supports random reads and writes.
- **Network block storage** (EBS, Persistent Disk) survives instance failure and can be snapshotted; **local NVMe** is faster but lost when the instance goes away.
- Provisioned IOPS and throughput are key knobs: a database's write latency often depends on them.

Use it for database data directories, message broker logs, and boot volumes.

## Network file systems

- Shared POSIX file system mounted by many machines (NFS, EFS, Azure Files, FSx, Lustre).
- Supports directories, permissions, locks, and partial edits.
- Higher latency than block storage, and metadata operations (listing large directories, many small files) can be slow.
- Useful for legacy applications, shared configuration, CMS uploads, and ML training data (Lustre for high throughput).

## Distributed file systems (GFS/HDFS design)

```text
                +----------------------+
 Client --meta-->|  NameNode / Master   |  file -> [chunk ids] -> [chunk locations]
                +----------+-----------+
                           | heartbeats, block reports
     +---------------------+---------------------+
     v                     v                     v
 DataNode 1            DataNode 2            DataNode 3
 [c1][c4][c7]          [c1][c2][c5]          [c2][c4][c7] ...
 Client reads/writes chunk data directly with DataNodes
```

- Files are split into large chunks (64–128 MB), each replicated (typically 3x) across racks.
- A **metadata master** holds the namespace and chunk locations in memory; clients ask it where chunks live, then stream data directly from data nodes.
- Optimized for large sequential reads and appends, not random writes or many tiny files (each file costs master memory).
- The master is a scaling limit and a single point of failure, addressed with standby masters, federation, or by moving to object storage.
- Rack-aware placement: one replica local, others on a different rack, to survive rack failures while limiting cross-rack traffic.
- **Data locality**: compute frameworks schedule work on nodes that already hold the chunks.

Today many data platforms store data in object storage instead of HDFS, separating compute from storage, but the chunking, replication, and metadata-service ideas reappear everywhere, including in designs for Dropbox-style systems.

## Comparison

| Need | Choose |
|---|---|
| Database or broker on a VM | Block storage (provisioned IOPS SSD) |
| Many servers need the same files with POSIX semantics | Network file system |
| Petabytes of analytics data | Object storage (data lake) or HDFS |
| User uploads and media | Object storage |
| Highest IOPS, data can be rebuilt | Local NVMe with replication at the application layer |

## Erasure coding vs replication

Replicating 3x costs 200% storage overhead. Erasure coding (for example 6 data + 3 parity fragments) tolerates losing any 3 fragments with only 50% overhead, at the cost of more CPU and slower reconstruction. Hot data is often replicated; warm and cold data is erasure coded.

## Common mistakes

- Running a database on a shared network file system.
- Storing millions of tiny files in HDFS and exhausting NameNode memory.
- Using local instance storage for data without replication, then losing it when the instance is replaced.
- Under-provisioning IOPS and blaming the database for slow writes.

## In the interview

**Q: Where would you store a self-managed Kafka cluster's data?**
On block storage (or local NVMe) attached to each broker, relying on Kafka's own replication across brokers in different zones.

**Q: Why are chunks in HDFS so large?**
Large chunks keep the metadata small enough to fit in the master's memory and favour high-throughput sequential reads, which is what batch analytics needs.

**Q: When would you use erasure coding?**
For large, less frequently accessed data where storage cost dominates and slightly slower reads or rebuilds are acceptable.

## Key takeaways

- Block storage: low-latency random I/O for one machine; ideal for databases.
- File storage: shared POSIX access; convenient but slower for metadata-heavy work.
- Distributed file systems split files into replicated chunks tracked by a metadata service.
- Erasure coding cuts storage overhead versus replication at a CPU and latency cost.
