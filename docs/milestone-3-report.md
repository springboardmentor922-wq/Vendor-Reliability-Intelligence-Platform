# Milestone 3 — Vendor Performance, Reliability & Analytics

**Weeks 5 & 6.** Delivered: Vendor Performance monitoring, six-factor
Reliability Scoring, the interactive Analytics Dashboard, the event-driven
Notification System, five Reports with PDF/Excel export, and a predictive
delivery-delay model trained on the DataCo supply chain dataset.

Companion documents: `dataset-guide.md` (how the dataset is used and what the
model predicts) and `workflow-guide.md` (how the application behaves).

---

## Evaluation criteria

| Required outcome | Status |
| --- | --- |
| Vendor Performance Dashboard completed | ✔ `/performance` — six metrics, trends, per-vendor table |
| Reliability Scoring operational | ✔ Six weighted factors → score, risk, rank, trend, recommendation |
| Reports generated successfully | ✔ Five reports, live queries, real PDF/XLSX exports |
| Analytics Dashboard functional | ✔ `/analytics` — five tabs, filters push into SQL |

### Module checklist

**Vendor Performance** — delivery monitoring ✔ · quality evaluation ✔ ·
communication response tracking ✔ · service rating ✔ · performance history ✔ ·
vendor ranking ✔. All six metrics (on-time, delayed, quality, response time,
issue resolution time, order completion rate) computed live.

**Vendor Reliability** — reliability score ✔ · supplier ranking ✔ ·
procurement risk level ✔ · performance trend analysis ✔ · procurement
recommendations ✔. All six factors (delivery history, product quality,
communication efficiency, contract compliance, purchase history, issue
resolution) implemented.

**Dashboard & Analytics** — Procurement dashboard ✔ (overview, active POs,
performance summary, cost analysis, delivery status) · Vendor dashboard ✔
(performance, reliability, contracts, order history, communication) · Admin
dashboard ✔ (user management, vendor analytics, procurement reports,
compliance monitoring, system statistics).

**Notifications** — procurement alerts ✔ · delivery-delay ✔ · vendor approval ✔
· contract expiry ✔ · compliance ✔ · email ✔ · SMS ✔ (both configurable;
disabled by default, dispatch recorded honestly).

**Reports & Export** — vendor performance ✔ · procurement ✔ · purchase order ✔
· compliance ✔ · contract ✔ · PDF ✔ · Excel ✔.

---

## What was built

### Backend

| Component | Purpose |
| --- | --- |
| `ml/dataset.py` | Dataset loading, supplier assignment, feature engineering |
| `ml/train_delay_model.py` | Trains the classifier; chronological split + leakage audit |
| `ml/predictor.py` | Runtime inference, cached, with a transparent fallback |
| `etl/load_dataco.py` | Loads 24 months of trading history into PostgreSQL |
| `services/performance.py` | Performance metrics, aggregated in SQL |
| `services/reliability.py` | Six-factor scoring, risk, ranking, trend, recommendations |
| `services/analytics.py` | Filtered aggregations behind the dashboards |
| `services/reporting.py` | Report datasets + PDF (reportlab) and Excel (openpyxl) |
| `services/notifier.py` | Alert sweep, email/SMS dispatch |
| `api/reliability.py` | 9 endpoints — scores, ranking, risk, predictions, recalculate |
| `api/analytics.py` | 14 endpoints — the three dashboards plus individual slices |
| `api/reports.py` | Report catalogue, generation and export |

Extended: `api/vendor_performance.py` (metrics, trend, summary),
`api/notifications.py` (sweep), `api/dashboard.py` (rewritten to SQL
aggregates plus the Milestone 3 blocks).

**Schema:** `vendor_reliability_scores` (snapshot history),
`delay_predictions`, `report_runs`; notification delivery-channel columns;
purchase-order lane attributes; supporting indexes.

**107 API endpoints** in total.

### Frontend

| Component | Purpose |
| --- | --- |
| `shared/charts/` | Line, bar, donut, radar and gauge — inline SVG, no dependency |
| `features/performance/` | Vendor Performance dashboard |
| `features/analytics/` | Analytics dashboard, five tabs |
| `features/reports/` | Reports & Export |
| `features/vendors/vendor-reliability-panel` | Reliability tab on vendor detail |

Charts are hand-rolled inline SVG rather than a charting library: every chart
here is a simple form, and inline SVG keeps them themeable from the same CSS
variables as the rest of the UI, accessible, and adds no dependency to a
project that had none.

---

## Design decisions worth defending

**Every dashboard figure is aggregated in SQL from the operational tables.**
No analytics store, no cached summaries. A filter changes the query, not the
rendering — the tests assert that filtered results are strictly *smaller*, not
merely different.

**The dashboard was rewritten.** The Milestone 2 version loaded the whole
order book into Python and summed it in a loop — fine against a handful of demo
rows, far too slow at 6,000 orders (753 ms). Now 80–100 ms.

