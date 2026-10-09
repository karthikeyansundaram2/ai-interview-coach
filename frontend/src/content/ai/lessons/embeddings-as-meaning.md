An embedding is a list of numbers that places a token, sentence, or document at a point in space such that similar meanings land near each other. It's the bridge between messy language and the math that models — and search systems — run on.

## The analogy

Imagine a giant map of a city where every restaurant is placed not by street address but by *what it's like*. Dosa places cluster together, near idli places, a bit further from biryani places, and far from sushi bars. Two restaurants you've never compared directly can still be judged similar just by their distance on the map. Embeddings build that map for text, with hundreds or thousands of dimensions instead of two.

## Token embeddings inside a model

The first layer of an LLM is an **embedding table**: a matrix with one row per vocabulary token. Token ID 5,231 just looks up row 5,231 — a vector of, say, a few thousand numbers. Those vectors are learned during training. Tokens that appear in similar contexts end up with similar vectors.

```text
 token ids   [  464,  3797,  3332 ]
                 │      │      │
 embedding    ┌──▼──────▼──────▼──┐
 table  E     │ row lookup        │   E has shape (vocab_size, d_model)
              └──┬──────┬──────┬──┘
 vectors       [v464] [v3797] [v3332]   each of length d_model
```

These vectors are then refined layer by layer, so by the top of the network each position holds a *contextual* representation: "bank" next to "river" ends up in a different place than "bank" next to "loan".

## Sentence and document embeddings

For search and RAG you want one vector per piece of text. Dedicated **embedding models** produce these, usually by pooling a transformer's final hidden states and training with a **contrastive** objective: pairs that belong together (a question and its answer, a query and a clicked document) are pulled close; random pairs are pushed apart.

```python
import numpy as np
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")   # small open embedding model
texts = [
    "How do I reset my password?",
    "I forgot my login credentials",
    "What's your refund policy?",
]
vecs = model.encode(texts, normalize_embeddings=True)   # unit-length vectors

sims = vecs @ vecs.T          # cosine similarity, since vectors are normalized
print(np.round(sims, 2))
# row 0 vs row 1 high (same intent, few shared words); row 0 vs row 2 low
```

## Measuring closeness

| Metric | Formula | Notes |
|---|---|---|
| Cosine similarity | `a·b / (|a||b|)` | Ignores length; the usual default |
| Dot product | `a·b` | Equals cosine if vectors are normalized; fastest |
| Euclidean (L2) | `|a − b|` | Ranks the same as cosine for normalized vectors |

Use whatever metric the embedding model was trained for — its documentation will say.

## What embeddings capture, and what they don't

They capture topic, paraphrase, and intent well. They are weaker at:
- **Exact identifiers**: error codes, SKUs, names. "ERR_4012" and "ERR_4021" may look nearly identical.
- **Negation and fine logic**: "flights that are not to Delhi" may land near "flights to Delhi".
- **Domain jargon** the model never saw in training.

That's why production search often combines embeddings with keyword search (covered in the RAG module).

## Common mistakes

- Mixing vectors from two different embedding models in one index — the spaces are incompatible.
- Changing the embedding model without re-embedding the whole corpus.
- Using an LLM's raw hidden states as sentence embeddings; purpose-trained embedding models are far better for retrieval.
- Assuming higher dimensions is always better; it costs memory and latency for diminishing gains.

## In the interview

**Q: What is an embedding?**
A dense vector representation learned so that geometric closeness reflects semantic similarity. Inside LLMs, token embeddings are rows of a learned lookup table; for retrieval, embedding models map whole texts to single vectors.

**Q: How are retrieval embedding models trained?**
Usually contrastively: positive pairs (query and relevant passage) are pulled together and in-batch negatives pushed apart, so similarity in vector space tracks relevance.

**Q: Why might semantic search miss an exact product code?**
Embeddings compress meaning and treat similar-looking identifiers as near-duplicates; they aren't designed for exact string matching. Hybrid search with a keyword index fixes this.

## Key takeaways

- Embeddings map text to vectors where distance approximates meaning.
- LLMs start with a token embedding table; retrieval uses separate sentence-embedding models.
- Cosine similarity on normalized vectors is the usual comparison.
- Embeddings are great at paraphrase, weak at exact identifiers and negation.
