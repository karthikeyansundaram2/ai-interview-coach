Fine-tune a small open model with LoRA for a narrow, well-defined task and prove — with an eval set — that it beats prompting the same model, and competes with a much larger one at a fraction of the cost. The proof is the point; the training script is the easy part.

## What you'll build

Pick a task with clear right answers and real volume. Good options:

- **Support ticket triage**: map ticket text to `{category, priority, product_area}` JSON.
- **Structured extraction**: pull fields from invoices or job postings into a fixed schema.
- **Style transfer**: rewrite technical release notes into a customer-facing house style.

The example below uses ticket triage. Deliverables:

- A cleaned, deduplicated dataset with train/validation/test splits.
- Baselines: zero-shot and few-shot prompting of the small base model, plus a larger hosted model.
- A LoRA (or QLoRA) fine-tuned adapter with training logs.
- An evaluation report: accuracy per field, JSON validity, latency, and estimated cost per 1,000 requests.
- A served endpoint (merged weights or adapter on an inference server).

## Architecture

```text
 raw tickets ─► clean / dedupe / PII scrub ─► label (existing labels, or large-model labels + human review)
                                                       │
                                     group-aware split: train / val / test (held out)
                                                       │
         ┌──────────────────────── baselines ───────────┼───────────────────────────┐
         │ small model zero-shot · small model few-shot │ large model few-shot       │
         └──────────────────────────────────────────────┼───────────────────────────┘
                                                       ▼
          chat-template formatting ─► QLoRA training (val loss, early stop) ─► adapter
                                                       │
                                         eval on test ─► report (per-field, per-slice)
                                                       │
                     merge or serve adapter ─► inference server ─► latency/cost benchmark
```

## Milestones

1. **Dataset.** Collect 2,000–10,000 examples (public datasets or synthetic + reviewed). Deduplicate, scrub PII, balance or at least measure label distribution, and split by customer/thread to avoid leakage.
   *Acceptance:* data card documenting sources, label distribution, and split strategy; no near-duplicates across splits (embedding similarity check).

2. **Baselines.** Run zero-shot and few-shot prompts on the small base model and a larger model; constrained/JSON output where available.
   *Acceptance:* a table with per-field accuracy, JSON validity, and latency for each baseline on the test set.

3. **Training.** QLoRA on the small model with the correct chat template and loss masked to the assistant response; log train/val loss; early stopping.
   *Acceptance:* validation loss curve shows no runaway overfitting; the adapter and config are saved with a reproducible seed.

4. **Evaluation.** Score the tuned model on the held-out test set; per-field and per-slice (rare categories, long tickets) breakdowns; confusion matrix for category.
   *Acceptance:* tuned model beats small-model few-shot on overall accuracy and JSON validity; report where it still loses to the large model.

5. **Regression check.** Test a handful of general prompts to see whether general ability degraded, and decide whether that matters for this deployment.
   *Acceptance:* short written note with examples.

6. **Serving and cost.** Serve with an OpenAI-compatible inference server; benchmark throughput and p95 latency; estimate cost per 1,000 requests vs the hosted large model.
   *Acceptance:* benchmark table and a one-paragraph recommendation.

## Key code

```python
import json
from datasets import load_dataset
from peft import LoraConfig
from trl import SFTConfig, SFTTrainer
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch

BASE = "a-small-open-instruct-model"
SYSTEM = ("Triage the support ticket. Reply with JSON only: "
          '{"category": one of [billing, bug, account, how_to, feature_request], '
          '"priority": one of [low, medium, high, urgent], "product_area": string}')

def to_chat(row):
    return {"messages": [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": row["ticket_text"]},
        {"role": "assistant", "content": json.dumps(
            {"category": row["category"], "priority": row["priority"],
             "product_area": row["product_area"]})},
    ]}

ds = load_dataset("json", data_files={"train": "train.jsonl", "validation": "val.jsonl"})
ds = ds.map(to_chat, remove_columns=ds["train"].column_names)

tok = AutoTokenizer.from_pretrained(BASE)
model = AutoModelForCausalLM.from_pretrained(
    BASE, device_map="auto",
    quantization_config=BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                           bnb_4bit_compute_dtype=torch.bfloat16))

trainer = SFTTrainer(
    model=model, processing_class=tok,
    train_dataset=ds["train"], eval_dataset=ds["validation"],
    peft_config=LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, task_type="CAUSAL_LM",
                           target_modules="all-linear"),
    args=SFTConfig(output_dir="triage-lora", num_train_epochs=2, learning_rate=2e-4,
                   per_device_train_batch_size=8, gradient_accumulation_steps=2,
                   eval_strategy="steps", eval_steps=100, save_strategy="steps", save_steps=100,
                   load_best_model_at_end=True, metric_for_best_model="eval_loss",
                   assistant_only_loss=True, bf16=True, logging_steps=20, seed=42),
)
trainer.train()
trainer.save_model("triage-lora/best")

def evaluate(generate, test_rows):
    fields = ["category", "priority", "product_area"]
    correct = {f: 0 for f in fields}
    valid = 0
    for row in test_rows:
        try:
            pred = json.loads(generate(SYSTEM, row["ticket_text"]))
            valid += 1
            for f in fields:
                correct[f] += str(pred.get(f, "")).lower() == str(row[f]).lower()
        except json.JSONDecodeError:
            pass
    n = len(test_rows)
    return {"json_valid": valid / n, **{f"acc_{f}": c / n for f, c in correct.items()}}
```

(Library argument names change between versions — check current docs; the structure is what matters.)

## Stretch goals

- Distillation: label a large unlabeled pool with the large model, filter by agreement or confidence, and train on it.
- Compare LoRA ranks and target modules; plot accuracy vs adapter size.
- Try DPO on pairs where the SFT model made mistakes.
- Serve multiple task adapters on one base model.
- Quantize the merged model and re-evaluate.

## What to say about it in interviews

- **Why fine-tune here**: a narrow, high-volume task with stable labels — behavior, not knowledge — where cost and latency matter.
- **Baselines first**: the table showing zero-shot, few-shot, large model, and tuned model; you didn't claim a win without it.
- **Data discipline**: leakage-safe splits, deduplication, PII scrubbing, and a data card.
- **Training details**: QLoRA memory savings, response-only loss, chat-template correctness, early stopping on validation loss.
- **Business framing**: cost per 1,000 requests and p95 latency versus the hosted large model, and the maintenance cost of re-tuning when the base model changes.
