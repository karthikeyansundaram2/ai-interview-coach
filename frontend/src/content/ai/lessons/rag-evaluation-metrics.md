A RAG system can fail in two very different places: retrieval didn't find the right information, or generation misused what it found. Measuring each stage separately is what turns "the answers are bad" into a fixable diagnosis.

## The analogy

A research assistant brings you a stack of articles, and you write a report from them. If the report is wrong, either the assistant fetched the wrong articles or you misread the right ones. Firing the writer when the assistant is at fault fixes nothing. RAG evaluation keeps the two jobs separate.

## The metric map

```text
 question ──► RETRIEVAL ──► chunks ──► GENERATION ──► answer
               │                          │
     context recall / precision     faithfulness (grounded in chunks?)
     recall@k, MRR, nDCG            answer relevance (addresses question?)
                                    answer correctness (vs reference)
                                    citation accuracy, refusal correctness
```

## Retrieval metrics

You need a labeled set of `(question → relevant chunk or document IDs)`.

| Metric | Question it answers |
|---|---|
| Recall@k | Did any/all relevant items appear in the top k? |
| Precision@k | What fraction of the top k are relevant? |
| MRR | How high is the first relevant item, on average? (1/rank) |
| nDCG@k | Are the most relevant items ranked highest, with graded relevance? |

For RAG, **recall@k is usually the headline**: if the needed chunk isn't retrieved, generation can't succeed. Precision matters for cost and distraction.

```python
def recall_at_k(retrieved: list[str], relevant: set[str], k: int) -> float:
    return len(set(retrieved[:k]) & relevant) / len(relevant) if relevant else 0.0

def reciprocal_rank(retrieved: list[str], relevant: set[str]) -> float:
    for i, doc_id in enumerate(retrieved, start=1):
        if doc_id in relevant:
            return 1.0 / i
    return 0.0

def retrieval_report(cases, retriever, ks=(1, 5, 10, 20)):
    rows = []
    for c in cases:
        got = [h.id for h in retriever.search(c["question"], k=max(ks))]
        rows.append({f"recall@{k}": recall_at_k(got, set(c["relevant_ids"]), k) for k in ks}
                    | {"mrr": reciprocal_rank(got, set(c["relevant_ids"]))})
    return {m: sum(r[m] for r in rows) / len(rows) for m in rows[0]}
```

Labeling tip: chunk IDs change when you re-chunk. Label at the **document or passage-text** level and map to chunks at eval time, or you'll relabel every experiment.

Without labels, an LLM judge can rate **context relevance** ("is this chunk useful for answering the question?") to estimate precision.

## Generation metrics

| Metric | Definition | How to measure |
|---|---|---|
| Faithfulness / groundedness | All claims supported by retrieved context | Claim extraction + LLM judge verification |
| Answer relevance | Answers the question asked, not a neighbor | LLM judge, or generate questions from the answer and compare to the original |
| Answer correctness | Matches reference answer's facts | Fact-level comparison with a judge; exact match for short answers |
| Citation precision/recall | Cited sources actually support claims; claims have citations | Programmatic quote check + judge |
| Refusal correctness | Says "I don't know" when context lacks the answer, and only then | Include unanswerable questions in the set |

Note that **faithful ≠ correct**. An answer can faithfully repeat an outdated document. And **correct ≠ faithful**: the model may answer correctly from its own memory while ignoring context — risky, since that won't hold for private data.

## Diagnosing with the matrix

| Retrieval recall | Faithfulness | Likely fix |
|---|---|---|
| Low | — | Parsing, chunking, hybrid search, query rewriting |
| High | Low | Prompt (ground strictly), fewer/better chunks, reranking, stronger model |
| High | High, but answers wrong | Source data is stale or conflicting; fix content |
| High | High, users unhappy | Answer relevance, tone, length — check online feedback |

## Frameworks

Open-source evaluation libraries package these metrics (faithfulness, context precision/recall, answer relevance) with LLM-judge implementations. They're a fast start; still calibrate their judges on your data, and understand what each metric actually computes before you put it on a dashboard.

## Building the dataset

- Mine real user questions; have experts mark relevant documents and write reference answers.
- Synthetic generation (an LLM writes questions from chunks) bootstraps coverage, but synthetic questions are often easier and more lexically similar to the source than real ones — mix in real queries.
- Include multi-hop, ambiguous, and unanswerable questions.

## Common mistakes

- Only measuring end-to-end answer quality, so you can't tell which stage broke.
- No unanswerable questions, so hallucination under missing context goes unmeasured.
- Labels tied to chunk IDs that change with every re-chunk.
- Evaluating with synthetic questions only.

## In the interview

**Q: How do you evaluate a RAG system?**
Separately. Retrieval: recall@k and MRR against labeled relevant documents. Generation: faithfulness to retrieved context, answer relevance, correctness against references, citation accuracy, and refusal behavior on unanswerable questions. Then end-to-end online signals.

**Q: Faithfulness vs correctness?**
Faithfulness checks the answer is supported by the retrieved context; correctness checks it matches the truth. Faithful-but-wrong points to bad sources; correct-but-unfaithful means the model ignored context.

**Q: Retrieval recall is 95% but answers are poor. Next step?**
Focus on generation: check faithfulness failures, reduce noisy context via reranking, tighten grounding instructions, review context ordering, or try a stronger model.

## Key takeaways

- Evaluate retrieval and generation separately.
- Retrieval: recall@k (headline), precision, MRR, nDCG.
- Generation: faithfulness, relevance, correctness, citations, refusals.
- Use the recall × faithfulness matrix to pick the right fix.
