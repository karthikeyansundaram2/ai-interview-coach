Responsible AI is the practice of making sure an AI system is fair, transparent, accountable, and safe for the people it affects — not just accurate on average. For an engineer, it's less about philosophy and more about concrete tasks in the backlog.

## The analogy

Building codes exist because a building that's "mostly fine" can still collapse on someone. Architects don't treat fire exits and load calculations as optional extras; they're part of the design, inspected before people move in. Responsible AI is the building code for systems that make or influence decisions about people.

## The principles, translated into engineering work

| Principle | What it means | Engineering tasks |
|---|---|---|
| Fairness | Comparable quality and outcomes across groups | Slice evals by language, region, demographic proxies; fix gaps |
| Transparency | People know they're dealing with AI and why it did something | AI disclosure in UI, citations, explanations of decisions |
| Accountability | Someone owns outcomes; decisions are traceable | Audit logs, model/prompt versioning, incident process |
| Human oversight | Humans can review, override, and appeal | Escalation paths, review queues for high-stakes outputs |
| Privacy | Data used only as agreed | Minimization, consent, retention, deletion (see PII lesson) |
| Safety & reliability | System fails gracefully and doesn't cause harm | Guardrails, red-teaming, fallbacks, monitoring |

## Risk-based thinking

Not every feature needs the same rigor. Classify use cases by impact:

```text
 low risk           medium risk                 high risk
 ─────────────────────────────────────────────────────────────►
 brainstorming,     customer support answers,    hiring screens, credit, medical,
 summarizing own    internal search,             legal, anything affecting
 notes              code suggestions             rights, money, or safety
```

High-risk uses demand documented evaluations, human review of decisions, explainability, bias testing, and often legal review. Regulations in several jurisdictions follow this same risk-tiered approach, so building the habit pays off.

## Bias in LLM systems

Bias shows up in subtle ways:
- **Quality gaps**: the support bot answers well in English, poorly in Tamil or Hindi.
- **Stereotyped generations**: job descriptions or examples defaulting to certain genders or names.
- **Disparate outcomes**: an LLM-based résumé screener ranking candidates differently by name or college.

Measuring it:

```python
from collections import defaultdict

def sliced_metrics(rows, slice_key, metric="correct"):
    """rows: eval results with fields like {'lang': 'ta', 'correct': 1.0}"""
    groups = defaultdict(list)
    for r in rows:
        groups[r[slice_key]].append(r[metric])
    report = {g: sum(v) / len(v) for g, v in groups.items() if len(v) >= 20}
    best = max(report.values())
    gaps = {g: round(best - s, 3) for g, s in report.items()}
    return report, gaps            # flag any gap above an agreed threshold

def counterfactual_pairs(template: str, names_a: list[str], names_b: list[str]):
    """Same input, only the name changes -> outputs should be equivalent."""
    return [(template.format(name=a), template.format(name=b))
            for a, b in zip(names_a, names_b)]
```

Counterfactual tests (swap only a name, gender, or dialect and compare decisions) are a practical way to detect unfair sensitivity.

## Documentation that actually helps

- **Model/system cards**: intended use, out-of-scope uses, eval results by slice, known limitations.
- **Data documentation**: sources, consent, known gaps.
- **Decision logs**: why you chose this model, these thresholds, this review process.

They're useful for your own team months later, not just auditors.

## User-facing practices

- Disclose AI involvement; don't impersonate humans.
- Show sources and uncertainty; make it easy to reach a human.
- Provide feedback and appeal mechanisms, and actually review them.
- Avoid dark patterns — anthropomorphic manipulation, fake urgency, emotional dependence features.

## Common mistakes

- Treating responsible AI as a checklist done once before launch rather than ongoing monitoring.
- Only reporting aggregate accuracy, hiding poor performance for minority slices.
- Fully automating high-stakes decisions with no human review or appeal.
- No owner for incidents involving AI harm.

## In the interview

**Q: How would you check an LLM feature for bias?**
Slice eval metrics by relevant groups (language, region, user segment), run counterfactual tests that change only sensitive attributes, review qualitative samples, and set gap thresholds that block release or trigger mitigation.

**Q: What does human oversight look like in practice?**
Risk-tiered review: high-stakes outputs go through human approval, users can escalate or appeal, reviewers can override, and overrides feed back into evals and improvements.

**Q: Where does responsible AI fit in your development process?**
From the start: risk classification at design time, sliced evals and red-teaming before launch, documentation at release, and monitoring plus incident response after.

## Key takeaways

- Responsible AI = fairness, transparency, accountability, oversight, privacy, safety — as backlog items.
- Scale rigor to risk; high-stakes uses need human review and documentation.
- Measure bias with sliced metrics and counterfactual tests.
- Disclose AI use, show sources, and keep a human reachable.
