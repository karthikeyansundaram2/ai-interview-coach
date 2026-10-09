Guardrails are the checks around a model that keep inputs and outputs within policy — blocking abuse, catching unsafe or off-topic responses, and keeping personal data where it belongs. They're the seatbelts and airbags of an LLM product: invisible most of the time, essential when something goes wrong.

## The analogy

A bank teller is trained and trustworthy, but the bank still has ID checks at the counter, transaction limits, a second signature for large withdrawals, and cameras. Not because the teller is bad — because one failure is expensive. The model is the teller; guardrails are the bank's controls.

## Where guardrails sit

```text
 user input ──► [input rails] ──► prompt assembly ──► LLM ──► [output rails] ──► user
                 │                    │                          │
                 ├ abuse/jailbreak    ├ PII redaction            ├ policy/safety classifier
                 ├ topic/scope        ├ untrusted-content tags   ├ PII leak check
                 ├ rate limits        │                          ├ grounding/citation check
                 └ PII detection      │                          └ format/schema validation
                                      └── tool calls ──► [action rails: authz, confirmation]
```

Rails can **block**, **modify** (redact, rewrite), **route** (escalate to a human), or **log and allow**.

## Jailbreaks

A jailbreak tries to make the model violate its own safety training or your policy: role-play framings ("pretend you're an AI without rules"), hypothetical wrappers, encoding tricks (base64, other languages), many-shot attacks with long fake dialogues, or gradual multi-turn escalation.

Defenses:
- Rely on a well-aligned model as the first layer, but don't stop there.
- **Input classifiers** for known jailbreak patterns and harmful requests.
- **Output classifiers** — often more robust, since harmful *output* is what you actually care about regardless of how the input was phrased.
- **Scope limiting**: a billing assistant should refuse anything off-topic; a narrow scope shrinks the attack surface.
- **Conversation-level monitoring** for escalation across turns, plus rate limits and abuse bans.

## PII handling

Personal data shows up in user messages, documents, tool results, and — the one people forget — your logs and traces.

| Concern | Control |
|---|---|
| Sending PII to a third-party model | Redact or pseudonymize before the call; use providers/regions with appropriate data agreements |
| Model leaking another user's data | Per-user retrieval filters; never mix tenants in one context |
| PII in logs and traces | Redact at the logging layer; restrict access; retention limits |
| Memorization in fine-tuning | Scrub training data |
| Regulations (e.g. GDPR, India's DPDP Act) | Data minimization, consent, deletion paths |

```python
import re

PATTERNS = {
    "EMAIL": re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"),
    "PHONE": re.compile(r"(?:\+91[\s-]?)?[6-9]\d{9}\b"),
    "CARD":  re.compile(r"\b(?:\d[ -]?){13,16}\b"),
}

def pseudonymize(text: str) -> tuple[str, dict[str, str]]:
    """Replace PII with stable placeholders; return mapping to restore later."""
    mapping: dict[str, str] = {}        # placeholder -> original
    seen: dict[str, str] = {}           # original -> placeholder
    for label, rx in PATTERNS.items():
        def sub(m, label=label):
            val = m.group(0)
            if val not in seen:
                n = sum(p.startswith(f"<{label}_") for p in mapping) + 1
                seen[val] = f"<{label}_{n}>"
                mapping[seen[val]] = val
            return seen[val]
        text = rx.sub(sub, text)
    return text, mapping

def restore(text: str, mapping: dict[str, str]) -> str:
    for placeholder, val in mapping.items():
        text = text.replace(placeholder, val)
    return text
```

Regexes catch structured PII; names and addresses need NER models or dedicated PII-detection tools. Pseudonymizing (rather than deleting) keeps the text coherent so the model can still reason ("email <EMAIL_1> about the refund").

## Practical guardrail engineering

- **Latency budget**: run input checks in parallel with retrieval; use small, fast classifiers; for streaming, check output in chunks or buffer the first sentence.
- **Fail-safe defaults**: decide what happens when a guardrail service times out — fail closed for high-risk actions, fail open with logging for low-risk chat.
- **Measure false positives**: an over-eager filter that blocks legitimate users is a product bug. Track block rates and review samples.
- **Version policies** and evaluate guardrails like any model — with labeled attack and benign sets.

## Common mistakes

- Only filtering inputs; jailbreaks get through and outputs go unchecked.
- Logging full prompts with raw PII to a third-party observability tool.
- Guardrails so strict the product becomes useless, with nobody measuring false positives.
- Relying solely on the model's built-in safety for domain-specific policy (e.g., "never give investment advice").

## In the interview

**Q: Design guardrails for a customer-facing chatbot.**
Input rails: rate limits, abuse/jailbreak classifier, topic scoping, PII detection. Prompt: delimited untrusted content. Output rails: safety and policy classifier, PII-leak check, grounding check for factual claims, schema validation. Action rails: authorization and confirmation for tools. Log decisions, measure false positives, and red-team regularly.

**Q: How do you keep PII out of a third-party LLM?**
Detect and pseudonymize before the call, restore after; minimize data sent; use contractual and regional controls with the provider; and redact logs and traces too.

**Q: Input or output filtering — which matters more?**
Both, but output filtering catches harm regardless of how cleverly the input was disguised, so it's the more robust last line of defense.

## Key takeaways

- Guardrails wrap the model: input, prompt, output, and action rails.
- Jailbreak defense = aligned model + classifiers + narrow scope + monitoring.
- Pseudonymize PII before external calls; redact logs and traces.
- Evaluate guardrails for both misses and false positives.
