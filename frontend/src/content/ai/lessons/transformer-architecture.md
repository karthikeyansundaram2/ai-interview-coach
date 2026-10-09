A transformer is attention plus a few supporting parts, repeated many times. Once you can sketch one block, you can sketch every modern LLM — they differ mostly in size and small refinements.

## The analogy

Think of an assembly line with identical workstations. At each station, two things happen: first the workers **confer** (attention — every item on the line can check on the others), then each one **works alone** on their own item (the feed-forward network). Each station adds its improvements to a shared clipboard that travels down the line (the residual stream). After dozens of stations, the clipboard holds enough to predict what comes next.

## The big picture (decoder-only)

```text
 tokens ──► embedding lookup (+ position info)
              │
              ▼
   ┌──────────────────────────────┐
   │  RMSNorm                     │
   │  Masked multi-head attention │──(+) residual
   │  RMSNorm                     │
   │  Feed-forward (MLP)          │──(+) residual
   └──────────────────────────────┘   × N layers
              │
              ▼
          final norm
              │
          linear "unembedding" ──► logits over vocabulary ──► softmax ──► next token
```

The original 2017 transformer had an **encoder** (reads input, bidirectional attention) and a **decoder** (generates output, causal attention). Families split from there:

| Variant | Attention | Typical use |
|---|---|---|
| Encoder-only | Bidirectional | Classification, embeddings, rerankers |
| Encoder–decoder | Both, plus cross-attention | Translation, some summarization |
| Decoder-only | Causal | Today's general-purpose chat LLMs |

## The parts

**Attention sublayer.** Multi-head causal self-attention mixes information *across* positions. Modern variants share keys and values across groups of heads (multi-query or grouped-query attention) to shrink the KV cache and speed up inference.

**Feed-forward sublayer.** A two-layer MLP applied to each position independently — expand to several times the model width, apply a non-linearity (often a gated variant like SwiGLU), project back. Most of a model's parameters live here. A useful mental model: attention moves information between tokens; the MLP processes and stores knowledge.

**Positional information.** Attention is order-blind, so position must be injected. The original paper added fixed sinusoidal vectors; many modern LLMs use **rotary position embeddings (RoPE)**, which rotate query and key vectors by an angle depending on position so that their dot product encodes relative distance. Techniques for extending context length often work by adjusting how these rotations scale.

**Residuals and norms.** Each sublayer reads a normalized copy of the residual stream and adds its output back. That's what makes stacking dozens of layers trainable.

**Output head.** A final linear layer maps the last hidden state to one logit per vocabulary token; it often shares weights with the input embedding table.

## A compact block

```python
import torch, torch.nn as nn, torch.nn.functional as F

class DecoderBlock(nn.Module):
    def __init__(self, d=512, heads=8):
        super().__init__()
        self.n1, self.n2 = nn.LayerNorm(d), nn.LayerNorm(d)
        self.attn = nn.MultiheadAttention(d, heads, batch_first=True)
        self.mlp = nn.Sequential(nn.Linear(d, 4 * d), nn.GELU(), nn.Linear(4 * d, d))

    def forward(self, x):
        T = x.size(1)
        causal = torch.triu(torch.ones(T, T, dtype=torch.bool, device=x.device), 1)
        h = self.n1(x)
        a, _ = self.attn(h, h, h, attn_mask=causal, need_weights=False)
        x = x + a                       # residual 1
        x = x + self.mlp(self.n2(x))    # residual 2
        return x

class TinyLM(nn.Module):
    def __init__(self, vocab=32000, d=512, layers=6, max_len=1024):
        super().__init__()
        self.tok, self.pos = nn.Embedding(vocab, d), nn.Embedding(max_len, d)
        self.blocks = nn.ModuleList(DecoderBlock(d) for _ in range(layers))
        self.norm, self.head = nn.LayerNorm(d), nn.Linear(d, vocab, bias=False)

    def forward(self, ids, targets=None):
        x = self.tok(ids) + self.pos(torch.arange(ids.size(1), device=ids.device))
        for b in self.blocks:
            x = b(x)
        logits = self.head(self.norm(x))
        if targets is None:
            return logits
        return F.cross_entropy(logits.view(-1, logits.size(-1)), targets.view(-1))
```

## Mixture of experts

Some large models replace the single MLP with many "expert" MLPs and a router that sends each token to only a few. Total parameters grow, but compute per token stays modest. The trade-off: all experts must still sit in memory.

## Common mistakes

- Saying "BERT is an LLM like the chat models". It's encoder-only and doesn't generate text left to right.
- Forgetting the MLP; attention gets the attention, but most parameters are in the feed-forward layers.
- Assuming mixture-of-experts models are cheap to host because they're cheap per token.

## In the interview

**Q: Walk me through a decoder-only transformer.**
Tokens are embedded, position info is added (often via RoPE). Each of N blocks applies normalized causal multi-head attention and a normalized MLP, each wrapped in a residual connection. A final norm and linear head produce vocabulary logits; softmax gives next-token probabilities.

**Q: What's the role of the feed-forward layer?**
It transforms each position independently and holds most parameters; it's where much factual and pattern knowledge is thought to be stored. Attention moves information between positions.

**Q: Why are encoder-only models used for rerankers and embeddings?**
Bidirectional attention lets every token see the full input, which produces better representations for understanding tasks where nothing needs to be generated.

## Key takeaways

- A block = norm → causal attention → add, norm → MLP → add; stack N times.
- Attention mixes across tokens; the MLP processes each token and holds most weights.
- Position comes from added embeddings or rotary encodings.
- Decoder-only for generation, encoder-only for understanding/retrieval.
