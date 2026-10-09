Gradient descent tells you which way is downhill; an optimizer decides how big a step to take and how to smooth out the noise. Knowing the anatomy of a training loop lets you read any fine-tuning script and debug it when the loss curve misbehaves.

## The analogy

Plain gradient descent is a hiker who reacts only to the slope under their foot. Momentum is a heavy ball rolling downhill: it builds speed in consistent directions and isn't knocked off course by every pebble. Adam is that ball fitted with smart suspension that adjusts separately for each direction — stiff where the ground is bumpy, loose where it's smooth.

## The common optimizers

| Optimizer | Idea | Notes |
|---|---|---|
| SGD | `θ -= lr · g` | Simple; needs careful learning rate |
| SGD + momentum | Keep a running average of gradients; step along it | Smoother, faster through ravines |
| Adam | Per-parameter step sizes from running averages of `g` and `g²` | Robust default for deep learning |
| AdamW | Adam with weight decay applied separately from the gradient | Standard for transformers |

Adam stores two extra numbers per parameter (first and second moment estimates). So for full fine-tuning in mixed precision, memory is roughly: weights + gradients + 2 optimizer states + fp32 master weights — often quoted as about 16 bytes per parameter. That's why full fine-tuning a 7B model needs far more GPU memory than serving it, and why LoRA (which trains only a sliver of parameters) is so popular.

## Learning-rate schedules

```text
 lr
  │      ____
  │     /    \___
  │    /         \____
  │   /               \_____
  │  /                      \______
  └─┴──────────────────────────────── steps
   warm-up       cosine decay
```

Warm-up avoids huge early updates when Adam's statistics are still unreliable. Decay lets the model settle into a minimum.

## Anatomy of a training step

```python
import torch
from torch.utils.data import DataLoader

def train(model, dataset, epochs=3, lr=2e-5, accum_steps=4, max_grad_norm=1.0):
    loader = DataLoader(dataset, batch_size=8, shuffle=True)
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)
    total = epochs * len(loader) // accum_steps
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=total, pct_start=0.05)

    model.train()
    for epoch in range(epochs):
        for i, batch in enumerate(loader):
            with torch.autocast("cuda", dtype=torch.bfloat16):   # mixed precision
                loss = model(**batch).loss / accum_steps
            loss.backward()                                       # accumulate grads
            if (i + 1) % accum_steps == 0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
                opt.step()
                sched.step()
                opt.zero_grad(set_to_none=True)
        print(f"epoch {epoch}: last loss {loss.item() * accum_steps:.3f}")
```

Key pieces:
- **Mixed precision** (bf16/fp16) halves activation memory and speeds up matmuls.
- **Gradient accumulation** simulates a larger batch by summing gradients over several small batches before stepping.
- **Gradient clipping** caps the gradient norm to stop rare huge updates from destabilizing training.
- **zero_grad** after every step, or gradients pile up.

## Reading loss curves

| Symptom | Likely cause |
|---|---|
| Loss is NaN early | Learning rate too high, fp16 overflow, bad data |
| Loss flat from the start | Learning rate too low, frozen params, labels masked out |
| Train ↓, val ↑ | Overfitting — stop earlier, fewer epochs |
| Loss spikes then recovers | Bad batch or rate too high; clipping helps |

## Common mistakes

- Using a pretraining-scale learning rate for fine-tuning; fine-tuning rates are typically much smaller.
- Forgetting the scheduler step, or stepping it per micro-batch instead of per optimizer step.
- Dividing the loss incorrectly with gradient accumulation (effective learning rate changes).
- Evaluating in training mode.

## In the interview

**Q: Why is AdamW the default for transformers?**
Adam adapts step size per parameter, which handles the very different gradient scales across embedding, attention, and output layers. AdamW decouples weight decay from the adaptive update so regularization behaves as intended.

**Q: How do you fit a bigger effective batch on a small GPU?**
Gradient accumulation: run several micro-batches, sum their gradients, then step once. Combine with mixed precision and gradient checkpointing to save memory.

**Q: Why use learning-rate warm-up?**
Early in training, Adam's moment estimates are noisy and the model is far from a good region, so large steps can diverge. Ramping the rate up gradually stabilizes the start.

## Key takeaways

- AdamW plus warm-up and decay is the standard recipe for transformer training.
- Optimizer state is a major memory cost — a key reason PEFT exists.
- A training step: forward, loss, backward, clip, step, schedule, zero grads.
- Loss curves are diagnostic; learn the common shapes.
