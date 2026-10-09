Supervised fine-tuning (SFT) teaches a base model to act like an assistant by showing it many examples of good conversations. The knowledge was already there from pretraining; SFT teaches the manners and the format.

## The analogy

A brilliant new hire has read every manual in the company but has never talked to a customer. You don't re-teach them the product. You sit them down with a binder of model support transcripts — "when someone asks this, a great reply looks like that" — and after a few hundred examples they've picked up the tone, structure, and boundaries.

## How it works

SFT uses the same next-token loss as pretraining, but on a curated dataset of `(prompt, ideal response)` pairs formatted with a **chat template** — special tokens that mark system, user, and assistant turns.

```text
 <|system|> You are a helpful assistant. <|end|>
 <|user|> Summarize this paragraph: ... <|end|>
 <|assistant|> The paragraph argues that ... <|end|>
              ▲───────────── loss computed only here ─────────────▲
```

A key detail: **loss masking**. You usually compute loss only on the assistant tokens. Training on the user's text would teach the model to imitate users, which wastes capacity and can create odd behavior.

```python
IGNORE = -100   # common convention: label value ignored by cross-entropy

def build_example(tokenizer, messages):
    input_ids, labels = [], []
    for msg in messages:
        ids = tokenizer.encode(render_turn(msg), add_special_tokens=False)
        input_ids += ids
        if msg["role"] == "assistant":
            labels += ids                    # learn to produce these
        else:
            labels += [IGNORE] * len(ids)    # context only
    return {"input_ids": input_ids, "labels": labels}

def render_turn(msg):
    return f"<|{msg['role']}|>{msg['content']}<|end|>"
```

## What goes into an SFT dataset

- Instruction following across many task types (summarize, classify, extract, write, code).
- Multi-turn conversations, including clarifying questions.
- Refusals for harmful requests and honest "I don't know" responses.
- Tool-use traces: the assistant emitting a function call, receiving results, and answering.
- Formatting conventions (Markdown, JSON on request).

Quality beats quantity. Several research results showed that a few thousand carefully written examples can produce a surprisingly capable assistant, while large noisy datasets teach noisy behavior. Many teams also use stronger models to generate synthetic examples, then filter them.

## What SFT can and can't do

| SFT is good at | SFT is weak at |
|---|---|
| Format, tone, persona | Adding lots of new factual knowledge reliably |
| Task-specific behavior (extraction schema, style) | Ranking between several acceptable answers |
| Teaching tool-call formats | Making the model reliably prefer "better" over "fine" |

Trying to inject new facts via SFT tends to work poorly and can even increase hallucination — the model learns to state things confidently that it doesn't robustly know. That's a big reason RAG is usually preferred for knowledge.

The second weakness is why SFT is followed by **preference tuning**: imitation teaches what a good answer looks like, but comparing answers teaches what makes one *better*.

## SFT in your world

As an application engineer you'll meet SFT when you fine-tune an open model for a narrow task (classification, extraction, a house style) or when you use a provider's fine-tuning API. The same rules apply: clean examples, correct chat template, loss on the response only, a held-out eval set, and few epochs to avoid memorization.

## Common mistakes

- Using a chat template that doesn't match the model's — the model sees unfamiliar tokens and performance drops.
- Computing loss on the whole sequence including prompts.
- Training on outputs scraped from another product without checking terms and quality.
- Fine-tuning to teach facts that change; you'll be retraining forever.

## In the interview

**Q: What's the difference between pretraining and SFT?**
Same next-token objective, different data and goal. Pretraining uses huge unlabeled corpora to build knowledge; SFT uses a small, curated set of prompt–response demonstrations to teach instruction following and format, with loss usually masked to response tokens.

**Q: Why mask the prompt tokens in SFT?**
We want the model to learn to produce assistant responses, not to model user inputs. Masking focuses the gradient on the behavior we care about.

**Q: Would you use SFT to teach a model your company's product catalog?**
Generally no. Facts change and SFT is unreliable for knowledge injection. I'd use RAG for the catalog and reserve fine-tuning for behavior — tone, format, or a narrow task.

## Key takeaways

- SFT = next-token training on curated demonstrations in a chat template.
- Mask loss to assistant tokens; match the model's template exactly.
- Small, high-quality datasets beat large noisy ones.
- SFT shapes behavior and format; it is a poor tool for injecting changing knowledge.
