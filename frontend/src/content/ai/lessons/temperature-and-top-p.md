An LLM doesn't output words; it outputs a probability for every token in its vocabulary. How you turn those probabilities into one chosen token — the decoding strategy — changes whether you get predictable, creative, or nonsensical text.

## The analogy

You're picking a restaurant from a ranked list your friends voted on. Always picking #1 is safe but boring (greedy). Rolling dice weighted by votes gives variety (sampling). Temperature controls how much you trust the ranking: cold means "almost always the favorite", hot means "even the 40th place has a real shot". Top-p says "only consider the places that together got 90% of the votes" — the long tail of joke suggestions is thrown out.

## The generation loop

```text
 prompt tokens ──► model ──► logits (one per vocab token)
                                 │  ÷ temperature
                                 ▼
                             softmax ──► probabilities
                                 │  top-k / top-p filtering
                                 ▼
                             sample one token ──► append ──► repeat until stop
```

## Temperature

Temperature `T` divides logits before softmax: `p_i ∝ exp(logit_i / T)`.

| T | Effect |
|---|---|
| → 0 | Approaches greedy: always the top token |
| 1.0 | The model's raw distribution |
| > 1 | Flattens the distribution; rare tokens more likely; can go off the rails |

## Top-k and top-p

- **Top-k**: keep only the `k` most likely tokens, renormalize, sample.
- **Top-p (nucleus)**: sort by probability and keep the smallest set whose cumulative probability reaches `p` (say 0.9). Adaptive: when the model is confident the nucleus may be one or two tokens; when uncertain it widens.

```python
import numpy as np

def sample_next(logits, temperature=0.8, top_p=0.9, rng=np.random.default_rng()):
    if temperature == 0:
        return int(np.argmax(logits))                  # greedy
    z = logits / temperature
    probs = np.exp(z - z.max()); probs /= probs.sum()

    order = np.argsort(probs)[::-1]                    # high -> low
    cum = np.cumsum(probs[order])
    keep = order[: np.searchsorted(cum, top_p) + 1]    # smallest set reaching top_p

    p = probs[keep] / probs[keep].sum()
    return int(rng.choice(keep, p=p))

logits = np.array([5.0, 4.2, 2.0, 0.5, -1.0])
print([sample_next(logits) for _ in range(10)])        # mostly 0 and 1
```

## Choosing settings

| Use case | Typical setting |
|---|---|
| Extraction, classification, JSON, code fixes | Temperature 0 or low |
| RAG answers, support replies | Low (around 0–0.3) |
| Brainstorming, creative writing | Higher (around 0.7–1.0), top-p ~0.9–0.95 |
| Generating diverse eval or synthetic data | Higher, plus varied prompts |

General advice: tune temperature *or* top-p, not both aggressively at once. And note that some providers restrict or ignore these parameters for certain models (for example some reasoning-focused models), so check what the API actually honors.

## Determinism is not guaranteed

Even at temperature 0, outputs can differ between runs. Batched GPU inference, floating-point non-associativity, and server-side changes can flip near-tie tokens, and a single flip changes everything after it. Design systems to tolerate variation: validate outputs, use evals with multiple samples, and don't rely on byte-identical responses for caching correctness.

## Other controls you'll see

- **Max tokens**: hard cap on output length (and cost). Truncated output is a common source of broken JSON.
- **Stop sequences**: strings that end generation early.
- **Frequency / presence penalties**: reduce repetition by penalizing tokens already used.
- **Seed**: some APIs accept one for best-effort reproducibility.

## Common mistakes

- Using high temperature for structured output and then blaming the model for invalid JSON.
- Assuming temperature 0 makes results reproducible across runs or model versions.
- Setting max tokens too low and silently truncating answers — always check the finish reason.
- Cranking both temperature and top-p, producing incoherent text.

## In the interview

**Q: What does temperature do mathematically?**
It divides logits before softmax. Below 1 sharpens the distribution toward the top token; above 1 flattens it, making unlikely tokens more probable.

**Q: Top-k vs top-p?**
Top-k keeps a fixed number of candidates; top-p keeps a variable number whose cumulative probability reaches p, so it adapts to how confident the model is. Top-p is usually the better default.

**Q: Why might the same prompt at temperature 0 give different outputs?**
Non-deterministic GPU arithmetic and batching effects can change near-tied logits, and once one token differs, the rest of the sequence diverges. Model updates on the provider side also change outputs.

## Key takeaways

- Decoding turns a probability distribution into text; it's a design choice.
- Temperature scales logits; top-p trims the unlikely tail adaptively.
- Low temperature for structured and factual tasks, higher for creative ones.
- Temperature 0 is not a determinism guarantee; always check finish reasons.
