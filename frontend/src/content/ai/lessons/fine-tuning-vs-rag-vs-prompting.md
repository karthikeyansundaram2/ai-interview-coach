When an LLM isn't doing what you need, you have three main levers: change the prompt, give it better context (RAG), or change its weights (fine-tuning). Picking the right one — and in the right order — is one of the most common AI interview questions.

## The analogy

A new employee is underperforming. You could give clearer instructions (prompting). You could give them access to the right documents (RAG). Or you could send them on a months-long training course (fine-tuning). You'd try clearer instructions first, documents second, and training only when the problem is a skill that instructions and reference material can't fix.

## Knowledge problems vs behavior problems

The most useful question: **is the model missing information, or missing a behavior?**

| Symptom | Problem type | Lever |
|---|---|---|
| Doesn't know your product, policies, recent events | Knowledge | RAG / tools |
| Knows facts but answers in the wrong format or tone | Behavior | Prompting first, then fine-tuning |
| Inconsistent on a narrow, repetitive task at scale | Behavior | Fine-tuning (or a smaller tuned model) |
| Needs live data (prices, inventory) | Knowledge, dynamic | Tools / APIs |
| Long prompt with 30 examples is too slow/expensive | Efficiency | Fine-tune to "bake in" the examples |

## Comparison

| | Prompting | RAG | Fine-tuning |
|---|---|---|---|
| Setup effort | Minutes | Days–weeks (ingestion, index) | Weeks (data, training, eval) |
| Updating knowledge | Edit prompt | Re-index documents | Retrain |
| New/private knowledge | Only what fits in prompt | Yes, scalable | Unreliable for facts |
| Citations / traceability | Limited | Yes | No |
| Access control per user | N/A | Yes (filter at retrieval) | No (weights are shared) |
| Style/format consistency | Good | Same as prompting | Excellent |
| Per-request cost | Grows with prompt length | Retrieval + context tokens | Can be lower (shorter prompts, smaller model) |
| Risk | Low | Retrieval failures | Overfitting, regressions, forgetting |

## The usual order of operations

```text
 1. Prompt engineering + evals   ──► good enough? ship.
 2. Add RAG / tools for knowledge ──► good enough? ship.
 3. Fine-tune for behavior, latency, or cost — on top of 1 and 2, not instead.
```

They compose. A common production setup is a fine-tuned small model *plus* RAG: the tuning teaches the output format and domain style, the retrieval supplies the facts.

## When fine-tuning genuinely wins

- **Narrow, high-volume tasks** (classification, extraction, routing) where a small tuned model matches a large general one at a fraction of the cost and latency.
- **Strict output style** that prompting can't hold consistently (a house voice, a specialized notation).
- **Distillation**: use a large model to label data, then fine-tune a small model to imitate it.
- **Removing long prompts**: when you've stuffed many examples into every request.
- **Domain language** the base model handles poorly, with enough quality data to teach it.

## When it's the wrong call

- Facts that change weekly.
- Fewer than a few hundred good examples and no eval set.
- Hoping it will fix hallucination about your data — it may make the model *more* confidently wrong.
- Needing per-user permissions on the knowledge.

## A quick decision helper

```python
def choose_lever(missing_knowledge: bool, knowledge_changes_often: bool,
                 needs_citations_or_acl: bool, behavior_gap: bool,
                 prompt_fixes_behavior: bool, high_volume_narrow_task: bool,
                 labeled_examples: int) -> list[str]:
    plan = ["prompting + eval set"]                      # always the baseline
    if missing_knowledge or knowledge_changes_often or needs_citations_or_acl:
        plan.append("RAG or tool calls")
    if behavior_gap and not prompt_fixes_behavior and labeled_examples >= 500:
        plan.append("fine-tune (LoRA) for behavior")
    if high_volume_narrow_task and labeled_examples >= 1000:
        plan.append("fine-tune/distill a smaller model to cut cost and latency")
    return plan
```

The thresholds are illustrative, not rules — but the structure of the reasoning is what interviewers want.

## Common mistakes

- Fine-tuning first because it sounds more serious.
- Comparing approaches without a shared eval set.
- Forgetting that fine-tuned models need re-tuning when the base model is upgraded.
- Assuming RAG and fine-tuning are mutually exclusive.

## In the interview

**Q: A client wants the model to answer questions about their 10,000 internal documents. Fine-tune or RAG?**
RAG. It's knowledge that changes, needs citations, and likely has access controls. Fine-tuning is costly to keep current and unreliable for factual recall. I might later fine-tune for tone or format on top.

**Q: When would you fine-tune?**
For behavior that prompting can't reliably achieve, or to cut cost and latency on a narrow high-volume task by tuning a smaller model — given a quality dataset and an eval set to prove improvement.

**Q: How do you decide objectively?**
Build an eval set first, measure the prompting baseline, then measure each added lever against it, weighing quality gains against cost, latency, and maintenance.

## Key takeaways

- Knowledge gaps → RAG/tools; behavior gaps → prompting, then fine-tuning.
- Start with prompting + evals; add complexity only when measured gains justify it.
- Fine-tuning shines for narrow, high-volume tasks and distillation.
- The levers compose — tuned model + RAG is a common end state.
