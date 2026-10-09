Logprobs are the model showing its work: the log-probability it assigned to each token it produced, and often to the runner-up candidates. Combined with smarter decoding strategies, they turn a black-box text generator into something you can measure, constrain, and debug.

## The analogy

A student answering a multiple-choice exam writes down not just "B" but "B, about 70% sure; C, 25%". A teacher can now tell confident right answers from lucky guesses, and spot the questions where the student was torn. Logprobs give you that confidence trail for every token.

## What a logprob is

For a chosen token with probability `p`, the logprob is `log(p)` — always ≤ 0. Values near 0 mean near-certainty; −2.3 means about 10%. Summing logprobs over a sequence gives the log-probability of the whole sequence (multiplying probabilities in log space avoids underflow).

Many APIs can return, per output token, its logprob and the top-N alternatives.

```python
import math

def label_confidence(response):
    """Classify with a single-token answer and read the probability of each label."""
    first = response.tokens[0]             # e.g. {"token": "yes", "logprob": -0.05,
                                            #       "top": [("yes", -0.05), ("no", -3.1)]}
    probs = {tok.strip().lower(): math.exp(lp) for tok, lp in first["top"]}
    yes, no = probs.get("yes", 0.0), probs.get("no", 0.0)
    return yes / (yes + no) if (yes + no) else None

def sequence_logprob(tokens):
    total = sum(t["logprob"] for t in tokens)
    avg = total / len(tokens)
    return total, math.exp(-avg)           # total logprob, perplexity of this output
```

## Practical uses

| Use | How |
|---|---|
| Confidence scores for classification | Ask for a single-token label, read its probability |
| Routing / abstention | Low confidence → escalate to a bigger model or a human |
| Hallucination hints | Spans with low-probability tokens (names, numbers) deserve verification |
| Ranking candidates | Score several completions by average logprob |
| Debugging prompts | See where the model was uncertain or nearly chose something else |

Caveat: preference-tuned chat models are often **poorly calibrated** — 90% confidence doesn't mean right 90% of the time. Calibrate against a labeled set before you set thresholds.

## Decoding strategies beyond sampling

**Greedy decoding** picks the argmax every step. Simple and deterministic-ish, but can get stuck in repetitive loops and misses sequences that start with a slightly less likely token.

**Beam search** keeps the `b` best partial sequences at each step and expands all of them, finally returning the highest-scoring complete sequence.

```text
 step 1:  "The"(-0.1)   "A"(-0.9)
 step 2:  "The cat"(-0.6) "The dog"(-0.8) "A cat"(-1.3) ...  keep top b=2
 step 3:  expand both, keep top 2 again ...
```

Beam search suits tasks with one correct output (translation, speech recognition). For open-ended chat it tends to produce bland, repetitive text, so chat systems sample instead.

**Constrained (structured) decoding** masks out any token that would violate a grammar or JSON schema at each step. The model can only generate valid output. This is how many "structured output" and "JSON mode" features work under the hood, and libraries exist to do it for self-hosted models.

```text
 schema expects:  {"priority": "low" | "high"}
 after '{"priority": "'  →  allowed next tokens: only those starting "low" or "high"
```

**Speculative decoding** is a speed trick, not a quality one: a small draft model proposes several tokens, the large model verifies them in one pass, accepting the ones it agrees with. Output distribution is preserved while latency drops.

**Self-consistency / best-of-n**: sample several answers and take a majority vote or the one a verifier scores highest. Costs more tokens, often boosts accuracy on reasoning tasks.

## Common mistakes

- Treating raw logprobs from a chat model as calibrated probabilities.
- Asking for a multi-word label, then reading only the first token's probability (" Pos" vs " Positive" splits).
- Using beam search for chat and getting dull, repetitive answers.
- Forgetting that constrained decoding guarantees *syntax*, not correct *content*.

## In the interview

**Q: How would you get a confidence score from an LLM classifier?**
Constrain the answer to single-token labels, request logprobs, and normalize the probabilities over the label set. Then calibrate thresholds on a labeled validation set because chat models are often overconfident.

**Q: When is beam search appropriate?**
When there's essentially one correct output and you want the most likely full sequence — translation, transcription. For open-ended generation it produces generic text; sampling is better.

**Q: How does structured output guarantee valid JSON?**
With constrained decoding: at each step, tokens that would break the schema or grammar are masked out before sampling, so only valid continuations are possible.

## Key takeaways

- Logprobs reveal per-token confidence; use them for classification scores, routing, and debugging.
- Chat-model confidence is often miscalibrated — calibrate before thresholding.
- Greedy and beam search maximize likelihood; sampling adds diversity.
- Constrained decoding enforces format; speculative decoding speeds things up without changing outputs.
