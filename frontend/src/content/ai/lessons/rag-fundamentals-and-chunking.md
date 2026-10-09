Retrieval-augmented generation (RAG) answers questions by first fetching relevant text from your own data and then asking the model to answer using it. It's the standard way to give an LLM knowledge it wasn't trained on — private, recent, or specific — without retraining.

## The analogy

An open-book exam. The student (the LLM) is smart but hasn't memorized your company handbook. Instead of studying it for months (fine-tuning), they're allowed to look up the relevant pages during the exam. Their answer is only as good as the pages they find — which is why retrieval quality dominates RAG quality.

## The pipeline

```text
 OFFLINE (ingestion)
 sources ──► parse ──► clean ──► chunk ──► embed ──► index (+ metadata, + keyword index)

 ONLINE (per question)
 question ──► (rewrite) ──► retrieve top-k ──► (rerank) ──► build prompt ──► LLM ──► answer + citations
```

Why RAG over stuffing everything into a long context window? Cost and latency scale with tokens, models attend less reliably to details buried in huge contexts, and you need access control per document. RAG sends only what's needed.

## Parsing: the unglamorous foundation

Garbage in, garbage out. PDFs with multi-column layouts, tables, headers/footers, and scanned pages need real parsing (layout-aware extraction, OCR when necessary). Keep structure: headings, list items, table rows, page numbers. Many "the model is hallucinating" bugs are really "the table was flattened into word soup" bugs.

## Chunking strategies

| Strategy | How | Good for |
|---|---|---|
| Fixed-size with overlap | N tokens, M-token overlap | Quick baseline, uniform text |
| Recursive / structural | Split on headings → paragraphs → sentences until under size | Docs, wikis, Markdown |
| Semantic | Split where embedding similarity between sentences drops | Long unstructured prose |
| Document-specific | Functions for code, rows for tables, Q&A pairs for FAQs | Mixed corpora |
| Parent–child | Retrieve small chunks, send their larger parent section to the LLM | Precision + context |

Size trade-off:
- **Too small**: precise matches but missing context ("it increases by 5%" — what does?).
- **Too large**: diluted embeddings that match vaguely, more tokens per answer, more noise.

A common starting point is a few hundred tokens with 10–20% overlap, then tune with evals.

**Contextual enrichment** helps a lot: prepend the document title and section path to each chunk before embedding ("Refund Policy > International Orders > ..."), or have an LLM write a one-sentence summary of where the chunk sits in the document.

```python
def chunk_markdown(doc_title: str, text: str, max_tokens=400, overlap=60, count=len):
    sections, chunks = split_by_headings(text), []   # [(heading_path, body), ...]
    for path, body in sections:
        paras, buf = body.split("\n\n"), []
        for p in paras:
            if buf and count(" ".join(buf + [p])) > max_tokens:
                chunks.append(make_chunk(doc_title, path, buf))
                tail = " ".join(buf)[-overlap * 4:]   # rough char overlap
                buf = [tail]
            buf.append(p)
        if buf:
            chunks.append(make_chunk(doc_title, path, buf))
    return chunks

def make_chunk(title, path, paras):
    body = "\n\n".join(paras)
    return {"text": f"{title} > {' > '.join(path)}\n\n{body}",   # header aids retrieval
            "section": path, "doc": title}
```

## Metadata is a first-class citizen

Store with each chunk: source ID, URL, page, section, date/version, language, and **access-control info**. You'll filter on it (only this tenant's docs, only current policy), cite from it, and delete by it when a document is removed.

## The generation prompt

Give clear rules: answer only from the provided context, cite chunk IDs, and say "I don't know" when the context doesn't cover it. Order matters less than clarity, but putting the most relevant chunks first or last tends to beat burying them in the middle.

## Keeping the index fresh

Ingestion is a pipeline, not a script: detect changed documents (content hashes), re-chunk and re-embed only those, delete stale chunks, and version the index so you can roll back.

## Common mistakes

- Spending weeks on prompts while retrieval recall is 50%.
- Chunking tables and code with a prose splitter.
- Dropping titles/headings, leaving chunks that make no sense alone.
- No deletion path — deleted documents keep being cited.
- Applying permissions after generation instead of at retrieval.

## In the interview

**Q: Why use RAG instead of fine-tuning for company knowledge?**
Knowledge changes; RAG updates by re-indexing, supports per-user access control, and produces citations. Fine-tuning is costly to refresh, unreliable for injecting facts, and can't enforce permissions.

**Q: How do you choose chunk size?**
Start from document structure and a few-hundred-token baseline, then tune using retrieval metrics (recall@k) and answer quality on an eval set. Use parent–child retrieval when you need precise matching but richer context.

**Q: RAG answers are wrong. Where do you look first?**
Retrieval: was the right chunk in the top-k? If not, fix parsing, chunking, or search. If it was, look at the prompt, context ordering, and the model's faithfulness.

## Key takeaways

- RAG = retrieve relevant chunks, then generate grounded answers.
- Parsing and chunking quality cap everything downstream.
- Chunk by structure, add title/section context, store rich metadata.
- Debug retrieval before generation; enforce permissions at retrieval time.
