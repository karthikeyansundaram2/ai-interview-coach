Tool calling lets a model ask your code to do things — look up an order, run a query, send an email — and then use the results. The model never executes anything itself; it emits a structured request, and your application decides whether and how to run it.

## The analogy

A doctor (the model) can't run lab tests personally. They fill out a lab request form with specific fields: test name, patient ID, urgency. The lab (your code) runs the test and sends back results; the doctor reads them and makes a diagnosis. The forms are your tool schemas — the clearer they are, the fewer wrong tests get ordered.

## The loop

```text
 you ──► messages + tool definitions ──► model
                                           │
               ┌───── stop: final answer ◄─┤
               │                           │ tool_call(name, args)
               ▼                           ▼
            user                 your code validates + executes
                                           │
                     tool_result ──────────┘──► appended to messages ──► model again
```

1. Send the conversation plus a list of tools (name, description, JSON Schema for parameters).
2. The model either answers or returns one or more tool calls with arguments.
3. Your code validates the arguments, runs the tool, and appends the result as a tool message.
4. Call the model again. Repeat until it answers or you hit a step limit.

## A provider-agnostic implementation

```python
import json

TOOLS = {
    "get_order": {
        "description": "Look up an order by id. Use when the user mentions an order number.",
        "parameters": {"type": "object",
                       "properties": {"order_id": {"type": "string", "pattern": "^ORD-\\d{6}$"}},
                       "required": ["order_id"]},
        "fn": lambda order_id: db.orders.get(order_id),
    },
    "refund_order": {
        "description": "Issue a refund. Only after confirming the order is eligible.",
        "parameters": {"type": "object",
                       "properties": {"order_id": {"type": "string"},
                                      "reason": {"type": "string", "enum": ["damaged", "late", "other"]}},
                       "required": ["order_id", "reason"]},
        "fn": refunds.create, "needs_approval": True,
    },
}

def run(llm, messages, max_steps=6):
    specs = [{"name": n, "description": t["description"], "parameters": t["parameters"]}
             for n, t in TOOLS.items()]
    for _ in range(max_steps):
        reply = llm.chat(messages, tools=specs)
        messages.append(reply.as_message())
        if not reply.tool_calls:
            return reply.text
        for call in reply.tool_calls:
            tool = TOOLS.get(call.name)
            try:
                args = json.loads(call.arguments)
                validate(args, tool["parameters"])            # jsonschema
                if tool.get("needs_approval") and not ask_human(call):
                    result = {"error": "action rejected by user"}
                else:
                    result = tool["fn"](**args)
            except Exception as e:
                result = {"error": str(e)}                    # let the model recover
            messages.append({"role": "tool", "tool_call_id": call.id,
                             "content": json.dumps(result, default=str)[:4000]})
    return "Sorry, I couldn't complete that within the step limit."
```

## Designing good tools

- **Names and descriptions are prompts.** Say what the tool does, when to use it, and when *not* to.
- **Fewer, higher-level tools** beat many tiny ones. `search_orders(customer_email, status)` is better than five separate getters. Large tool lists confuse selection and cost input tokens on every call.
- **Constrain arguments**: enums, patterns, required fields, sensible defaults.
- **Return concise, model-friendly results**: relevant fields only, human-readable IDs, truncated lists with a "more available" hint. Raw 50 KB JSON blobs waste context.
- **Return errors as data** with actionable messages ("order not found; ask the user to check the number") so the model can recover.
- **Idempotency** for side-effecting tools, since retries happen.

## Parallel calls and control

Many models can request several independent tool calls in one turn (look up three orders at once); execute them concurrently. Most APIs also let you control tool choice: let the model decide, force a specific tool, or forbid tools — forcing is handy for structured extraction.

## Security is your job

The model's arguments are untrusted input. Validate them, authorize every call against the *end user's* permissions (not the service account's), and require human confirmation for destructive or financial actions. If tool results contain text from the outside world (emails, web pages), they can carry injected instructions.

## Common mistakes

- Executing arguments without schema validation or authorization checks.
- No step limit, so a confused model loops on the same failing call.
- Throwing exceptions instead of returning errors the model can read.
- Dumping huge tool outputs into the context.
- Thirty overlapping tools with vague descriptions.

## In the interview

**Q: Does the model execute the function?**
No. It outputs a structured request (name + JSON args). The application validates, authorizes, executes, and returns the result as a message; the model then continues.

**Q: How do you make tool use safe?**
Validate args against schemas, enforce the end user's permissions on each call, require confirmation for irreversible actions, cap steps, log every call, and treat tool outputs as untrusted content.

**Q: How do you improve tool selection accuracy?**
Consolidate tools, write precise descriptions with when-to-use guidance, constrain parameters, include examples in descriptions if needed, and measure selection accuracy on an eval set.

## Key takeaways

- Tool calling = model proposes, your code disposes.
- The loop: call model → execute tool calls → append results → repeat with a step cap.
- Tool design (names, descriptions, schemas, outputs) is prompt engineering.
- Validate, authorize, and confirm — the model's arguments are untrusted.
