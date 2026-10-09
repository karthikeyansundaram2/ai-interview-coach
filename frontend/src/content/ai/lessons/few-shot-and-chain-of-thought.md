Two of the most reliable prompting techniques are showing examples (few-shot) and letting the model think before it answers (chain-of-thought). One teaches the pattern; the other buys the model room to compute.

## The analogy

When onboarding a new teammate to triage bugs, you don't just describe the categories — you show them five real tickets and how you labeled each (few-shot). And when you ask them a tricky estimation question, you get a better answer if you say "talk me through it" instead of "give me a number now" (chain-of-thought).

## Few-shot prompting

Zero-shot is instructions only. Few-shot adds input → output examples. Models are excellent pattern-matchers, so examples often communicate format, tone, and edge-case handling better than paragraphs of rules.

```python
import json

EXAMPLES = [
    ("App crashes when I upload a 2GB file", {"category": "bug", "severity": "high"}),
    ("Would love a dark mode", {"category": "feature_request", "severity": "low"}),
    ("How do I export my data to CSV?", {"category": "question", "severity": "low"}),
    ("Charged twice this month!!", {"category": "billing", "severity": "high"}),
]

def few_shot_messages(ticket: str) -> list[dict]:
    msgs = [{"role": "system", "content":
             "Classify support tickets. Reply with JSON: {category, severity}."}]
    for text, label in EXAMPLES:
        msgs.append({"role": "user", "content": text})
        msgs.append({"role": "assistant", "content": json.dumps(label)})
    msgs.append({"role": "user", "content": ticket})
    return msgs
```

Guidelines for examples:

- **Cover the label space and edge cases**, not five near-identical easy ones.
- **Vary surface form** so the model learns the concept, not a phrasing.
- **Watch for bias**: models pick up label frequency and recency. If four of five examples are "bug", expect over-prediction of "bug".
- **Dynamic few-shot**: retrieve the most similar labeled examples for each input from an embedding index. This often beats a fixed set.
- **Keep them out of your test set.**

## Chain-of-thought (CoT)

A model produces each token with a fixed amount of computation. Asking it to write intermediate reasoning gives it more tokens — effectively more compute — and lets later steps condition on earlier ones.

```text
 Direct:  Q: 17 boxes × 24 items, 38 damaged. Good items?  A: 370   (wrong)
 CoT:     17 × 24 = 408. 408 − 38 = 370 ... wait, recheck: 17×24 = 408; 408−38 = 370.  ✓
```

Ways to elicit it:

- Ask: "Think step by step before answering."
- Provide few-shot examples that include worked reasoning.
- Ask for reasoning in a dedicated section, then a final answer in a parseable field:

```python
import re

SYSTEM = """Solve the problem. First reason inside <thinking> tags.
Then give only the final answer inside <answer> tags."""

def extract_answer(text: str) -> str | None:
    m = re.search(r"<answer>(.*?)</answer>", text, re.S)
    return m.group(1).strip() if m else None
```

## Reasoning models change the picture

Many current models are trained (often with reinforcement learning on verifiable tasks) to reason internally before answering, sometimes with a configurable "thinking" budget. With these:

- Explicit "think step by step" adds little and can even hurt.
- High-level guidance ("consider edge cases, verify your result") works better than prescribing exact steps.
- Reasoning tokens cost money and latency, so give the budget only to tasks that need it.

## When to use what

| Task | Technique |
|---|---|
| Fixed-format extraction or classification | Few-shot, low temperature |
| Multi-step math, logic, planning | CoT or a reasoning model |
| Simple lookups, rewriting | Zero-shot; CoT just adds latency |
| Ambiguous labeling policy | Few-shot with contrasting edge cases |

## Common mistakes

- Using CoT for latency-sensitive simple tasks — slower and costlier for no gain.
- Showing the model's chain-of-thought directly to end users; it may be messy, wrong in intermediate steps, or reveal internal instructions.
- Treating the written reasoning as a faithful explanation of how the answer was produced; it's often a plausible narrative.
- Few-shot examples that conflict with the written instructions; the examples usually win.

## In the interview

**Q: Why does chain-of-thought improve accuracy?**
Each generated token gets a fixed compute budget; letting the model write intermediate steps gives it more total compute and lets later tokens build on earlier results, which helps multi-step problems.

**Q: How do you choose few-shot examples?**
Cover the label space and tricky edge cases, vary phrasing, balance labels to avoid bias, and ideally retrieve the most similar examples per input dynamically. Never draw them from the eval set.

**Q: Would you add "think step by step" to a reasoning model's prompt?**
Usually not. These models already reason internally; I'd give goals and constraints, control the reasoning budget, and measure on evals.

## Key takeaways

- Few-shot teaches format and edge cases by example; dynamic retrieval of examples often wins.
- Chain-of-thought trades tokens for accuracy on multi-step problems.
- Separate reasoning from the final answer so it's parseable and hideable.
- Reasoning models need less hand-holding — budget their thinking deliberately.
