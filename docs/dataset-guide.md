# Dataset Guide — how DataCo is used

This document answers four questions an evaluator will ask about the dataset:
**what it contains**, **which columns are used**, **what is predicted**, and
**how it connects to vendor reliability and procurement risk**.

---

## 1. The dataset

**DataCo Smart Supply Chain** — `data/DataCoSupplyChainDataset.csv`

| | |
| --- | --- |
| Rows | 180,519 order lines |
| Columns | 53 |
| Period | 1 Jan 2015 → 9 Sep 2017 |
| Grain | One row per order line |
| Field reference | `data/DescriptionDataCoSupplyChain.csv` |

It is a transactional order log from a retail supply chain. Each row records
what was ordered, on which shipping lane, how long delivery was *promised* to
take, and how long it *actually* took.

### Why it fits this project

The platform is about supplier reliability, and reliability is fundamentally
about **did the supplier deliver when it said it would**. This dataset records
exactly that, 180,519 times over:

```
Days for shipment (scheduled)   what was committed
Days for shipping (real)        what actually happened
```

That pair is the only lateness signal in the source, and **every delivery
number the platform reports is derived from it**. Nothing on a dashboard is a
random number.

### What it does not contain

Honesty matters more than coverage here. The dataset has **no supplier column,
no quality inspection result and no communication log**. Section 4 explains
exactly how those are derived and what assumption each one rests on.

---

## 2. Columns used

### Used directly

| Column | Used for |
| --- | --- |
| `Days for shipment (scheduled)` | The committed lead time; the model's strongest feature |
| `Days for shipping (real)` | Realised delivery; **target only, never a feature** |
| `Shipping Mode` | The lane (Standard / Second / First / Same Day) |
| `Market`, `Order Region` | Destination geography |
| `Category Name`, `Department Name` | The commodity, mapped to procurement categories |
| `Product Name` | Purchase order line description |
| `Order Item Quantity` | Order quantity |
| `Order Item Product Price` | Unit price |
| `Order Item Total`, `Sales` | Order value |
| `Order Item Discount Rate` | Commercial terms |
| `Order Item Profit Ratio` | Basis of the derived quality rating |
| `Order Status` | Mapped to purchase order status |
| `order date (DateOrders)` | Order date (shifted forward — see §3) |
| `Customer Segment`, `Type` | Model features |
| `Order Id` | Deterministic supplier assignment key |

### Deliberately excluded

| Column | Why |
| --- | --- |
| `Late_delivery_risk` | It *is* the target (`real > scheduled`). Using it as a feature would be circular. |
| `Delivery Status` | Same — a restatement of the outcome. |
| `Customer Fname/Lname/Email/Password`, `Customer Street/Zipcode` | Personal data with no procurement relevance. Never loaded. |
| `Latitude`, `Longitude`, `Product Image` | No bearing on supplier reliability. |

---

## 3. From dataset row to purchase order

`backend/etl/load_dataco.py` turns each sampled row into a full chain of
application records — **procurement request → purchase order → line item →
performance evaluation → invoice** — so every dashboard figure traces back
through the ordinary tables, not a separate analytics store.

### The lateness translation

The source measures *shipping* days; the platform measures **delivery against
a committed date**. The bridge:

```
slip           = Days for shipping (real) − Days for shipment (scheduled)
delay_days     = (slip − TOLERANCE_DAYS) × SLIP_SCALE      # tolerance 1, scale 2

expected_delivery = order_date + committed lead time        # 12–32 days by category
actual_delivery   = expected_delivery + delay_days

on time  ⟺  actual_delivery ≤ expected_delivery  ⟺  slip ≤ 1
```

The dataset's one-day tolerance is folded into the **committed date**, so the
application's plain rule — *delivered by the date we agreed* — reproduces the
source's own definition of a late shipment without restating the threshold in
two places.

Resulting base rate: **76.3% on time**, which is a realistic procurement
figure rather than a flattering one.

### Dates are shifted forward

