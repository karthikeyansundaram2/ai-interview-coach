Quantization stores a model's numbers with fewer bits — 8 or 4 instead of 16 — so the model takes less memory and runs faster. Done carefully, you lose surprisingly little quality; done carelessly, the model quietly gets worse at exactly the things you care about.

## The analogy

A high-resolution photo might be 20 MB; a well-compressed JPEG of it is 2 MB and looks nearly identical on a phone screen. Push the compression too far and you get blocky artifacts, especially in fine details. Quantization is compression for model weights, and "fine details" are things like precise arithmetic, rare languages, and long-chain reasoning.

## Why it speeds things up

Recall that decoding is memory-bandwidth-bound: every token requires reading all the weights. Halve the bytes per weight and you roughly halve the data moved per token — so decoding can get substantially faster, and a model that didn't fit on a GPU now does.

| Precision | Bytes/param | 8B model weights | 70B model weights |
|---|---|---|---|
| FP32 | 4 | ~32 GB | ~280 GB |
| BF16 / FP16 | 2 | ~16 GB | ~140 GB |
| INT8 / FP8 | 1 | ~8 GB | ~70 GB |
| 4-bit | 0.5 | ~4 GB | ~35 GB |

(Plus KV cache and runtime overhead.)

## How it works

Map a range of floating-point values onto a small set of integers with a **scale** (and sometimes a **zero point**):

```text
 q = round(w / scale)            # store q as int8 / int4
 w ≈ q × scale                   # dequantize when computing
```

```python
import numpy as np

def quantize_groupwise(w: np.ndarray, bits=4, group=128):
    """Symmetric per-group quantization of a 1-D weight vector."""
    qmax = 2 ** (bits - 1) - 1                     # 7 for int4, 127 for int8
    w = w.reshape(-1, group)
    scale = np.abs(w).max(axis=1, keepdims=True) / qmax
    q = np.clip(np.round(w / scale), -qmax - 1, qmax).astype(np.int8)
    return q, scale

def dequantize(q, scale):
    return (q * scale).reshape(-1)

w = np.random.randn(4096).astype(np.float32)
q, s = quantize_groupwise(w, bits=4)
err = np.abs(w - dequantize(q, s)).mean()
print(f"mean abs error: {err:.4f}")                # small relative to weight scale
```

**Granularity** matters: one scale for a whole tensor is crude; per-channel or per-group (e.g., every 128 weights) scales track local ranges better at a small storage cost.

**Outliers** are the classic problem: a few very large values stretch the range and crush precision for everything else. Many methods handle them specially — keeping outlier channels in higher precision, or mathematically shifting difficulty from activations into weights.

## The main families

| Approach | What | Notes |
|---|---|---|
| Weight-only PTQ (e.g. GPTQ-, AWQ-style) | Quantize weights after training using a small calibration set | Common for 4-bit LLM serving; activations stay 16-bit |
| Weight + activation (e.g. INT8/FP8) | Quantize both | Faster matmuls on supporting hardware; activations are harder |
| Local-inference formats (e.g. GGUF) | Various bit-widths for CPU/Apple/consumer GPU | Popular for running models on laptops |
| Quantization-aware training | Simulate quantization during training | Best quality at low bits; more expensive |
| KV cache quantization | Store K/V in 8 bits or fewer | Increases concurrency and context length |

**Post-training quantization (PTQ)** needs no retraining — just a calibration dataset that should resemble your real inputs.

## Quality: measure, don't assume

At 8 bits, degradation is usually negligible. At 4 bits, well-done methods typically lose a little on general benchmarks, but losses can concentrate in:
- math and multi-step reasoning,
- code,
- low-resource languages,
- long-context tasks.

So evaluate the quantized model on **your** task eval set, not just a general benchmark, and compare against the 16-bit baseline. A smaller model at higher precision sometimes beats a larger model at very low precision, and vice versa — test both.

## Choosing a setup

- **Serving on data-center GPUs**: FP8 or INT8 where hardware supports it, or 4-bit weight-only to fit larger models / more concurrency.
- **Edge or laptop**: 4–5-bit formats designed for local runtimes.
- **Fine-tuning on a budget**: QLoRA (4-bit frozen base + LoRA adapters).

## Common mistakes

- Calibrating on data unlike production inputs (e.g., English web text for a Tamil support bot).
- Judging quality by a few chat samples instead of task evals.
- Forgetting the KV cache — weight quantization alone may not fix memory limits at long contexts.
- Assuming lower bits always means faster: unsupported kernels can make some formats slower.

## In the interview

**Q: Why does quantization speed up LLM inference?**
Decoding is memory-bandwidth-bound; fewer bytes per weight means less data moved per token, so tokens come out faster and larger models or batches fit in memory.

**Q: What's the difference between PTQ and QAT?**
Post-training quantization converts a trained model using a calibration set — cheap and common. Quantization-aware training simulates quantization during training so the model adapts — better at very low bit-widths but costly.

**Q: How would you decide whether 4-bit is acceptable for your product?**
Run the task-specific eval suite on the 4-bit and 16-bit versions, paying attention to slices like reasoning, code, and non-English inputs, and weigh any quality loss against the cost and latency gains.

## Key takeaways

- Quantization trades numerical precision for memory and speed.
- 8-bit is usually near-lossless; 4-bit is practical but needs evaluation.
- Scales, granularity, and outlier handling determine quality.
- Always evaluate on your own tasks and calibrate with representative data.
