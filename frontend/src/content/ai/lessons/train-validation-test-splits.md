A model that scores 99% on the data it trained on has told you almost nothing. You only learn whether it works by testing it on data it has never seen — and you have to protect that unseen data carefully.

## The analogy

A teacher who hands out the exam questions as homework will get perfect scores and learn nothing about whether students understand the material. Good teachers keep three sets of problems: homework (practice), quizzes (to adjust teaching), and the final exam (sealed until the end). That is train, validation, and test.

## How it works

```text
            all labeled data
 ┌───────────────────────────────────────────┐
 │  train (~70-80%) │ val (~10-15%) │ test   │
 └───────────────────────────────────────────┘
   fit parameters     pick settings   report once
```

- **Training set**: the model sees it and updates its parameters on it.
- **Validation set**: you use it to make *your* decisions — which model, which hyperparameters, when to stop training, which prompt variant wins.
- **Test set**: touched once, at the end, to estimate real-world performance.

Why three, not two? Every time you look at validation results and make a choice, you leak a little information about that set into your design. After fifty experiments, your validation score is optimistic. The test set is the one you have not optimized against.

When data is scarce, **k-fold cross-validation** rotates which slice is used for validation, so every example gets a turn, and you average the scores.

```python
from sklearn.model_selection import train_test_split, GroupShuffleSplit
import pandas as pd

df = pd.read_csv("tickets.csv")   # columns: customer_id, text, label, created_at

# Naive random split -- fine only if rows are truly independent
train, temp = train_test_split(df, test_size=0.3, stratify=df["label"], random_state=42)
val, test = train_test_split(temp, test_size=0.5, stratify=temp["label"], random_state=42)

# Group split: all tickets from one customer land in the same split
gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
train_idx, test_idx = next(gss.split(df, groups=df["customer_id"]))

# Time split: train on the past, test on the future
df = df.sort_values("created_at")
cutoff = int(len(df) * 0.8)
train_t, test_t = df.iloc[:cutoff], df.iloc[cutoff:]
```

## Choosing the split strategy

| Situation | Split by |
|---|---|
| Independent rows, balanced classes | Random |
| Imbalanced classes | Stratified (keep label ratios) |
| Multiple rows per user/document | Group (keep a group together) |
| Data changes over time | Time (train past, test future) |

## Data leakage: the silent killer

Leakage is when information about the test set sneaks into training. Results look great, production looks terrible.

- **Duplicate leakage**: the same support ticket appears in train and test (common after scraping or retries).
- **Group leakage**: different chunks of the same PDF in train and test, so the model memorizes the document.
- **Temporal leakage**: a feature like "resolution_time" that is only known after the event you are predicting.
- **Preprocessing leakage**: fitting a scaler or vocabulary on the full dataset before splitting.

## Why this matters for LLM apps

You rarely train an LLM yourself, but the same discipline applies to **prompt and pipeline development**. If you tweak a prompt until it passes every example in your eval set, you have overfit the prompt to that set. Keep a dev set you iterate against and a held-out set you check before each release. And when you build few-shot prompts, never pick examples from your test set.

## Common mistakes

- Reporting validation accuracy as the final number after tuning on it.
- Random-splitting time-series or per-user data.
- Deduplicating *after* splitting rather than before.
- Building an eval set from the same documents used in few-shot examples.

## In the interview

**Q: Why do we need a validation set separate from the test set?**
Because model selection and hyperparameter tuning consume information from whatever set you evaluate on. The validation set absorbs that bias; the test set stays untouched so its score is an honest estimate of performance on new data.

**Q: Your model has great offline metrics but fails in production. What do you check first?**
Leakage (duplicates, group or temporal leakage), then distribution shift between the test set and live traffic. I would compare feature and input distributions and sample real production failures into a new eval set.

**Q: How would you split data for a model predicting next month's churn?**
By time. Train on earlier months, validate on a later month, test on the latest month. A random split would let the model peek at the future.

## Key takeaways

- Train fits parameters, validation guides decisions, test is touched once.
- Pick the split strategy to mirror how the model will meet new data: random, stratified, grouped, or temporal.
- Leakage produces great-looking numbers that collapse in production.
- The same rules apply to prompts and RAG pipelines: keep a held-out eval set.
