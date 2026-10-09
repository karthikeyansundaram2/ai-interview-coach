Point this tool at a folder of Markdown notes and find things by what they mean, not the exact words you used when you wrote them. It's the retrieval half of RAG, built and measured properly.

## What you'll build

A local search tool with a CLI and a tiny web UI that:

- Walks a notes folder, parses Markdown, and chunks it by headings.
- Embeds chunks with an open embedding model and stores vectors plus metadata.
- Re-indexes incrementally: only changed files are re-embedded (content hashes).
- Answers queries with the top results, showing file, heading path, snippet, and score.
- Supports filters (folder, tag, date range) and a hybrid mode that adds BM25.
- Ships with a small labeled eval set and reports recall@k and MRR.

## Architecture

```text
 notes/ ──► watcher / scan ──► changed files (sha256 vs manifest)
                                     │
                                     ▼
                         parse Markdown ─► chunk by headings (title > h2 > h3 prefix)
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
          embed (batched, cached by hash)       BM25 tokens
                    │                                 │
                    ▼                                 ▼
          vectors.npy + meta.sqlite            bm25 index (pickle)
                    │                                 │
 query ─► embed ─► cosine top-k ──┐        BM25 top-k ┘
                                  └──► RRF fuse ──► filter ──► results (CLI / web)
```

## Milestones

1. **Ingest and chunk.** Parse Markdown front-matter (tags, dates), split by headings, cap chunk length, prefix each chunk with `title > section`.
   *Acceptance:* `notes index` prints file and chunk counts; no chunk exceeds the token cap; every chunk has file path and heading path.

2. **Embed and search.** Batch-embed chunks with normalized vectors; brute-force cosine search.
   *Acceptance:* `notes search "how did I set up the VPN"` returns the right note in the top 3 even though the note says "WireGuard config".

3. **Incremental indexing.** Maintain a manifest of file hashes; re-embed only changed files; delete chunks for removed files.
   *Acceptance:* editing one note and re-indexing embeds only that note's chunks (log shows counts); deleted notes vanish from results.

4. **Eval set.** Write 30–50 queries with the note(s) that should be found; compute recall@1/5/10 and MRR.
   *Acceptance:* `notes eval` prints a metrics table; results are reproducible across runs.

5. **Hybrid search.** Add BM25 and Reciprocal Rank Fusion; compare to dense-only on the eval set.
   *Acceptance:* queries containing exact identifiers (hostnames, error codes) improve; a table compares dense vs hybrid metrics.

6. **UI and filters.** A minimal web page (FastAPI + HTML) with a search box, filters, and highlighted snippets.
   *Acceptance:* filtering by tag or folder works and doesn't reduce result counts below k when enough matches exist.

## Key code

```python
import hashlib, json, re, sqlite3
from pathlib import Path
import numpy as np
from sentence_transformers import SentenceTransformer

class NotesIndex:
    def __init__(self, root: Path, store: Path, model="all-MiniLM-L6-v2"):
        self.root, self.store = root, store
        self.model = SentenceTransformer(model)
        self.db = sqlite3.connect(store / "meta.sqlite")
        self.db.execute("CREATE TABLE IF NOT EXISTS chunks(id INTEGER PRIMARY KEY, path TEXT, "
                        "heading TEXT, text TEXT, row INTEGER)")
        self.manifest = json.loads((store / "manifest.json").read_text()) \
            if (store / "manifest.json").exists() else {}
        vec_file = store / "vectors.npy"
        self.vecs = np.load(vec_file) if vec_file.exists() else np.zeros((0, 384), "float32")

    def index(self):
        current = {str(p): hashlib.sha256(p.read_bytes()).hexdigest()
                   for p in self.root.rglob("*.md")}
        changed = [p for p, h in current.items() if self.manifest.get(p) != h]
        removed = [p for p in self.manifest if p not in current]
        for p in changed + removed:
            self.db.execute("DELETE FROM chunks WHERE path=?", (p,))
        new_chunks = [c for p in changed for c in chunk_markdown(Path(p))]
        if new_chunks:
            v = self.model.encode([c["text"] for c in new_chunks],
                                  normalize_embeddings=True, batch_size=64)
            start = len(self.vecs)
            self.vecs = np.vstack([self.vecs, v.astype("float32")])
            self.db.executemany("INSERT INTO chunks(path, heading, text, row) VALUES (?,?,?,?)",
                                [(c["path"], c["heading"], c["text"], start + i)
                                 for i, c in enumerate(new_chunks)])
        self.db.commit()
        self.manifest = current
        self._save()     # compact orphaned rows periodically; write vectors + manifest
        return len(changed), len(removed), len(new_chunks)

    def search(self, query: str, k=10):
        rows = self.db.execute("SELECT path, heading, text, row FROM chunks").fetchall()
        if not rows:
            return []
        q = self.model.encode([query], normalize_embeddings=True)[0]
        idx = np.array([r[3] for r in rows])
        scores = self.vecs[idx] @ q
        top = np.argsort(-scores)[:k]
        return [{"path": rows[i][0], "heading": rows[i][1],
                 "snippet": rows[i][2][:240], "score": float(scores[i])} for i in top]

def chunk_markdown(path: Path, max_chars=1500):
    text, title = path.read_text(), path.stem
    parts = re.split(r"^(#{1,3} .+)$", text, flags=re.M)
    heading, out = title, []
    for part in parts:
        if re.match(r"^#{1,3} ", part):
            heading = f"{title} > {part.lstrip('# ').strip()}"
        elif part.strip():
            for i in range(0, len(part), max_chars):
                out.append({"path": str(path), "heading": heading,
                            "text": f"{heading}\n\n{part[i:i + max_chars].strip()}"})
    return out
```

## Stretch goals

- Swap brute force for an HNSW index (hnswlib or FAISS) and measure recall vs latency.
- Add a cross-encoder reranker and measure MRR gains.
- Compare two or three embedding models on your eval set.
- Add "related notes" for each note using nearest neighbors.
- Turn it into an MCP server so a chat app can search your notes.

## What to say about it in interviews

- **You measured before optimizing**: an eval set with recall@k and MRR, and a table showing the effect of hybrid search.
- **Why hybrid**: dense retrieval matched paraphrases; BM25 rescued exact identifiers; RRF fused them without score calibration.
- **Incremental indexing**: content hashing, deletions, and why re-embedding everything doesn't scale.
- **Chunking choices**: heading-based chunks with title/section prefixes, and what happened to metrics when you changed chunk size.
- **Path to production**: brute force → ANN index, local files → vector store with metadata filters, single user → per-user permissions.