The source ends in 2017. All dates are shifted by a constant offset so the
history ends **today**, giving live dashboards, a meaningful "last 90 days"
filter and genuinely overdue orders. Only the offset changes — every interval,
and therefore every delivery outcome, is preserved exactly.

### Volume

By default the loader samples **6,000 orders evenly across the most recent 24
months**, which keeps every month populated. Adjust with
`--orders` and `--months`.

---

## 4. Derived data, and the assumption behind each

The dataset has no supplier, quality or communication columns. These are
derived — and everything derived is written as **ordinary rows in ordinary
tables**, which the scoring engine then reads back like any other data.

### Supplier identity — derived from lane affinity

Each of the 24 suppliers has a **service profile**: the share of its business
carried on each shipping lane. An order is awarded to a supplier in its
category in proportion to that supplier's affinity for the order's lane
(88% profile, 12% market average, so no supplier is confined to one lane).

This is what makes suppliers genuinely different from one another. The source
data shows sharply different punctuality per lane:

| Lane | On-time rate |
| --- | --- |
| First Class | 100% |
| Same Day | 100% |
| Standard Class | 79.8% |
| Second Class | 40.3% |

So a supplier weighted toward Second Class ends up with a genuinely poor
record — and **its risk level is explainable from its own lane mix rather than
injected as noise**. Realised spread across the 24 suppliers: **59% to 90%
on time**.

The assignment is a deterministic hash of the source order id, so re-running
the loader assigns the same order to the same supplier every time.

### Quality rating — derived from commercial outcome

Mapped from `Order Item Profit Ratio`, `Order Status` and the slip: a line
delivered at a heavy loss usually means rework, returns or a disputed
shipment; a flagged or cancelled order is a quality event in itself; a badly
late shipment tends to arrive in worse condition. The mapping is monotone in
all three.

**Caveat, stated plainly:** profit ratio is largely independent of the lane
that drives supplier assignment, so mean quality ratings cluster tightly
(3.4–3.6 across suppliers). Quality is therefore a *weak discriminator* in
this dataset. It is scored against an acceptance band (2.0 floor, 4.5 target)
rather than the raw 0–5 range, which is standard scorecard practice and keeps
the factor informative instead of collapsing every supplier onto the same
point.

### Communication timings — derived, then measured back

The dataset has no communication log. The loader writes **real message threads
with real timestamps**, where a supplier that misses delivery dates is
modelled as slower to respond. The scoring engine then measures response time
from the gap between an internal message and the supplier's reply — it reads
message rows, not a stored summary figure.

The assumption — *poor delivery performance correlates with poor
responsiveness* — is the one thing to challenge here, and it is stated in the
code at `services/performance.py` and `etl/load_dataco.py`.

### Commodity → procurement category

DataCo is a retail catalogue; the platform's six categories are industrial.
The 50 commodity names are mapped onto the six categories: curated where
obvious (Computers → IT Vendors, Cardio Equipment → Equipment Vendors), then
dealt round-robin in descending volume order so each category carries a
comparable share of the order book.

---

## 5. The predictive model

### What it predicts

> **For a purchase order that has been raised but not yet delivered, the
> probability that it misses its committed delivery date.**

Not a description of the past — a forecast about an order whose outcome is not
yet known. It drives three things in the platform:

1. a risk badge on the purchase order,
2. the forward-looking component of each vendor's reliability score,
3. the *Delay predictions* tab and the predictive delivery alerts.

### How it is built

| | |
| --- | --- |
| Algorithm | `HistGradientBoostingClassifier` (scikit-learn) |
| Target | `late = slip > 1 day` |
| Training rows | 135,389 |
| Test rows | 45,130 |
| Split | **Chronological** — earliest 75% train, latest 25% test |
| Artifact | `backend/ml/artifacts/delay_model.joblib` |
| Metrics | `backend/ml/artifacts/delay_model_metrics.json` |

**Features — all knowable when the order is raised:** shipping mode, market,
order region, procurement category, customer segment, payment type, scheduled
days, quantity, order value, unit price, discount rate, order month/quarter/
weekday, and the supplier's trailing late rate and order count.

