A neural network is nothing more exotic than a stack of simple math layers: multiply by a matrix, add a bias, squash through a non-linear function, repeat. The magic comes from stacking enough of them and letting gradient descent tune the matrices.

## The analogy

Picture a hiring pipeline. The first round of screeners each look for one simple thing — "has Python", "mentions distributed systems", "more than five years". The second round combines those signals: "strong backend profile" fires when several first-round flags are on. A final reviewer combines second-round judgments into "hire" or "no". Each screener is a neuron; each round is a layer; the combining rules are the weights.

## One neuron

A neuron takes inputs `x`, computes a weighted sum plus bias, and applies an activation:

```text
z = w1·x1 + w2·x2 + ... + wn·xn + b
a = activation(z)
```

A **layer** is many neurons side by side, which is just a matrix multiply: `a = activation(W @ x + b)`. A network is layers chained together.

```text
 input       hidden 1      hidden 2      output
 x1 ─┐      ┌─ h1 ─┐      ┌─ g1 ─┐
 x2 ─┼──W1──┼─ h2 ─┼──W2──┼─ g2 ─┼──W3── y
 x3 ─┘      └─ h3 ─┘      └─ g3 ─┘
```

## Why activations matter

Without a non-linear activation, stacking layers is pointless: `W3(W2(W1 x))` is just one matrix `W x`. The network could only learn straight lines. Non-linearities let the stack bend and fold the input space, so it can represent curved decision boundaries and, with enough units, approximate almost any function (the **universal approximation** result).

| Activation | Formula (roughly) | Where you see it |
|---|---|---|
| Sigmoid | `1 / (1 + e^-z)` | Binary output probabilities; rarely in hidden layers now |
| Tanh | squashes to (-1, 1) | Older RNNs |
| ReLU | `max(0, z)` | The default for years; cheap, avoids vanishing gradients |
| GELU / SiLU | smooth ReLU-like curves | Transformers and modern LLMs |
| Softmax | `e^zi / Σ e^zj` | Final layer for multi-class; turns scores into probabilities |

Sigmoid and tanh flatten out at the extremes, so their gradients become tiny — a problem called **vanishing gradients** that made deep networks hard to train before ReLU-style activations.

## A forward pass in code

```python
import numpy as np

def relu(z):
    return np.maximum(0, z)

def softmax(z):
    z = z - z.max(axis=-1, keepdims=True)       # numerical stability
    e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)

rng = np.random.default_rng(0)
W1, b1 = rng.normal(0, 0.1, (4, 16)), np.zeros(16)
W2, b2 = rng.normal(0, 0.1, (16, 3)), np.zeros(3)

def forward(x):
    h = relu(x @ W1 + b1)          # hidden layer
    logits = h @ W2 + b2           # raw scores, one per class
    return softmax(logits)

x = rng.normal(size=(2, 4))        # batch of 2 examples, 4 features
print(forward(x))                  # each row sums to 1
```

The raw scores before softmax are called **logits** — the same word you'll see in LLM APIs. An LLM's final layer produces one logit per vocabulary token; softmax turns them into next-token probabilities.

## Parameters and scale

Every weight and bias is a parameter. The toy network above has `4·16 + 16 + 16·3 + 3 = 131`. LLMs have billions, mostly in the matrices of attention and feed-forward layers. Parameter count drives memory: at 2 bytes per parameter (16-bit), a 7-billion-parameter model needs about 14 GB just to hold its weights. That arithmetic comes up constantly when you discuss serving costs.

## Common mistakes

- Forgetting the activation and wondering why depth doesn't help.
- Initializing all weights to the same value: every neuron learns the same thing (symmetry). Use small random values.
- Applying softmax and then a loss that expects logits — many libraries apply softmax internally, so you double-apply.
- Confusing parameter count with "intelligence": data and training matter as much as size.

## In the interview

**Q: Why do neural networks need non-linear activation functions?**
Without them, any stack of linear layers collapses into a single linear transform, so depth adds no expressive power. Non-linearities let the network model complex, curved relationships.

**Q: What are logits?**
The unnormalized scores a network outputs before softmax. Softmax converts them to a probability distribution; temperature scaling in LLMs divides logits before that step.

**Q: Roughly how much GPU memory do the weights of a 13B-parameter model need in 16-bit?**
About 26 GB (13B × 2 bytes), before activations and KV cache.

## Key takeaways

- A layer is `activation(W·x + b)`; a network is layers in sequence.
- Non-linear activations are what make depth useful.
- Logits are pre-softmax scores; softmax makes them probabilities.
- Parameter count × bytes-per-parameter gives you weight memory — a number you'll use often.
