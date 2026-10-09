Wrap a real HTTP API as a Model Context Protocol server so any MCP-capable assistant — a desktop chat app, an IDE, your own agent — can use it. The craft is in designing tools a model can use well, not in exposing every endpoint.

## What you'll build

An MCP server for an API you actually use. Good candidates: GitHub, a project tracker, a weather or transit API, your company's internal service (in a sandbox), or a public dataset API. The example below uses a generic issue tracker. The server will offer:

- **Tools** (model-controlled): task-level operations like `search_issues`, `get_issue`, `create_issue`, `add_comment`, `summarize_activity`.
- **Resources** (app-controlled): `tracker://projects` (list), `tracker://issue/{id}` (full thread as Markdown), `tracker://schema/labels`.
- **Prompts** (user-controlled): `/triage-issue`, `/weekly-update`.
- **Two transports**: stdio for local use, Streamable HTTP for remote use with token-based auth.

## Architecture

```text
 ┌──────── MCP host (chat app / IDE / your agent) ────────┐
 │   LLM ◄──► host ──► MCP client ──────────────┐          │
 └───────────────────────────────────────────────┼──────────┘
                                 stdio or Streamable HTTP (JSON-RPC)
                                                 ▼
 ┌──────────────────────── your MCP server ────────────────────────┐
 │  tools/      search_issues  get_issue  create_issue  add_comment │
 │  resources/  tracker://projects  tracker://issue/{id}            │
 │  prompts/    triage-issue  weekly-update                          │
 │                                                                   │
 │  ApiClient: auth, retries, rate-limit handling, pagination        │
 │  Formatter: compact Markdown/text outputs, truncation              │
 │  Guard: read-only mode flag, destructive-action annotations        │
 └───────────────────────────────┬───────────────────────────────────┘
                                 ▼
                         upstream REST API
```

## Milestones

1. **API client.** Typed wrapper with auth from environment, timeouts, retries with backoff on 429/5xx, and pagination.
   *Acceptance:* unit tests with mocked HTTP; rate-limit responses are retried and surfaced cleanly if they persist.

2. **First tool over stdio.** `search_issues` with clear docstring, constrained params, and compact output.
   *Acceptance:* an MCP inspector lists the tool with a correct input schema; calling it returns readable results; nothing is printed to stdout except protocol messages (logs go to stderr).

3. **Full tool set.** Add read and write tools. Mark destructive/write tools appropriately (annotations/hints) and support a `READ_ONLY=1` mode that hides them.
   *Acceptance:* in a real host, "find open bugs about login and comment on the oldest one" works end to end; with read-only mode, write tools are not listed.

4. **Resources and prompts.** Expose issue threads and label schema as resources; add two prompts.
   *Acceptance:* the host can attach `tracker://issue/123` as context; `/triage-issue` expands into a useful message using the resource.

5. **Remote transport.** Run over Streamable HTTP with bearer-token auth (or OAuth if your API supports it), acting with the caller's identity.
   *Acceptance:* requests without a valid token are rejected; two users with different tokens see only what their API permissions allow.

6. **Evaluation.** 15 natural-language tasks; record which tools the model chose, argument correctness, and success.
   *Acceptance:* a results table; at least one docstring improvement measurably raises tool-selection accuracy.

## Key code

```python
import asyncio, os, sys, logging
import httpx
from mcp.server.fastmcp import FastMCP

logging.basicConfig(stream=sys.stderr, level=logging.INFO)   # never log to stdout on stdio
mcp = FastMCP("issue-tracker")
BASE = os.environ["TRACKER_URL"]
READ_ONLY = os.environ.get("READ_ONLY") == "1"

async def api(method: str, path: str, **kw):
    headers = {"Authorization": f"Bearer {os.environ['TRACKER_TOKEN']}"}
    async with httpx.AsyncClient(base_url=BASE, timeout=15, headers=headers) as c:
        for attempt in range(3):
            r = await c.request(method, path, **kw)
            if r.status_code not in (429, 502, 503):
                break
            await asyncio.sleep(2 ** attempt)
        r.raise_for_status()
        return r.json()

def fmt_issue(i: dict) -> str:
    return f"#{i['id']} [{i['state']}] {i['title']} (labels: {', '.join(i['labels']) or '-'}; " \
           f"updated {i['updated_at'][:10]})"

@mcp.tool()
async def search_issues(query: str, state: str = "open", label: str | None = None,
                        limit: int = 10) -> str:
    """Search issues by keywords. state: open | closed | all. Optionally filter by one label.
    Returns one line per issue with id, state, title, labels, last update. Use get_issue for details."""
    params = {"q": query, "state": state, "per_page": min(limit, 25)}
    if label:
        params["label"] = label
    try:
        items = (await api("GET", "/issues", params=params))["items"]
    except httpx.HTTPStatusError as e:
        return f"Error from tracker API: {e.response.status_code}. Check the query and try again."
    if not items:
        return "No issues found. Try fewer keywords or state='all'."
    return "\n".join(fmt_issue(i) for i in items)

@mcp.resource("tracker://issue/{issue_id}")
async def issue_thread(issue_id: str) -> str:
    """Full issue with description and comments, as Markdown."""
    i = await api("GET", f"/issues/{issue_id}")
    comments = "\n\n".join(f"**{c['author']}**: {c['body']}" for c in i["comments"][:30])
    return f"# {i['title']}\n\n{i['body']}\n\n## Comments\n\n{comments}"

@mcp.prompt()
def triage_issue(issue_id: str) -> str:
    """Classify an issue, estimate severity, and suggest next steps."""
    return (f"Read tracker://issue/{issue_id}. Classify (bug/feature/question), rate severity 1-4 "
            "with justification, search for duplicates, and propose next steps.")

if not READ_ONLY:
    @mcp.tool()
    async def add_comment(issue_id: str, body: str) -> str:
        """Post a comment on an issue. This is visible to the whole team."""
        await api("POST", f"/issues/{issue_id}/comments", json={"body": body})
        return f"Comment posted on #{issue_id}."

if __name__ == "__main__":
    mcp.run()          # stdio; use the SDK's HTTP transport option for remote deployment
```

## Stretch goals

- Cache read-heavy calls with short TTLs and ETags.
- Resource subscriptions: notify the client when an issue changes.
- Use sampling to let the server request a summary from the host's model for `summarize_activity`.
- Package and publish the server with a clear README and config examples.
- Add structured (JSON) tool outputs alongside the text form.

## What to say about it in interviews

- **Tool design over endpoint mapping**: you chose a handful of task-level tools, wrote docstrings as prompts, and measured tool-selection accuracy.
- **Primitive choice**: why issue threads are resources, actions are tools, and workflows are prompts.
- **Security**: per-user auth on remote transport, read-only mode, destructive-action annotations, and treating API content as untrusted (injection via issue text).
- **Operational details**: stdio logging pitfalls, retries and rate limits, output truncation to protect the context window.
- **Why MCP**: one server usable from many hosts, turning M×N integrations into M+N.
