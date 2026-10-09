Machine learning is writing a program by showing examples instead of writing rules. You give the computer inputs and (often) the right answers, and it searches for a function that maps one to the other well enough to handle inputs it has never seen.

## The analogy

Think about how you learned to tell ripe mangoes from unripe ones. Nobody handed you a rulebook with exact color codes and firmness thresholds. You squeezed a few hundred mangoes, someone told you "ripe" or "not yet", and your brain built an internal rule. Machine learning does the same thing with numbers: it adjusts internal parameters until its guesses match the labels.

## How it works

Every ML setup has three parts:

1. **A model** — a function with adjustable parameters, `y_hat = f(x; θ)`. It could be a straight line, a decision tree, or a neural network with billions of weights.
2. **Data** — examples of inputs `x`, and sometimes targets `y`.
3. **A learning procedure** — a way to change `θ` so the model's outputs get better according to some measure.

The kinds of learning differ mostly in what the data looks like.

| Type | Data | Goal | Examples |
|---|---|---|---|
| Supervised | `(x, y)` pairs | Predict `y` from `x` | Spam detection, price prediction, intent classification |
| Unsupervised | `x` only | Find structure | Clustering customers, anomaly detection, dimensionality reduction |
| Self-supervised | `x` only, labels derived from `x` | Predict hidden parts of the input | Next-token prediction (LLMs), masked-word prediction |
| Reinforcement | States, actions, rewards | Maximize long-run reward | Game playing, RLHF for LLMs |

Supervised learning splits further into **classification** (discrete labels: spam / not spam) and **regression** (continuous values: delivery time in minutes).

Self-supervised learning is the one that matters most for LLMs. There are no human labels: the "label" for each position in a sentence is simply the next word, which is already in the text. That trick turns the entire internet into training data.

```python
from sklearn.linear_model import LogisticRegression
from sklearn.cluster import KMeans
import numpy as np

# Supervised: features -> label
X = np.array([[0.2, 3], [0.9, 1], [0.1, 4], [0.8, 0]])   # e.g. [link_ratio, word_count/100]
y = np.array([0, 1, 0, 1])                                 # 1 = spam
clf = LogisticRegression().fit(X, y)
print(clf.predict([[0.85, 1]]))      # -> [1]

# Unsupervised: features only -> groups
km = KMeans(n_clusters=2, n_init="auto").fit(X)
print(km.labels_)                    # cluster ids, no meaning attached
```

Notice the unsupervised output: cluster IDs have no names. A human still has to interpret what "cluster 0" means.

## Where classic ML still matters for an AI engineer

LLMs did not make classic ML obsolete. In production you will still build or reason about:

- **Classifiers** that route traffic (is this query about billing or tech support?), often cheaper and faster than an LLM call.
- **Rerankers and embedding models**, which are supervised models trained on relevance pairs.
- **Evaluation**, which is really just measuring a model's predictions against labels — precision, recall, and accuracy all come from here.

## Common mistakes

- **Treating ML as magic.** A model only learns patterns present in its data. If your training set has no sarcastic reviews, the sentiment model will not handle sarcasm.
- **Confusing correlation with the rule you wanted.** A model that detects wolves by spotting snow in the background is "accurate" on the test set and useless in summer.
- **Reaching for an LLM when a logistic regression would do.** For a fixed label set with plenty of labeled data, a small classifier is often cheaper, faster, and more predictable.

## In the interview

**Q: What's the difference between supervised and self-supervised learning?**
Supervised learning needs external labels, usually from humans. Self-supervised learning creates labels from the data itself — for example, hiding the next token and asking the model to predict it — so it scales to unlabeled corpora. LLM pretraining is self-supervised.

**Q: When would you not use an LLM for a classification task?**
When the label set is fixed, you have labeled data, and you need low latency or low cost at high volume. A fine-tuned small classifier or even logistic regression on embeddings is cheaper and more stable. An LLM is better when labels change often or you have almost no training data.

**Q: Give an example of unsupervised learning in an LLM system.**
Clustering user queries by embedding to discover common intents, or flagging outlier queries for review. Both find structure without labels.

## Key takeaways

- ML = model + data + a procedure that tunes parameters to reduce error.
- Supervised uses labels; unsupervised finds structure; self-supervised manufactures labels from raw data.
- LLMs are self-supervised at their core, then refined with supervised and reinforcement methods.
- Classic ML remains useful for routing, ranking, and evaluation around LLMs.
