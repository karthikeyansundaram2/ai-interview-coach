A payment system moves money between customers, merchants, and external processors, and the bar is correctness rather than raw scale: no double charges, no lost payments, and books that always balance. The design revolves around idempotency, a durable state machine, a double-entry ledger, and reconciliation.

## Clarify requirements

**Functional**
- Merchants (or our own e-commerce checkout) create payments: charge a customer's card/UPI/wallet via external payment service providers (PSPs).
- Payment lifecycle: created → authorized → captured → settled; refunds (full/partial).
- Record every money movement in a ledger; merchant balances and payouts.
- Webhooks/notifications to merchants on status changes.
- Out of scope: fraud models (integrate a risk service), currency conversion details, building a card network.

**Non-functional**
- 10M payments/day, peak 1,000 TPS (sales events).
- Exactly-once effect: never charge twice, never lose a successful charge.
- Strong consistency for ledger and payment state; full auditability (append-only).
- High availability, but correctness beats availability: better to fail a payment than to corrupt state.
- PCI DSS compliance: card data never stored in plain form.

## Back-of-the-envelope

- 10M/day ÷ 10^5 ≈ **100 TPS** average, peak ~1k TPS.
- Each payment: ~5 state transitions + ~4 ledger entries → peak ~10k DB writes/s; a sharded relational DB handles this.
- Storage: 10M × (2 KB payment + 4 × 200 B ledger) ≈ **30 GB/day**, ~10 TB/year; retained for years (regulatory).
- PSP latency: 300 ms–3 s per call; timeouts and unknown outcomes are routine.

## API

```text
POST /v1/payments
  headers: Idempotency-Key: <uuid per checkout attempt>
  { "orderId": "o-77", "amount": 49900, "currency": "INR", "paymentMethodToken": "pm_tok_...",
    "capture": "automatic" }
  -> 201 { "paymentId": "pay_123", "status": "PROCESSING" | "SUCCEEDED" | "REQUIRES_ACTION", "nextAction": {...} }

GET  /v1/payments/{id}
POST /v1/payments/{id}/capture
POST /v1/payments/{id}/refunds   { "amount": 10000 }  (Idempotency-Key)
POST /v1/psp/webhooks/{psp}      (signed callbacks from PSPs)
```

Amounts are integers in minor units (paise/cents), never floats.

## Data model

```text
idempotency_keys: (merchant_id, key) PK -> request_hash, payment_id, response, created_at (TTL ~24-72h)

payments (sharded by payment_id or merchant_id):
  payment_id, merchant_id, order_id, amount, currency, status, psp, psp_reference,
  attempt_count, version, created_at, updated_at

payment_events (append-only): payment_id, seq, from_status, to_status, details, ts

ledger_entries (append-only, double-entry):
  entry_id, transaction_id, account_id, direction (DEBIT|CREDIT), amount, currency, created_at
  invariant: for each transaction_id, sum(debits) = sum(credits)

accounts: account_id, type (customer_receivable, merchant_payable, psp_clearing, fees, ...)
balances: account_id -> balance, version   (derived, updated transactionally or via projection)
outbox: events to publish (PaymentSucceeded, RefundIssued)
```

## High-level design

```text
 Client/Merchant --> API gateway (auth, rate limit) --> Payment service
                                                         | 1. idempotency check/insert
                                                         | 2. create payment (CREATED) + outbox
                                                         | 3. risk check (fraud service)
                                                         v
                                                  PSP adapter / router  --> PSP A / PSP B (card, UPI, wallet)
                                                         ^                         |
                                                         |   webhooks / status     |
                                                         +-------------------------+
                                                         | 4. state transition (conditional, versioned)
                                                         | 5. ledger entries (same DB txn)
                                                         v
                                                  Payments DB + Ledger DB
                                                         |
                                     outbox -> Kafka --> merchant webhooks, order service, analytics
                                                         |
                       Reconciliation jobs <-- PSP settlement files (daily) --> discrepancy queue
 Card data: tokenized by a PCI-scoped vault (or the PSP's hosted fields); core services see only tokens.
```

## Deep dives

### 1. Idempotency end to end

- The client generates an `Idempotency-Key` per checkout attempt. The payment service inserts `(merchant_id, key)` with a unique constraint before doing anything. If it exists with a stored response, return that response; if it exists but is in progress, return 409/202 so the client waits.
- Store a hash of the request body; reusing a key with different parameters is rejected.
- The payment service passes a stable idempotency key (e.g., `payment_id + attempt`) to the PSP, so retries to the PSP don't double charge either.
- Consumers of payment events deduplicate by event ID.

### 2. Handling unknown outcomes

A PSP call times out: did the charge happen? Never blindly retry with a new key, and never assume failure.
- Mark the payment `UNKNOWN`/`PROCESSING`, and resolve by querying the PSP's status API with our reference, by waiting for the webhook, or ultimately via the daily settlement file.
- A background worker polls pending payments with backoff.
- The state machine only allows valid transitions (e.g., PROCESSING → SUCCEEDED/FAILED), applied with conditional updates on `version`, so late or duplicate webhooks can't move a payment backwards.

### 3. Double-entry ledger

Every money movement is recorded as a balanced set of entries, e.g., a successful ₹499 charge with a ₹10 fee:

```text
txn T1:  DEBIT  psp_clearing        49900
         CREDIT merchant_payable    48900
         CREDIT platform_fee_revenue 1000
```

- Append-only: corrections are new reversing entries, never updates, giving a full audit trail.
- Payment state change and ledger entries are written in the same database transaction (same shard, keyed by payment/merchant), plus the outbox event.
- Balances are derived from entries (materialized and verified periodically). The invariant "debits = credits" is checked continuously.

### 4. Reconciliation

Internal records, PSP records, and bank settlements will disagree occasionally (missed webhooks, partial captures, fees, chargebacks). Daily jobs ingest PSP settlement reports and match them against our payments and ledger by reference and amount. Mismatches go to a discrepancy queue for automated fixes (e.g., mark a missed success) or human review. Reconciliation is what makes the system trustworthy despite distributed failures.

## Bottlenecks & scaling

- **DB writes**: shard by merchant or payment ID; keep a payment's state, ledger entries, and outbox on the same shard so they share a local transaction.
- **Hot merchant balance rows** (a giant merchant): avoid updating one balance row per payment; append entries and compute balances asynchronously or use sub-accounts.
- **PSP availability**: route across multiple PSPs with health-based routing and circuit breakers; never retry the same payment on a different PSP unless the first is confirmed failed.
- **Compliance**: card data isolated in a vault; encryption at rest; strict audit logging and access control.
- **Multi-region**: active-passive for the ledger with synchronous replication within a region (zero RPO), or a consensus-based database across zones.

## Follow-ups the interviewer may ask

- **Why not use a NoSQL store?** You need multi-row atomicity (state + ledger + outbox) and strong constraints; relational (or NewSQL) fits naturally.
- **How do refunds work?** A refund is its own idempotent object with a state machine, a PSP call, and reversing ledger entries; partial refunds sum must not exceed captured amount (checked transactionally).
- **How do you handle 3-D Secure or UPI collect flows?** Status REQUIRES_ACTION with a redirect or app intent; completion arrives via webhook and/or client callback, both processed idempotently.
- **How do merchant payouts work?** A scheduled job sums merchant_payable per merchant, creates payout transactions with ledger entries, and calls the bank payout API idempotently.
- **What metrics matter?** Authorization success rate per PSP and method, latency, count of payments stuck in UNKNOWN, and reconciliation mismatches.
