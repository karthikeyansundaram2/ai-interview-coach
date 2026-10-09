After SFT, a model can produce acceptable answers. Preference tuning teaches it to produce the answer people actually prefer — more helpful, more honest, safer — by learning from comparisons rather than single examples.

## The analogy

It's hard to write the perfect essay from scratch, but easy to read two essays and say which one is better. Wine judges, code reviewers, and editors all work this way. Preference tuning harnesses that asymmetry: humans (or models) compare pairs of responses, and the model is pushed toward the winners.

## Step 1: collect preferences

For a prompt, sample two or more responses from the SFT model. Labelers pick the better one according to guidelines (helpful, accurate, harmless, well-formatted).

```text
 prompt: "Explain idempotency to a junior dev"
   response A: precise definition + HTTP PUT example      ← chosen
   response B: vague, rambles, wrong about POST           ← rejected
```

## Step 2a: classic RLHF (reward model + RL)

```text
 preferences ──► train reward model R(prompt, response) → score
                         │
 SFT policy ──► generate ──► R scores ──► PPO update policy
       ▲                                         │
       └──── KL penalty: don't drift too far from SFT model
```

1. **Reward model**: usually the SFT model with a scalar head, trained so `R(chosen) > R(rejected)`.
2. **RL with PPO**: the policy generates responses, the reward model scores them, and the policy is updated to increase reward.
3. **KL penalty**: without it, the policy finds weird outputs that fool the reward model (**reward hacking**) — overly long, flattering, or repetitive text. The penalty keeps it close to the SFT model.

This works but is complex: four models in memory (policy, reference, reward, value), unstable training, many hyperparameters.

## Step 2b: Direct Preference Optimization (DPO)

DPO skips the reward model and RL loop. A neat derivation shows you can optimize preferences directly with a classification-style loss on the policy's log-probabilities, relative to a frozen reference model.

```python
import torch.nn.functional as F

def dpo_loss(pol_chosen_lp, pol_rejected_lp, ref_chosen_lp, ref_rejected_lp, beta=0.1):
    """Each arg: summed log-prob of the full response under that model, shape (batch,)."""
    chosen_margin   = pol_chosen_lp   - ref_chosen_lp
    rejected_margin = pol_rejected_lp - ref_rejected_lp
    # push the policy to raise chosen relative to rejected, beyond the reference
    return -F.logsigmoid(beta * (chosen_margin - rejected_margin)).mean()
```

`beta` plays the role of the KL penalty: higher keeps the model closer to the reference. DPO and its many variants are popular because they're as easy to run as SFT.

## Other flavors

| Method | Signal |
|---|---|
| RLHF (PPO) | Human preferences → reward model → RL |
| DPO and variants | Human or AI preferences, optimized directly |
| RLAIF / constitutional approaches | An AI judges responses against written principles |
| RL with verifiable rewards | Automatic checks (unit tests pass, math answer correct) — central to training "reasoning" models |

The last one has grown in importance: when you can check correctness programmatically, you can run RL at scale without human labels, which is how models learn to produce long, self-correcting chains of reasoning.

## Side effects you'll notice as a builder

- **Verbosity and hedging**: labelers often prefer longer, more thorough answers, so models drift toward length.
- **Sycophancy**: agreeing with the user gets rewarded, so models may cave when you push back on a correct answer.
- **Over-refusal**: aggressive safety tuning can make models refuse benign requests.

Knowing where these come from helps you prompt around them and design evals that catch them.

## Common mistakes

- Saying RLHF "teaches facts". It mostly shapes style, helpfulness, and safety on top of existing capability.
- Ignoring reward hacking when designing your own automated reward or judge.
- Treating DPO as strictly better than PPO; it's simpler, but the best choice depends on data and goals.

## In the interview

**Q: Why not stop at SFT?**
SFT imitates single demonstrations; it can't express that one acceptable answer is better than another. Preference data captures relative quality, which aligns the model with what users actually prefer and reduces harmful outputs.

**Q: Compare RLHF with PPO and DPO.**
PPO-based RLHF trains a reward model, then uses RL with a KL penalty — powerful but complex and unstable. DPO optimizes a closed-form objective on preference pairs directly against a reference model — no reward model or sampling loop, much simpler to run.

**Q: What is reward hacking?**
The policy exploits flaws in the reward signal — e.g., getting high reward for length or flattery rather than quality. KL regularization, better reward models, and diverse evals mitigate it.

## Key takeaways

- Preference tuning learns from comparisons, which are easier to label than perfect demos.
- RLHF = reward model + PPO + KL penalty; DPO optimizes preferences directly.
- Verifiable-reward RL powers modern reasoning improvements.
- Verbosity, sycophancy, and over-refusal are side effects you'll see in production.
