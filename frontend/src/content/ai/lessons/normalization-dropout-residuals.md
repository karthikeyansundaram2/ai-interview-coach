Stacking dozens of layers sounds easy until training falls apart. Three small ideas — residual connections, normalization, and dropout — are what make deep networks, including every transformer, trainable at all.

## The analogy

Imagine passing a message through a chain of 50 translators. By the end, the meaning is mangled. Now change the rules: each translator receives the original *and* writes only a short note of corrections on top (residuals). Before reading, each one rescales the text to a standard font size so nobody is overwhelmed by shouting (normalization). And on any given day, a few translators are randomly absent, so nobody can rely on a single colleague (dropout).

## Residual connections

A residual (or skip) connection adds a layer's input to its output:

```text
         ┌──────────────────┐
 x ──────┤                  │
   │     │  F(x): layer(s)  ├──► (+) ──► x + F(x)
   └─────┴──────────────────┴─────▲
         (identity shortcut)
```

The layer only has to learn the *change* `F(x)` rather than the whole transformation. Crucially, gradients can flow straight back through the `+` without being shrunk, which fixes the vanishing-gradient problem for very deep stacks. In a transformer, every attention and feed-forward sublayer sits inside a residual connection; people describe the running sum as the **residual stream** that each layer reads from and writes to.

## Normalization

As training proceeds, the scale of activations drifts, which makes optimization unstable. Normalization layers rescale activations to a consistent range, then apply learned scale and shift.

| Type | Normalizes over | Used in |
|---|---|---|
| BatchNorm | The batch dimension, per feature | CNNs for vision |
| LayerNorm | The features of a single example | Transformers |
| RMSNorm | Like LayerNorm but only rescales (no mean subtraction) | Many modern LLMs; slightly cheaper |

Transformers use LayerNorm or RMSNorm because they work per token and don't depend on batch size — important when serving one request at a time. Most modern LLMs apply the norm *before* each sublayer ("pre-norm"), which tends to be more stable than the original "post-norm" placement.

## Dropout

During training, dropout zeros a random fraction of activations (say 10%) and rescales the rest. The network can't depend on any single unit, so it learns redundant, more general features. At inference, dropout is switched off. Very large LLM pretraining runs often use little or no dropout because they see so much data that overfitting is not the main risk, but dropout reappears in fine-tuning — LoRA configs commonly include a `lora_dropout` value.

## A pre-norm residual block

```python
import torch
import torch.nn as nn

class RMSNorm(nn.Module):
    def __init__(self, dim, eps=1e-6):
        super().__init__()
        self.eps, self.weight = eps, nn.Parameter(torch.ones(dim))
    def forward(self, x):
        rms = x.pow(2).mean(-1, keepdim=True).add(self.eps).rsqrt()
        return x * rms * self.weight

class Block(nn.Module):
    def __init__(self, dim, p_drop=0.1):
        super().__init__()
        self.norm = RMSNorm(dim)
        self.ff = nn.Sequential(nn.Linear(dim, 4 * dim), nn.GELU(), nn.Linear(4 * dim, dim))
        self.drop = nn.Dropout(p_drop)
    def forward(self, x):
        return x + self.drop(self.ff(self.norm(x)))   # residual around norm -> ff -> dropout

block = Block(64)
block.train()   # dropout active
block.eval()    # dropout disabled for inference
```

## Common mistakes

- Forgetting `model.eval()` at inference, so dropout keeps randomly zeroing activations and outputs become noisy.
- Using BatchNorm with tiny or variable batch sizes; statistics become unreliable.
- Thinking residuals are an optional optimization. Remove them from a deep transformer and it simply won't train well.
- Adding heavy dropout to a model that is underfitting.

## In the interview

**Q: Why do transformers use LayerNorm rather than BatchNorm?**
LayerNorm normalizes each token's features independently of other examples, so it behaves identically regardless of batch size or sequence padding, and works for single-request inference. BatchNorm depends on batch statistics, which are noisy for variable-length sequences and small batches.

**Q: What problem do residual connections solve?**
They give gradients a direct path back through the network, preventing them from vanishing in deep stacks, and let each layer learn an incremental update instead of a full transformation.

**Q: Is dropout active at inference?**
No. It's only applied in training mode; at inference all units are used. Forgetting to switch modes is a classic bug.

## Key takeaways

- Residuals: output = input + update; they keep gradients flowing.
- Normalization keeps activation scales stable; transformers use LayerNorm or RMSNorm.
- Dropout is a training-only regularizer.
- Every transformer block is "norm → sublayer → add to residual stream".