**Factors are scored against operating bands, not theoretical ranges.**
Averaged over hundreds of orders, mean quality ratings converge into a narrow
range; mapping 0–5 onto 0–100 compressed every supplier onto the same few
points. Quality is scored against a 2.0–4.5 acceptance band instead, which is
standard scorecard practice and keeps the factor informative.

**Compliance rates are smoothed toward a prior.** With six checks per vendor,
a raw rate swings 17 points per result and reads 0% or 100% far too easily.

**Missing evidence drops a factor rather than scoring it zero.** The remaining
weights renormalise, so a vendor is never punished for a module it has no
history in.

**Risk combines a backward-looking score with a forward-looking prediction.**
A high predicted delay probability pushes a vendor one band worse. Fewer than
five orders marks the score provisional and blocks a confident `Low`.

**Model honesty.** Chronological split, an automated leakage audit, and the
headline metric reported against both a majority-class baseline *and* the
Bayes-optimal ceiling. See below.

---

## The model, reported honestly

| Metric | Value |
| --- | --- |
| Accuracy on held-out future orders | **0.8008** |
| Majority-class baseline | 0.7662 |
| **Bayes-optimal ceiling for this data** | **0.8009** |
| ROC AUC | 0.7665 |
| Precision / Recall | 0.594 / 0.469 |

The model sits one ten-thousandth below the theoretical maximum. It has
learned essentially everything the dataset contains; the remaining error is
irreducible, because within Second Class the source slip is close to uniformly
distributed across 0–4 days.

Stating this changes how the headline reads. 80% against a 77% baseline looks
like a weak model. 80% against an 80% ceiling is a correctly fitted one — and
it surfaces the real insight: **committed lead time dominates whether a date
is met.** Permutation importance puts `shipping_mode` at 0.207 and every other
feature below 0.002.

The supplier track-record feature contributes almost nothing *here*, because
supplier identity is itself derived from lane affinity and so carries no
information beyond the lane. On real procurement data it would; it is kept for
that reason, and the limitation is documented rather than obscured.

---

## Testing

```
tests/smoke_test.py        110 checks   Milestones 1 & 2
tests/milestone3_test.py   130 checks   Milestone 3
                           ─────────
                           240 passing
```

The Milestone 3 suite verifies arithmetic, not just plumbing:

- on-time + delayed equals delivered, in totals and in every trend month;
- the overall score really is the weighted mean of its scored factors,
  recomputed independently from the returned weights;
- filters *narrow* results — category, date and risk filters each assert a
  strictly smaller result set;
- no outcome column appears in the model's feature list, and the split is
  chronological;
- the predicted label agrees with the probability, and single-order and batch
  predictions agree to four decimal places;
- re-running the alert sweep does not duplicate alerts;
- exports carry real PDF (`%PDF`) and XLSX (`PK`) magic bytes;
- vendor scoping holds: a supplier login cannot widen its analytics by passing
  another vendor's id, and gets `403` on another vendor's reliability;
- five endpoints answer inside the 300 ms target.

### Measured performance

| Endpoint | Response |
| --- | --- |
| `/dashboard/overview` | 80 ms |
| `/analytics/procurement` | 107 ms |
| `/reliability/ranking` | 27 ms |
| `/vendor-performance/metrics` | 51 ms |
| `/analytics/trend` | 30 ms |

Against the project's 300 ms API target and 2 s dashboard target. Report
exports of 5,000 rows take 2–5 s, which is inherent to generating a file and
is not on the interactive path.

---

## Data position after loading

| | |
| --- | --- |
| Vendors | 25 across six categories |
| Purchase orders | ~6,000 over 24 months |
| Performance evaluations | ~5,600 |
| Invoices | ~4,300 |
| Contracts | 24 — 14 active, 5 expiring, 5 expired |
| Reliability snapshots | ~310 (13 dates per vendor) |
| Committed spend | ~$17.9M, −0.9% against budget |
| On-time rate | 76.3% |
| Risk spread | 11 Low · 7 Medium · 5 High · 1 Critical |

The spread across suppliers is 59%–90% on time, which is what gives the
reliability engine, the ranking and the risk bands something real to separate.

---

## Known limitations

**Quality is a weak discriminator in this dataset.** It is derived from profit
ratio, which is largely independent of the lane that drives supplier
assignment, so mean ratings cluster at 3.4–3.6. The acceptance-band rescale
keeps the factor useful, but it carries less signal than delivery does.

**Communication timings rest on a modelling assumption** — that a supplier
which misses delivery dates is also slower to respond. The dataset has no
message log. The timings are written as real message rows and measured back
from timestamps, but the correlation is assumed, not observed.

**Risk thresholds are calibrated to this supplier base.** As any scorecard's
are. They are configurable in `.env` and would need recalibrating against a
different population.

**Email and SMS are wired but disabled.** With no credentials configured the
alert is raised in-app and the payload logged; `email_sent` stays `false`
rather than claiming a delivery that did not happen.

---

## Carried into Milestone 4

Docker and Docker Compose, cloud deployment with Nginx, concurrent-user load
testing, and the consolidated project documentation.
