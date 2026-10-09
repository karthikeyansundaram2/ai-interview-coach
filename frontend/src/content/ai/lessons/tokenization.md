LLMs never see letters or words — they see tokens, integer IDs for chunks of text. Tokenization quietly decides your costs, your context limits, and some of the strangest failures models make.

## The analogy

Think of a shorthand stenographer. Very common phrases like "the" or "ing" get a single squiggle; rare words get spelled out using several smaller squiggles. The stenographer's dictionary is fixed in advance. Tokenizers work the same way: frequent chunks get their own ID, rare strings are split into pieces.

## Why subwords

There are three obvious choices for units of text:

| Unit | Problem |
|---|---|
| Characters | Sequences become very long; attention cost grows fast |
| Whole words | Vocabulary explodes; unknown words ("Kubernetes-ish") can't be represented |
| **Subwords** | Balance: common words are one token, rare words are a few |

Most LLMs use a subword scheme such as **byte-pair encoding (BPE)** or a close cousin (WordPiece, Unigram/SentencePiece). Byte-level BPE starts from raw bytes, so *any* string — emoji, code, Tamil script — can be encoded without an "unknown" token.

## How BPE is built

1. Start with a vocabulary of single bytes.
2. Count every adjacent pair in a large corpus.
3. Merge the most frequent pair into a new token, add it to the vocabulary.
4. Repeat until the vocabulary reaches the target size (at the time of writing, typically tens of thousands to a few hundred thousand tokens).

```text
 "lower lowest"  →  l o w e r _ l o w e s t
 merge (l,o)     →  lo w e r _ lo w e s t
 merge (lo,w)    →  low e r _ low e s t
 merge (e,r)     →  low er _ low e s t
```

At encode time, the learned merges are applied in order to new text.

```python
import tiktoken   # an open-source BPE tokenizer library

enc = tiktoken.get_encoding("cl100k_base")
for text in ["hello world", "Kubernetes", "    def foo():", "வணக்கம்"]:
    ids = enc.encode(text)
    pieces = [enc.decode([i]) for i in ids]
    print(f"{text!r:22} {len(ids):2} tokens  {pieces}")
```

You'll see that English prose averages a little under one token per word, code with lots of whitespace costs more, and many non-Latin scripts cost several tokens per word.

## Why tokenization matters in practice

- **Cost and limits**: APIs bill and cap by tokens, not characters. The same content in a non-English language or verbose JSON can cost noticeably more.
- **Different models, different tokenizers**: token counts are not portable. Always count with the tokenizer of the model you'll call.
- **Spelling and arithmetic quirks**: "How many r's in strawberry?" is hard partly because the model sees `straw` + `berry`, not letters. Numbers split into odd chunks, which hurts digit-level math.
- **Leading spaces**: `" hello"` and `"hello"` are usually different tokens. This matters for logprob tricks and for stop sequences.
- **Special tokens**: chat models use reserved tokens to mark roles and turn boundaries. Letting user text inject those strings was an early security bug class; modern APIs handle this, but it's worth knowing.

## Budgeting a context window

```text
 ┌──────────────────────── context window ────────────────────────┐
 │ system prompt │ tools schema │ retrieved docs │ history │ query │ reserved for output │
 └──────────────────────────────────────────────────────────────────┘
```

Input and output share the window. If you fill it with retrieved chunks, there's no room left for the answer. Production code counts tokens before sending and trims history or documents to a budget.

## Common mistakes

- Estimating tokens as `len(text) / 4` for non-English text or code; it can be badly off.
- Counting with one model's tokenizer and calling another model.
- Forgetting that tool/function schemas consume input tokens on every call.
- Truncating by characters and slicing a multi-byte character or a JSON structure in half.

## In the interview

**Q: Why do LLMs use subword tokenization?**
It balances vocabulary size and sequence length: frequent words are single tokens, rare words decompose into known pieces, and byte-level variants can represent any input with no unknown token.

**Q: Why do LLMs struggle to count letters in a word?**
They operate on tokens that usually span several characters, so the letter-level structure isn't directly visible. They have to infer spelling from training patterns.

**Q: A Hindi-language product costs far more per request than the English one. Why?**
The tokenizer was trained mostly on English-heavy data, so Hindi text splits into more tokens per word. More tokens means more cost and latency and less room in the context window.

## Key takeaways

- Models read integer token IDs; most use byte-level BPE-style subword vocabularies.
- Tokens, not characters, drive cost, latency, and context limits.
- Token counts vary by model and by language — measure with the right tokenizer.
- Many odd behaviors (spelling, arithmetic, whitespace sensitivity) trace back to tokenization.
