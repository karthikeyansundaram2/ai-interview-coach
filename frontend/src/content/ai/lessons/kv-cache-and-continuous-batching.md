Serving an LLM efficiently is mostly a memory problem, not a compute problem. The KV cache and continuous batching are the two ideas that let an inference server handle many users at once without wasting expensive GPU time.

## The analogy

Imagine a translator working on a long document, adding one word at a time. Re-reading the whole document before writing each new word would be absurd, so they keep notes on everything so far (the KV cache). And a good translation agency doesn't wait for all of today's jobs to finish before starting new ones; as soon as one translator frees up, the next job slides in (continuous batching).

## Prefill vs decode

Generation has two phases with very different characteristics:

```text
 PREFILL                                  DECODE
 process all prompt tokens in parallel    generate one token at a time
 compute-bound (big matrix multiplies)    memory-bandwidth-bound (read all weights per token)
 determines time to first token           determines time per output token
```

In decode, producing each token requires reading every model weight from GPU memory, but doing very little math per byte read. A single request leaves the GPU's compute mostly idle. Batching many requests together amortizes each weight read across many tokens — that's why throughput depends so heavily on batching.

## The KV cache

In attention, each new token needs the keys and values of all previous tokens. Without caching, generating token 500 would recompute K and V for tokens 1–499 again. The KV cache stores them once and appends as generation proceeds.

```text
 step t:   new token ──► compute q_t, k_t, v_t
                         append k_t, v_t to cache
                         attend q_t over [k_1..k_t], [v_1..v_t]
```

The cost is memory, and it adds up fast:

```text
 KV bytes per token ≈ 2 (K and V) × layers × kv_heads × head_dim × bytes_per_value

 e.g. 32 layers × 8 kv_heads × 128 head_dim × 2 × 2 bytes ≈ 128 KB per token
      → a 32k-token context ≈ 4 GB for ONE sequence
```

```python
def kv_cache_gb(layers, kv_heads, head_dim, seq_len, batch, bytes_per_val=2):
    per_token = 2 * layers * kv_heads * head_dim * bytes_per_val
    return per_token * seq_len * batch / 1e9

def max_concurrent_seqs(gpu_gb, weights_gb, overhead_gb, layers, kv_heads, head_dim, avg_len):
    free = gpu_gb - weights_gb - overhead_gb
    return int(free / kv_cache_gb(layers, kv_heads, head_dim, avg_len, 1))

# 80 GB GPU, ~16 GB of weights (8B model in 16-bit), 4 GB overhead, 4k-token average sequences
print(max_concurrent_seqs(80, 16, 4, layers=32, kv_heads=8, head_dim=128, avg_len=4096))  # ~111
```

This is why techniques that shrink the KV cache matter so much:
- **Grouped-query / multi-query attention**: fewer KV heads than query heads.
- **KV cache quantization**: 8-bit or lower cache values.
- **Paged attention**: store the cache in fixed-size blocks (like OS virtual memory pages) so memory isn't wasted on fragmentation or over-reserved maximum lengths. This dramatically raises how many sequences fit.
- **Prefix caching**: share the KV blocks of identical prompt prefixes across requests — the self-hosted version of provider prompt caching.

## Continuous batching

**Static batching** groups requests, runs them together, and waits for the longest to finish before starting new ones. Short requests sit idle; GPU slots are wasted.

**Continuous (in-flight) batching** schedules at the token-step level: when one sequence finishes, a waiting request joins the batch on the very next step.

```text
 static:      [A A A A A A A A][B B B . . . . .][C C . . . . . .]  ← idle slots until A finishes
 continuous:  A A A A A A A A
              B B B D D D D D       ← D starts the moment B finishes
              C C E E E F F F
```

Modern inference servers (vLLM, TGI, TensorRT-LLM, SGLang and others) combine continuous batching, paged KV cache, prefix caching, and optimized attention kernels. Many also split long prefills into chunks so they don't stall everyone's decode steps.

## The throughput–latency trade-off

Bigger batches mean higher total tokens/second (cheaper per token) but slower per-user generation. Production serving tunes max batch size and scheduling to meet latency SLOs (TTFT and inter-token latency at p95) at the lowest cost.

## Speculative decoding (recap)

A small draft model proposes several tokens; the large model verifies them in one forward pass. Since decode is memory-bound, verifying several tokens costs about the same as generating one — so accepted drafts are nearly free speedups.

## Common mistakes

- Sizing GPUs by weights alone and forgetting KV cache for concurrent long contexts.
- Benchmarking throughput with one request at a time.
- Setting max context length far above real needs, reserving memory that could serve more users.
- Ignoring prefill cost for long-prompt workloads like RAG.

## In the interview

**Q: What is the KV cache and why does it matter?**
It stores attention keys and values for previous tokens so each decode step computes only the new token's. It trades memory for compute, and its size — layers × KV heads × head dim × sequence length × batch — often limits how many concurrent requests a GPU can serve.

**Q: Why is LLM decoding memory-bound?**
Each token requires reading all weights from memory but performs relatively little computation per byte. Batching many sequences amortizes the weight reads, increasing throughput.

**Q: Explain continuous batching.**
The scheduler adds new requests and removes finished ones at every decode step instead of waiting for a whole batch to finish, keeping the GPU saturated and reducing queueing delay.

## Key takeaways

- Prefill is compute-bound (TTFT); decode is memory-bound (per-token speed).
- The KV cache avoids recomputation but dominates memory at scale.
- Paged attention, GQA, prefix caching, and KV quantization stretch memory.
- Continuous batching keeps GPUs busy; tune batch size against latency SLOs.
