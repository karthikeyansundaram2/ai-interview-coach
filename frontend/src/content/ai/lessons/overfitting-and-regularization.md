A model that memorizes its training data instead of learning the underlying pattern is overfitting. It looks brilliant in training and stumbles on anything new — and most of practical ML is the craft of preventing that.

## The analogy

Two students prepare for a driving test. One memorizes the exact route the examiner used last year, turn by turn. The other learns how to read signs and handle intersections. On last year's route, both pass. On a new route, only the second one does. The first student overfit.

The opposite failure exists too: a student who only learned "press the pedal to go" underfits. They fail on every route.

## How it works

Plot error against model complexity (or training time) and you get the classic picture:

```text
 error
   │\                               validation
   │ \                          ___/
   │  \                    ___/
   │   \______        ___/
   │          \______/   <- sweet spot
   │                 \_______
   │                         \______  training
   └──────────────────────────────────── complexity / epochs
     underfit               overfit
```

- **Underfitting (high bias)**: both training and validation error are high. The model is too simple or hasn't trained enough.
- **Overfitting (high variance)**: training error keeps dropping, validation error turns upward. The model is fitting noise.

The **bias–variance trade-off** names this tension: simpler models make systematic errors, flexible models make erratic ones. You want the model that minimizes error on new data.

## Regularization: the toolbox

Regularization is anything that discourages a model from fitting noise.

| Technique | Idea |
|---|---|
| More / better data | The single best fix; noise averages out |
| L2 (weight decay) | Penalize large weights; prefer smooth functions |
| L1 | Penalize absolute weights; push many to exactly zero |
| Dropout | Randomly drop units during training so no single path dominates |
| Early stopping | Stop when validation loss stops improving |
| Data augmentation | Create varied copies (paraphrases, crops) of training examples |
| Smaller model | Fewer parameters, less capacity to memorize |

```python
import numpy as np

def loss_with_l2(y_true, y_pred, weights, lam=1e-3):
    mse = np.mean((y_true - y_pred) ** 2)
    penalty = lam * np.sum(weights ** 2)    # big weights cost extra
    return mse + penalty

# Early stopping in a training loop
best, patience, bad_epochs = float("inf"), 3, 0
for epoch in range(100):
    train_one_epoch()
    val_loss = evaluate()
    if val_loss < best - 1e-4:
        best, bad_epochs = val_loss, 0
        save_checkpoint()
    else:
        bad_epochs += 1
        if bad_epochs >= patience:
            break
```

## A twist with large models

Very large neural networks sometimes show **double descent**: past the point where they can fit training data perfectly, validation error can start falling again as size grows. LLMs are trained on so much data that they typically see most examples only once or a few times, which itself acts as strong regularization. Overfitting comes back the moment you **fine-tune** on a small dataset — a few thousand examples for many epochs will happily be memorized. That is why fine-tuning recipes use few epochs, low learning rates, and validation-based early stopping.

## The LLM-app version of overfitting

You can overfit without touching weights:

- A prompt with twelve special-case instructions, each added to fix one failing eval example.
- A RAG pipeline tuned until it aces 30 hand-picked questions.

The fix is the same: a larger, more diverse eval set, plus a held-out set you don't tune against.

## Common mistakes

- Reading only training loss and celebrating.
- Adding model capacity when the real problem is noisy labels.
- Fine-tuning for many epochs on a tiny dataset and calling the memorized outputs "learned behavior".
- Patching prompts per failure until they are brittle rule lists.

## In the interview

**Q: How do you detect overfitting?**
Compare training and validation metrics over time. A widening gap — training improving while validation stalls or worsens — is the signature. Then confirm with a held-out test set or fresh production samples.

**Q: Name three ways to reduce overfitting and when you'd pick each.**
More data when it's available (best fix overall); weight decay or dropout when the model is large relative to data; early stopping as a cheap default whenever you have a validation set. For fine-tuning, I'd also lower epochs and learning rate.

**Q: What does high bias look like, and how do you fix it?**
Training and validation error both high and close together. Use a more expressive model, better features, or train longer — regularizing harder would make it worse.

## Key takeaways

- Overfitting = low training error, high validation error; underfitting = both high.
- Regularization (weight decay, dropout, early stopping, augmentation) trades training fit for generalization.
- More diverse data is the strongest regularizer.
- Prompts and pipelines overfit to small eval sets too — keep a held-out set.
