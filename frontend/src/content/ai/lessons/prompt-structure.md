A prompt is a specification written for a very capable reader who knows nothing about your situation. Most "the model is dumb" problems are really "the spec was ambiguous" problems, and structure is how you remove the ambiguity.

## The analogy

Briefing a skilled contractor who just arrived from another city: you tell them who they're working for, what the job is, what materials are on site, what the finished result must look like, and what they must never do. You don't mumble "fix the kitchen". A good prompt is that briefing.

## The parts of a well-structured prompt

```text
 ┌─ system ─────────────────────────────────────────────┐
 │ Role & audience      who the model is, who it serves  │
 │ Task & goal          what success looks like          │
 │ Rules & constraints  must / must not, tone, length    │
 │ Output format        exact structure expected          │
 └───────────────────────────────────────────────────────┘
 ┌─ user ───────────────────────────────────────────────┐
 │ <context> retrieved docs, data, history </context>   │
 │ <question> the actual request </question>            │
 └───────────────────────────────────────────────────────┘
```

**System vs user messages.** Put stable instructions (role, rules, format) in the system message; put per-request data in user messages. Models are typically trained to weight system instructions more heavily, and stable prefixes are friendlier to prompt caching.

**Delimiters.** Wrap data in clear tags such as `<document>` … `</document>` or fenced blocks. This separates instructions from content and makes it easier to say "answer only from the documents".

**Be explicit about the goal and the reason.** "Keep answers under 80 words because they're shown in a mobile chat bubble" works better than "be concise" — the reason helps the model generalize to edge cases.

**Positive instructions over prohibitions.** "Respond in plain prose paragraphs" is followed more reliably than "don't use Markdown".

**Say what to do when unsure.** "If the documents don't contain the answer, say so and suggest contacting support" prevents confident invention.

## A template you can reuse

```python
SYSTEM = """You are a support assistant for Acme Cloud's billing product.
Audience: small-business customers, often non-technical.

Goal: answer billing questions accurately using ONLY the provided documents.

Rules:
- If the documents don't contain the answer, say you don't know and offer to connect a human agent.
- Never promise refunds; explain the policy and link the refund form.
- Keep replies under 120 words; they appear in a chat widget.

Output: plain text, then a line 'Sources: ' listing document ids used."""

def build_messages(question: str, docs: list[dict], history: list[dict]) -> list[dict]:
    context = "\n\n".join(
        f'<document id="{d["id"]}">\n{d["text"]}\n</document>' for d in docs
    )
    user = f"<documents>\n{context}\n</documents>\n\n<question>{question}</question>"
    return [{"role": "system", "content": SYSTEM}, *history[-6:], {"role": "user", "content": user}]
```

## Ordering and long context

- For long inputs, put the documents first and the question/instructions after them; models tend to follow an instruction better when it's close to where they start generating.
- Repeat critical constraints near the end for very long prompts.
- Remove stale history; irrelevant context is noise and can distract the model.

## Prompts are code

Treat prompts like source: version them, review diffs, and test them against an eval set before shipping. A one-word change can move accuracy several points in either direction. Keep prompts in files or a registry, not scattered string literals, and log the prompt version with every request so you can trace regressions.

## Common mistakes

- Vague goals ("be helpful") with no success criteria.
- Mixing instructions inside user-provided data, which also opens the door to prompt injection.
- Giant lists of edge-case rules accumulated one bug at a time; consolidate them into principles plus examples.
- Shouting with ALL CAPS and "VERY IMPORTANT" everywhere — modern models can over-apply emphasized rules.
- Never testing the prompt on a model upgrade.

## In the interview

**Q: How do you structure a production prompt?**
System message with role, goal, rules, and output format; user message with clearly delimited context and the request. Include fallback behavior for missing information. Version it and test it against an eval set.

**Q: Why separate instructions from data with delimiters?**
It reduces ambiguity about what's an instruction versus content, makes grounding rules enforceable ("only use the documents"), and is a first — though not sufficient — layer against injected instructions in retrieved text.

**Q: Your prompt works on one model but degrades on a newer one. What do you do?**
Run the eval suite on both, inspect failure categories, and adjust — newer models may follow instructions more literally or need less emphasis. Never swap models without re-running evals.

## Key takeaways

- Write prompts like specs: role, goal, rules, format, fallback.
- Stable instructions in system; per-request data in delimited user content.
- Explain *why* behind constraints; prefer positive instructions.
- Version and test prompts like code.
