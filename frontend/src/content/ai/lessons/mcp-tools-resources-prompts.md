An MCP server can expose three kinds of things: tools the model can call, resources the application can read, and prompts the user can pick. The key distinction is who's in control of each — and designing a good server means putting each capability in the right bucket.

## The analogy

Think of a well-run kitchen. **Tools** are appliances the chef decides to use mid-recipe (blender, oven). **Resources** are the pantry — ingredients the kitchen manager decides to set out on the counter. **Prompts** are the menu — set dishes a customer explicitly orders. Different people decide when each one is used.

## The three primitives

| Primitive | Controlled by | What it is | Example |
|---|---|---|---|
| Tools | Model | Functions with input schemas that may have side effects | `create_issue`, `run_query`, `search_tickets` |
| Resources | Application / user | Read-only data addressed by URI | `file:///notes/todo.md`, `db://schema/orders` |
| Prompts | User | Reusable templates with arguments | "/summarize-pr", "/triage-incident" |

**Tools** are for actions and dynamic lookups the model chooses to perform. **Resources** are context the host attaches — for example, the user picks a file, or the app attaches a database schema — without the model needing to "decide". Resources can be static or templated (`repo://{owner}/{name}/readme`) and can support subscriptions for change notifications. **Prompts** surface as slash-commands or menu items and expand into a structured message sequence, often embedding resources.

## A server with all three

```python
from mcp.server.fastmcp import FastMCP
import httpx

mcp = FastMCP("tickets")
API = "https://tickets.internal.example.com/api"

@mcp.tool()
async def search_tickets(query: str, status: str = "open", limit: int = 10) -> str:
    """Search support tickets by text. status: open | closed | all.
    Returns id, title, priority, and age for each match."""
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{API}/tickets", params={"q": query, "status": status, "limit": limit})
        r.raise_for_status()
    rows = r.json()["items"]
    if not rows:
        return "No tickets matched. Try broader terms or status='all'."
    return "\n".join(f"{t['id']} | {t['priority']} | {t['age_days']}d | {t['title']}" for t in rows)

@mcp.tool()
async def add_comment(ticket_id: str, body: str) -> str:
    """Add an internal comment to a ticket. Visible to staff only."""
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(f"{API}/tickets/{ticket_id}/comments", json={"body": body})
    return "Comment added." if r.status_code == 201 else f"Failed: {r.status_code} {r.text[:200]}"

@mcp.resource("tickets://{ticket_id}")
async def ticket_detail(ticket_id: str) -> str:
    """Full ticket thread as Markdown."""
    async with httpx.AsyncClient(timeout=10) as c:
        return (await c.get(f"{API}/tickets/{ticket_id}/markdown")).text

@mcp.prompt()
def triage(ticket_id: str) -> str:
    """Triage a ticket: classify, assess severity, suggest next action."""
    return (f"Read tickets://{ticket_id}. Classify it (bug/billing/how-to), rate severity 1-4 "
            "with a reason, and propose the next action. Search for similar open tickets first.")

if __name__ == "__main__":
    mcp.run()          # stdio by default; HTTP transports are available for remote use
```

The SDK derives each tool's JSON Schema from type hints and its description from the docstring — so docstrings are prompt engineering.

## Designing good MCP tools

- **Task-level, not endpoint-level.** Wrapping 80 REST endpoints as 80 tools overwhelms selection. Offer the handful of operations users actually need.
- **Readable outputs.** Return concise text or compact structured content, not raw API payloads. Include IDs the model can use in follow-up calls.
- **Helpful errors.** Return `isError` results with guidance rather than crashing the session.
- **Pagination and limits** to protect the context window.
- **Annotations/hints**: the spec lets tools declare hints such as read-only or destructive, which hosts can use to decide when to ask for confirmation.
- **Auth from the host context**, not hard-coded admin tokens; act with the user's permissions.

## Choosing the right primitive

Ask "who should decide when this is used?"
- The model, during reasoning → **tool**.
- The user or app, as background context → **resource**.
- The user, as a named workflow → **prompt**.

A database schema is a great resource (attach it so the model writes correct SQL); running the query is a tool; "/weekly-report" is a prompt.

## Testing

Use an MCP inspector-style tool to connect, list capabilities, and call tools manually. Then test inside a real host with realistic requests and log which tools the model chooses and why.

## Common mistakes

- Making everything a tool, including static reference data better served as resources.
- Vague docstrings that leave the model guessing about parameters.
- Returning megabytes of JSON from one call.
- Destructive tools with no confirmation hints.
- Printing debug output to stdout in a stdio server — it corrupts the JSON-RPC stream (log to stderr).

## In the interview

**Q: What's the difference between MCP tools and resources?**
Tools are model-controlled functions that can take actions; resources are application-controlled, read-only data identified by URIs that the host chooses to include as context.

**Q: How would you expose a large REST API via MCP?**
Identify the key user tasks and design a small set of task-level tools with tight schemas and concise outputs; expose reference data (schemas, docs) as resources; package common workflows as prompts; enforce the user's auth on every call.

**Q: Why do docstrings matter so much in an MCP server?**
They become the tool descriptions the model reads to decide when and how to call each tool. Poor descriptions mean wrong tool choices and malformed arguments.

## Key takeaways

- Tools = model-controlled actions; resources = app-controlled context; prompts = user-chosen templates.
- Design task-level tools with clear descriptions and compact outputs.
- Use resources for reference data and prompts for repeatable workflows.
- Log to stderr in stdio servers; test with an inspector, then a real host.
