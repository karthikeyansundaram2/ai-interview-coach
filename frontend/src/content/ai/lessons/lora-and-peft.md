Full fine-tuning updates every weight in a model, which needs enormous GPU memory and produces a full-size copy per task. Parameter-efficient fine-tuning (PEFT) — LoRA above all — trains a tiny set of extra weights instead, making tuning cheap enough to do on a single GPU.

## The analogy

Instead of reprinting an entire 1,000-page textbook to adapt it for a new course, you write a slim booklet of margin notes and corrections that sits alongside it. Swap booklets to switch courses; the textbook never changes. LoRA adapters are those booklets.

## How LoRA works

A weight matrix `W` (say 4096 × 4096 ≈ 16.7M parameters) is frozen. LoRA learns an update `ΔW` expressed as the product of two thin matrices:

```text
 W' = W + (α / r) · B · A

 W: d × d (frozen)        A: r × d (trainable)     B: d × r (trainable, starts at 0)

 with d = 4096, r = 16:  A + B = 2 · 16 · 4096 ≈ 131k params  (~0.8% of W)
```

The insight: the change needed to adapt a pretrained model to a task tends to be **low-rank** — it lives in a small subspace — so a rank-8 to rank-64 update is often enough.

Because `B` starts at zero, training begins exactly at the base model. After training you can **merge** `BA` into `W` (no extra inference latency) or keep adapters separate and hot-swap them, even serving many adapters over one base model.

## Key hyperparameters

| Parameter | Meaning | Typical starting point |
|---|---|---|
| `r` (rank) | Capacity of the adapter | 8–32 |
| `lora_alpha` | Scaling of the update | Often 1–2× r |
| `target_modules` | Which matrices get adapters | Attention projections; often all linear layers for better quality |
| `lora_dropout` | Regularization | 0.05–0.1 |
| Learning rate | Higher than full fine-tuning | Around 1e-4 to 2e-4 |

## QLoRA

QLoRA loads the frozen base model in **4-bit** quantized form and trains LoRA adapters in higher precision on top. Memory drops dramatically — mid-size models become tunable on a single consumer or workstation GPU — with quality close to 16-bit LoRA in many reports.

## A minimal training script

```python
from datasets import load_dataset
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from trl import SFTConfig, SFTTrainer
import torch

base = "an-open-instruct-model"                  # pick a small open model
tok = AutoTokenizer.from_pretrained(base)
model = AutoModelForCausalLM.from_pretrained(
    base,
    quantization_config=BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                           bnb_4bit_compute_dtype=torch.bfloat16),
    device_map="auto",
)

lora = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, task_type="CAUSAL_LM",
                  target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                                  "gate_proj", "up_proj", "down_proj"])

data = load_dataset("json", data_files={"train": "train.jsonl", "eval": "eval.jsonl"})
# each row: {"messages": [{"role": "user", ...}, {"role": "assistant", ...}]}

trainer = SFTTrainer(
    model=model, processing_class=tok, peft_config=lora,
    train_dataset=data["train"], eval_dataset=data["eval"],
    args=SFTConfig(output_dir="out", num_train_epochs=2, learning_rate=2e-4,
                   per_device_train_batch_size=4, gradient_accumulation_steps=4,
                   eval_strategy="steps", eval_steps=50, logging_steps=10, bf16=True),
)
trainer.train()
trainer.save_model("out/adapter")                # a few MB to a few hundred MB
```

Library APIs evolve quickly; check current docs for argument names.

## Other PEFT methods

- **Prefix / prompt tuning**: learn virtual tokens prepended to the input. Very few parameters; generally weaker than LoRA on hard tasks.
- **Adapters**: small bottleneck layers inserted between existing layers; add inference latency unless merged.
- **LoRA variants** (e.g., ones that decompose magnitude and direction, or adapt rank per layer) tweak the recipe for small gains.

## The workflow that matters more than the method

1. Define the task and **build an eval set first**.
2. Measure a prompting baseline (maybe with few-shot).
3. Curate training data: consistent, correct, diverse; deduplicate; hold out eval data.
4. Train with LoRA; watch train vs eval loss; stop early.
5. Evaluate on task metrics *and* a general-capability check for regressions.
6. Serve: merge for simplicity, or multi-adapter serving for many tasks.

Data quality dominates. A thousand clean examples beat ten thousand inconsistent ones.

## Common mistakes

- Tuning without an eval set, then "vibe checking" a few outputs.
- Wrong chat template in training data vs inference.
- Too many epochs on a small dataset → memorization.
- Merging an adapter trained on a 4-bit base into a different-precision base without checking quality.
- Expecting LoRA to inject lots of new knowledge; it's best for behavior and format.

## In the interview

**Q: How does LoRA reduce training cost?**
It freezes the base weights and learns a low-rank update `BA` for selected matrices, so only a tiny fraction of parameters need gradients and optimizer state. Memory and storage drop dramatically, and adapters can be merged or swapped.

**Q: What is QLoRA?**
LoRA trained on top of a base model quantized to 4 bits. The frozen weights take far less memory; adapters train in higher precision, retaining most of the quality.

**Q: How do you pick the LoRA rank?**
Start around 8–16, target all linear layers, and increase rank if eval quality plateaus below target. Higher rank adds capacity but also overfitting risk and size.

## Key takeaways

- LoRA learns a low-rank update `ΔW = BA` while freezing `W`.
- Tiny trainable footprint; adapters merge or hot-swap.
- QLoRA adds 4-bit base weights for single-GPU tuning.
- Data quality and evals matter more than the PEFT variant.
