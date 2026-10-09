Attention lets every token in a sentence look at every other token and decide which ones matter for understanding it. It's the single idea that made transformers — and therefore LLMs — work.

## The analogy

You walk into a library with a question (your **query**). Every book has a label on its spine (its **key**) and content inside (its **value**). You compare your question to each spine label, decide how relevant each book is, and then read a blend of their contents weighted by that relevance. You don't pick one book; you take a weighted mix. That's attention.

## How it works

For each token, the model computes three vectors by multiplying its embedding by three learned matrices:

- **Query (Q)**: what am I looking for?
- **Key (K)**: what do I contain, for others searching?
- **Value (V)**: what will I hand over if chosen?

Then:

```text
 scores  = Q · Kᵀ / √d_k          # how well each query matches each key
 weights = softmax(scores)        # each row sums to 1
 output  = weights · V            # weighted mix of values
```

The `√d_k` scaling keeps dot products from growing too large, which would make softmax extremely peaky and gradients tiny.

Take "The cat sat on the mat because **it** was soft." When processing "it", its query will match the key of "mat" strongly, so the output for "it" pulls in information from "mat". The model learns these matching patterns from data.

```text
           The   cat   sat   on   the   mat  because  it
 "it" →   0.02  0.10  0.03  0.01 0.04  0.71   0.04   0.05
                                         ▲
                              most attention lands here
```

## In code

```python
import numpy as np

def softmax(x, axis=-1):
    x = x - x.max(axis=axis, keepdims=True)
    e = np.exp(x)
    return e / e.sum(axis=axis, keepdims=True)

def attention(X, Wq, Wk, Wv, causal=True):
    Q, K, V = X @ Wq, X @ Wk, X @ Wv            # (seq, d_k)
    scores = Q @ K.T / np.sqrt(K.shape[-1])     # (seq, seq)
    if causal:                                  # a token may not see the future
        mask = np.triu(np.ones_like(scores), k=1).astype(bool)
        scores = np.where(mask, -1e9, scores)
    weights = softmax(scores)
    return weights @ V, weights

rng = np.random.default_rng(0)
seq_len, d_model, d_k = 5, 16, 8
X = rng.normal(size=(seq_len, d_model))
Wq, Wk, Wv = (rng.normal(0, 0.3, (d_model, d_k)) for _ in range(3))
out, w = attention(X, Wq, Wk, Wv)
print(w.round(2))    # lower-triangular: each row attends only to itself and earlier tokens
```

## Causal masking

LLMs generate left to right, so during training each position must not peek at later tokens. The **causal mask** sets future scores to negative infinity before softmax, giving them zero weight. That one mask turns a generic attention layer into a next-token predictor.

## Multi-head attention

One set of Q/K/V matrices learns one kind of relationship. **Multi-head attention** runs several smaller attention operations in parallel, each with its own matrices — one head might track syntax, another coreference, another position. Their outputs are concatenated and projected back to the model dimension.

## The cost: quadratic in length

The score matrix is `seq_len × seq_len`. Double the context and attention compute and memory roughly quadruple. This is why long contexts are expensive, why optimized kernels (like FlashAttention-style implementations that avoid materializing the full matrix) matter, and why serving systems cache keys and values (the **KV cache**) instead of recomputing them for every new token.

## Common mistakes

- Thinking attention weights are a faithful "explanation" of model reasoning. They're one signal among many layers and heads.
- Forgetting that attention itself is order-agnostic; position information must be added separately.
- Assuming a long context window means the model uses all of it equally well — retrieval from the middle of very long contexts can be weaker.

## In the interview

**Q: Explain self-attention.**
Each token is projected into a query, key, and value. Query–key dot products, scaled and softmaxed, give weights over all tokens; the output is the weighted sum of values. It lets each token gather context from any other token in one step.

**Q: Why divide by √d_k?**
Dot products grow with dimension, pushing softmax into saturated regions with near-zero gradients. Scaling keeps the variance stable.

**Q: Why is long context expensive?**
Attention compares every token with every other token, so cost grows quadratically with sequence length, and the KV cache grows linearly in memory per request.

## Key takeaways

- Attention = softmax(QKᵀ/√d)·V: a relevance-weighted mix of other tokens' information.
- Causal masking hides future tokens, enabling next-token prediction.
- Multiple heads learn different relationships in parallel.
- Cost is quadratic in sequence length — the root of long-context expense and KV caching.
