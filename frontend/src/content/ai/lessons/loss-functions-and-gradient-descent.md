Training a model means turning "how wrong am I?" into a single number and then nudging every parameter in the direction that makes that number smaller. The number is the loss; the nudging is gradient descent.

## The analogy

You are on a foggy hillside at night and want to reach the valley. You can't see the valley, but you can feel the slope under your feet. So you take a step downhill, feel again, step again. Step size matters: tiny steps take forever, huge leaps overshoot and land you on the opposite slope. That is gradient descent, and the step size is the **learning rate**.

## Loss functions

A loss function compares predictions to targets and returns a scalar. The choice depends on the task.

| Task | Loss | Intuition |
|---|---|---|
| Regression | Mean squared error | Big misses are punished quadratically |
| Regression (robust) | Mean absolute error / Huber | Less sensitive to outliers |
| Classification | Cross-entropy | Punishes confident wrong answers heavily |
| LLM pretraining | Cross-entropy over next token | Log-probability assigned to the true next token |
| Embeddings | Contrastive (e.g. InfoNCE) | Pull matching pairs together, push others apart |

Cross-entropy is the one to know cold. For a correct class with predicted probability `p`, loss is `-log(p)`. If the model says 0.9 for the right answer, loss ≈ 0.11. If it says 0.01, loss ≈ 4.6. Being confidently wrong is very expensive. **Perplexity**, a common LLM metric, is just `exp(average cross-entropy)` — roughly "how many tokens the model is torn between".

## Gradient descent

The gradient `∇L(θ)` is the vector of partial derivatives of the loss with respect to every parameter. It points uphill. So we step the other way:

```text
θ_new = θ_old − learning_rate × ∇L(θ_old)
```

Computing the gradient over the whole dataset per step is too slow, so we use **mini-batch stochastic gradient descent**: estimate the gradient from a small random batch (say 32–4,096 examples), step, repeat. The noise in that estimate is actually helpful — it shakes the model out of poor regions.

```python
import numpy as np

rng = np.random.default_rng(0)
X = rng.normal(size=(1000, 3))
true_w = np.array([2.0, -1.0, 0.5])
y = X @ true_w + rng.normal(scale=0.1, size=1000)

w = np.zeros(3)
lr, batch = 0.1, 64
for step in range(300):
    idx = rng.integers(0, len(X), batch)
    xb, yb = X[idx], y[idx]
    pred = xb @ w
    grad = 2 * xb.T @ (pred - yb) / batch     # d(MSE)/dw
    w -= lr * grad

print(w.round(2))   # close to [ 2.  -1.   0.5]
```

## Learning rate is the most important knob

```text
 too small:  ......................→ (slow, may stall)
 just right: \_\_\_→ minimum
 too large:  /\/\/\/\  (oscillates or diverges, loss becomes NaN)
```

Modern training uses **schedules**: a short warm-up from near zero, then a gradual decay. That avoids instability early and allows fine settling later.

## Non-convexity

For linear regression the loss surface is a single bowl. For neural networks it is a rugged landscape with many valleys and saddle points. Gradient descent doesn't guarantee the global minimum, but in very high dimensions most local minima turn out to be about equally good, so it works remarkably well in practice.

## Common mistakes

- Using accuracy as a training objective. It's not differentiable; optimize cross-entropy and *report* accuracy.
- Ignoring loss scale: a learning rate that works for one loss may explode with another.
- Panicking at a noisy loss curve. Mini-batch loss is noisy by design; look at the smoothed trend.
- Forgetting that loss going down on train says nothing about generalization.

## In the interview

**Q: Why cross-entropy instead of MSE for classification?**
Cross-entropy matches the probabilistic output of softmax, gives strong gradients when the model is confidently wrong, and corresponds to maximum likelihood. MSE on probabilities yields weak gradients when predictions saturate.

**Q: What happens if the learning rate is too high?**
Updates overshoot the minimum; loss oscillates or diverges, sometimes to NaN. Fixes: lower the rate, add warm-up, or clip gradients.

**Q: What is perplexity?**
The exponential of average per-token cross-entropy. Lower is better; a perplexity of 10 means the model is, on average, as uncertain as choosing uniformly among 10 tokens.

## Key takeaways

- Loss turns error into one number; pick it to match the task (cross-entropy for classification and LLMs).
- Gradient descent steps opposite the gradient; mini-batches make it practical.
- Learning rate and its schedule matter more than almost anything else.
- Perplexity is just exponentiated cross-entropy.
