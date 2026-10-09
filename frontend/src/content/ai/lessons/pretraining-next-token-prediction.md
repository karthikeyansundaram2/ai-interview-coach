An LLM starts life by doing one thing, billions of times: guess the next token in a piece of text, check, and adjust. That deceptively simple game, played over a large slice of the internet, books, and code, is where nearly all of a model's knowledge and skill comes from.

## The analogy

Imagine learning a language only by playing "finish the sentence" with every book in a huge library. At first you guess common words. Then grammar. To keep improving you have to understand who did what in a story, how code compiles, how a proof continues. You never get explicit lessons — the pressure to predict well forces you to build an internal model of the world the text describes.

## How it works

Take a sequence of tokens `t1 … tn`. At every position the model predicts a distribution over the next token; the loss is cross-entropy against the actual next token, averaged over positions.

```text
 input:   The   capital   of   France   is
 target:  capital  of   France   is    Paris
          ▲ each position is its own training example, all computed in parallel
```

Thanks to the causal mask, one forward pass over a 4,000-token sequence yields 4,000 training signals. That parallelism is why transformers replaced recurrent networks.

```python
import torch.nn.functional as F

def lm_loss(model, token_ids):
    # token_ids: (batch, seq_len)
    inputs  = token_ids[:, :-1]
    targets = token_ids[:, 1:]                 # shift by one
    logits  = model(inputs)                    # (batch, seq_len-1, vocab)
    return F.cross_entropy(
        logits.reshape(-1, logits.size(-1)),
        targets.reshape(-1),
    )
```

## The pretraining pipeline

```text
 raw web / books / code
        │  dedupe, filter quality, remove PII/toxic, language-id
        ▼
 cleaned corpus  ──► tokenize ──► pack into fixed-length sequences
        │
        ▼
 thousands of accelerators, weeks to months
 (data + tensor + pipeline parallelism, checkpoints, loss monitoring)
        │
        ▼
 base model: excellent at continuing text, not at following instructions
```

Data quality is a huge lever: deduplication, filtering out boilerplate and spam, and mixing domains (code, math, multilingual) in deliberate proportions all shape what the model is good at.

## Scaling laws

Researchers found that loss falls predictably as you scale three things together: parameters, training tokens, and compute. Later work showed many early models were undertrained — for a fixed compute budget, a smaller model trained on more tokens often wins. In practice, labs now frequently train smaller models far past the "compute-optimal" point because a smaller model is cheaper to *serve* for its whole lifetime.

## What a base model is (and isn't)

A base model continues text. Ask it "What is the capital of France?" and it might answer, or it might continue with three more quiz questions, because that's what such text often looks like on the web. It has knowledge and skills but no notion of being an assistant. That's what the next stages — supervised fine-tuning and preference tuning — add.

Two important consequences:

- **Knowledge cutoff**: the model only knows what was in its training data up to a date. Anything newer must come from the prompt (that's what RAG and tools are for).
- **Hallucination**: the training objective rewards plausible continuations, not true ones. When the model lacks a fact, a fluent guess is often the most "likely" text.

## Emergent and in-context abilities

Large pretrained models can follow patterns shown in the prompt without any weight updates — **in-context learning**. Give three examples of a format and the model continues the pattern. Few-shot prompting, covered later, exploits exactly this.

## Common mistakes

- Thinking the model "looks things up" during generation. It doesn't; it computes from weights plus whatever is in the context.
- Believing more parameters always beats more data. Data quantity and quality matter just as much.
- Expecting a base model to behave like a chat assistant.

## In the interview

**Q: What is the pretraining objective of a GPT-style model?**
Causal language modeling: minimize cross-entropy of the next token given all previous tokens, over a large unlabeled corpus. It's self-supervised — labels come from the text itself.

**Q: Why do LLMs hallucinate?**
They're trained to produce likely text, not verified facts. When knowledge is missing or ambiguous, a confident-sounding continuation is often the most probable output. Grounding with retrieval, tools, and calibrated refusal training reduces it.

**Q: What do scaling laws tell us?**
Loss improves predictably as a power law with model size, data, and compute. For a fixed training budget there's an optimal balance of parameters to tokens, though teams often over-train smaller models to cut inference costs.

## Key takeaways

- Pretraining = next-token prediction with cross-entropy, self-supervised, massively parallel.
- Data curation is as important as model size.
- The output is a base model: knowledgeable but not an assistant.
- Knowledge cutoffs and hallucination are direct consequences of the objective.