### Two guards against fooling ourselves

**Chronological split.** The model trains on 2015-01-01 → 2017-03-01 and is
tested on *later* orders. A random split would let it see orders from the same
week it is being tested on and report a better score than it deserves.

**Leakage audit.** `--audit` (on by default) fails the run if any outcome
column reaches the feature set, or if any feature correlates above 0.98 with
the target. The supplier track-record feature is an expanding mean **shifted
by one order**, so an order never contributes to its own feature value.

### Results — and what they honestly mean

| Metric | Value |
| --- | --- |
| Accuracy (held-out future orders) | **0.8008** |
| Majority-class baseline | 0.7662 |
| ROC AUC | 0.7665 |
| Precision / Recall | 0.594 / 0.469 |
| Brier score | 0.1434 |

**The important finding:** given shipping mode, the Bayes-optimal accuracy on
this dataset — the best any model could possibly do — is **0.8009**. The model
achieves **0.8008**.

The model has learned essentially everything this data contains. The remaining
error is irreducible: within Second Class, the source slip is close to
uniformly distributed across 0–4 days, so no feature set can separate those
cases further.

This is worth stating rather than hiding, because it reframes the headline
number. An 80% accuracy against a 77% baseline looks like a weak model; an 80%
accuracy against an 80% ceiling is a correctly fitted one. It also produces the
genuine procurement insight in the data: **committed lead time is the dominant
driver of whether a date is met.** Aggressive promises are the thing that gets
broken.

Permutation importance confirms it — `shipping_mode` scores 0.207, every other
feature below 0.002. The supplier track-record feature contributes almost
nothing *in this dataset* specifically because supplier identity is itself
derived from lane affinity, so it carries no information beyond the lane. On
real procurement data, where supplier identity is independent of lane, that
feature would carry real weight; it is kept for that reason.

---

## 6. Running the pipeline

```bash
cd backend

# 1. schema + Milestone 1/2 demo data  (drops and recreates the schema)
python seed.py

# 2. train the model on the dataset
python -m ml.train_delay_model

# 3. load 24 months of trading history into PostgreSQL
python -m etl.load_dataco

# 4. score every vendor, with 12 months of back-dated snapshots
python -m services.reliability --backfill 12

# 5. derive the alerts from current data
python -m services.notifier
```

Useful variants:

```bash
python -m ml.train_delay_model --rows 50000     # quick training run
python -m etl.load_dataco --orders 10000        # more history
python -m etl.load_dataco --months 36           # longer window
python -m etl.load_dataco --clear               # remove loaded history
```

Steps 3–5 are **idempotent**: every loaded row is tagged `source_ref`, and a
re-run clears the previous load first. The alert sweep keys each alert to the
event that caused it, so re-running refreshes rather than duplicates.

### What you end up with

| | |
| --- | --- |
| Vendors | 25 across all six categories |
| Purchase orders | ~6,000 over 24 months |
| Performance evaluations | ~5,600 |
| Invoices | ~4,300 |
| Contracts | 24 (expired / expiring / active) |
| Reliability snapshots | ~310 (13 dates per vendor) |
| Committed spend | ~$17.9M |
| Risk spread | 11 Low · 7 Medium · 5 High · 1 Critical |

---

## 7. The honest summary

**What is real:** every delivery outcome, every date interval, every lane,
commodity, quantity and value. On-time rates, delay distributions, trends and
the model all rest on recorded data.

**What is derived, and why:** supplier identity (no supplier column — assigned
by lane affinity, which makes the differences explainable), quality ratings
(no inspection column — inferred from commercial outcome), and communication
timings (no message log — written as real rows, measured back from timestamps).

**What the model does:** predicts delivery-date misses at the information
ceiling of the data, and shows that committed lead time dominates.

**What it does not do:** it will not tell you something the data does not
know. Within a lane, the residual variation in this dataset is close to random,
and the model correctly declines to invent signal that is not there.
