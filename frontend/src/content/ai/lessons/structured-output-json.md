The moment an LLM's output feeds into code — a database write, an API call, a UI — prose isn't enough; you need structure you can parse every single time. Getting reliable JSON is a layered problem of schema design, decoding, validation, and recovery.

## The analogy

Asking a person to "send me the details" gets you an email in any shape. Handing them a form with labeled boxes, dropdowns, and required fields gets you data you can process. Structured output is giving the model a form instead of a blank page.

## The reliability ladder

```text
 weakest  ─────────────────────────────────────────────►  strongest
 "reply in JSON"  →  JSON mode  →  schema in prompt + validate/retry  →  schema-constrained decoding
```

1. **Instruction only**: works most of the time; occasionally you get Markdown fences, trailing prose, or missing fields.
2. **JSON mode**: the provider guarantees syntactically valid JSON but not your shape.
3. **Tool / function schema**: define the output as a tool's parameters; the model "calls" it with arguments matching the schema.
4. **Strict structured output / constrained decoding**: the provider (or a local library) masks invalid tokens so output must match the JSON Schema.

Even at the top of the ladder you still validate: constrained decoding guarantees shape, not truth.

## Define the schema once, in code

```python
from typing import Literal
from pydantic import BaseModel, Field, ValidationError

class LineItem(BaseModel):
    description: str
    quantity: int = Field(ge=1)
    unit_price: float = Field(ge=0)

class Invoice(BaseModel):
    vendor: str
    invoice_number: str
    currency: Literal["INR", "USD", "EUR"]
    items: list[LineItem]
    total: float
    notes: str | None = Field(None, description="Anything that didn't fit the schema")

def extract_invoice(llm, text: str, max_attempts: int = 3) -> Invoice:
    schema = Invoice.model_json_schema()
    messages = [
        {"role": "system", "content": "Extract invoice data. Return JSON matching the schema."},
        {"role": "user", "content": f"<invoice>\n{text}\n</invoice>"},
    ]
    for _ in range(max_attempts):
        raw = llm.generate(messages, response_schema=schema, temperature=0)
        try:
            inv = Invoice.model_validate_json(raw)
            if abs(sum(i.quantity * i.unit_price for i in inv.items) - inv.total) > 0.01:
                raise ValueError("line items don't sum to total")
            return inv
        except (ValidationError, ValueError) as e:
            messages += [{"role": "assistant", "content": raw},
                         {"role": "user", "content": f"Invalid: {e}. Return corrected JSON only."}]
    raise RuntimeError("extraction failed after retries")
```

Pydantic (or similar) gives you a schema to send, a validator to run, and typed objects for the rest of your code.

## Schema design tips

- **Use enums** for categorical fields; free-text categories drift.
- **Make missing data representable**: nullable fields or an explicit `"unknown"` value. Otherwise the model invents values to satisfy "required".
- **Field order matters**: generation is left to right. Put a `reasoning` field *before* the `decision` field if you want the decision informed by reasoning.
- **Descriptions are prompts**: field descriptions guide the model; write them carefully.
- **Keep nesting shallow** and schemas small; giant schemas increase errors and token cost.
- **Add an escape hatch** like `notes` so odd information has somewhere to go.

## Semantic validation

Syntax is the easy part. Add business checks: totals add up, dates are in range, IDs exist in your database, quoted text actually appears in the source. Failing checks trigger a retry with the error message, a fallback model, or human review.

## Streaming structured output

For UIs, you can stream partial JSON and parse incrementally with a tolerant parser, rendering fields as they complete. Validate only once the object is closed.

## Common mistakes

- Using `json.loads` on raw output without stripping code fences or handling truncation (check the finish reason for max-token cut-offs).
- Required fields with no way to say "not present" — the top cause of fabricated values.
- Putting the decision before its reasoning in the schema.
- Trusting schema-valid output as correct; validate semantics too.
- Retrying forever; cap attempts and route failures to a queue.

## In the interview

**Q: How do you get reliable structured output from an LLM?**
Define a schema in code, use the provider's strict structured-output or tool-calling feature (constrained decoding where available), run at low temperature, validate with Pydantic plus business rules, and retry with the error message, with a capped fallback path.

**Q: Why might a model fabricate a field value?**
Because the schema forces a value and offers no way to express absence. Make fields nullable or add explicit "unknown" options and instruct the model to use them.

**Q: Does constrained decoding solve extraction quality?**
No — it guarantees the output parses and matches the schema, not that values are correct. You still need semantic validation and evals.

## Key takeaways

- Climb the ladder: schema-constrained output where available, validation always.
- Pydantic models double as schema and validator.
- Design schemas for the model: enums, nullable fields, reasoning before decisions.
- Validate semantics and retry with errors; cap retries.
