The Model Context Protocol (MCP) is an open standard for connecting AI applications to tools and data. Instead of writing a custom integration for every pair of app and service, you write an MCP server once and any MCP-capable application can use it.

## The analogy

Before USB, every printer, mouse, and camera needed its own port and driver. USB defined one plug and one protocol, so any device works with any computer. MCP aims to be that plug for AI: one protocol between AI applications (chat apps, IDEs, agents) and the things they need (GitHub, databases, internal APIs).

## The problem it solves

Without a standard, M AI applications × N services means M×N bespoke integrations, each with its own tool schemas, auth handling, and quirks. With MCP, each application implements the client side once and each service implements a server once: M + N.

## The three roles

```text
 ┌──────────────────────── Host (AI application) ────────────────────────┐
 │  e.g. a desktop chat app, an IDE, your own agent                       │
 │                                                                       │
 │   LLM  ◄──►  host logic  ──► MCP client A ──┐                          │
 │                          ──► MCP client B ──┼──┐                       │
 └─────────────────────────────────────────────┼──┼───────────────────────┘
                                   stdio       │  │  Streamable HTTP
                                               ▼  ▼
                                   MCP server A    MCP server B (remote)
                                   (local files)   (GitHub, Jira, your API)
```

- **Host**: the user-facing AI application. It owns the LLM interaction, the UI, user consent, and decides which servers to connect.
- **Client**: a connector inside the host that maintains a 1:1 session with one server.
- **Server**: a program that exposes capabilities — tools, resources, prompts — for a particular system.

The model itself doesn't speak MCP. The host discovers what servers offer, presents tools to the model in its tool-calling format, and routes the model's tool calls to the right client.

## The protocol layer

- **JSON-RPC 2.0** messages: requests, responses, notifications.
- **Lifecycle**: the client sends `initialize` with its protocol version and capabilities; the server replies with its own; then the session is live.
- **Capability negotiation**: each side declares what it supports (e.g., the server offers tools and resources; the client supports sampling).
- **Discovery**: `tools/list`, `resources/list`, `prompts/list`; servers can notify when lists change.
- **Invocation**: `tools/call`, `resources/read`, `prompts/get`.

```text
 client                                   server
   │── initialize {version, capabilities} ──►│
   │◄─ result {version, capabilities} ───────│
   │── notifications/initialized ───────────►│
   │── tools/list ──────────────────────────►│
   │◄─ [{name, description, inputSchema}] ───│
   │── tools/call {name, arguments} ────────►│
   │◄─ {content: [...], isError: false} ─────│
```

## Transports

| Transport | How | When |
|---|---|---|
| stdio | Host launches the server as a subprocess; messages over stdin/stdout | Local tools: filesystem, local DBs, CLIs |
| Streamable HTTP | Server is an HTTP endpoint; responses can stream | Remote/shared servers, SaaS integrations, multi-user |

Remote servers typically use OAuth-based authorization so users grant scoped access without handing over passwords. (Older specs used a separate SSE transport; check the current spec for the details at the time you build.)

## Client-side features

Servers can also ask things of the client, if the client supports them:
- **Sampling**: the server requests an LLM completion through the host, so it can use AI without its own API key — with the host keeping the user in control.
- **Roots**: the client tells the server which directories or URIs it may operate within.
- **Elicitation**: the server asks the user for additional input mid-task.

## Where MCP fits vs plain tool calling

Tool calling is the model-level mechanism ("call this function with these args"). MCP is the integration layer that standardizes how tools are *discovered and served* across applications. Inside a single app you control end to end, plain function definitions are fine. When you want your integration to work in many hosts — or to consume a growing ecosystem of existing servers — MCP pays off.

## Security considerations

An MCP server runs code and holds credentials. Treat third-party servers like any dependency: review them, pin versions, run with least privilege. Tool descriptions and results flow into the model's context, so a malicious or compromised server can attempt prompt injection. Hosts should show users what tools will do and require consent for sensitive actions.

## Common mistakes

- Thinking the LLM connects to MCP servers directly; the host mediates everything.
- Installing arbitrary community servers with broad credentials.
- Exposing a giant REST API one endpoint per tool instead of designing task-level tools.
- Using stdio for something many users need to share; that's a remote server's job.

## In the interview

**Q: Explain MCP's architecture.**
Hosts are AI applications; each contains clients holding a 1:1 session with a server; servers expose tools, resources, and prompts over JSON-RPC via stdio or Streamable HTTP. The host translates server tools into the model's tool-calling interface and mediates consent.

**Q: Why not just use function calling?**
Function calling is how a model requests an action. MCP standardizes how those functions are packaged, discovered, authorized, and reused across applications, turning M×N integrations into M+N.

**Q: What are MCP's main security risks?**
Over-privileged or malicious servers, credential exposure, and prompt injection via tool descriptions or results. Mitigate with vetting, least privilege, scoped OAuth, user consent, and treating outputs as untrusted.

## Key takeaways

- MCP standardizes connections between AI apps and tools/data.
- Host ↔ client (1:1) ↔ server; JSON-RPC with capability negotiation.
- stdio for local servers, Streamable HTTP for remote ones.
- It complements tool calling; security and consent remain the host's job.
