# Workflow Guide — how the platform works

How the application behaves screen by screen, what each role can do, and the
end-to-end flow to walk through in a demonstration.

---

## 1. Starting it up

Three processes: PostgreSQL, the FastAPI backend, the Angular frontend.

```bash
# backend  →  http://127.0.0.1:8000   (API docs at /docs)
cd backend
venv\Scripts\activate
python -m uvicorn main:app --reload --port 8000

# frontend →  http://localhost:4200
cd frontend
npx ng serve
```

First run only — see `docs/dataset-guide.md` §6 for the full sequence:

```bash
python seed.py                              # schema + demo users/vendors
python -m ml.train_delay_model              # train the delay model
python -m etl.load_dataco                   # 24 months of trading history
python -m services.reliability --backfill 12  # score vendors + history
python -m services.notifier                 # derive alerts
```

Every demo account uses the password **`VendorIQ@2026`**. The login page lists
them as click-to-fill chips.

| Role | Email |
| --- | --- |
| Administrator | `admin@vendoriq.com` |
| Procurement Manager | `procurement@vendoriq.com` |
| Supply Chain Manager | `supplychain@vendoriq.com` |
| Finance Officer | `finance@vendoriq.com` |
| Auditor | `auditor@vendoriq.com` |
| Vendor | `northwind@vendor.vendoriq.com` |

Every vendor has a portal login (`<firstword>@vendor.vendoriq.com`).

---

## 2. What each role sees

Authentication answers *who are you*; authorisation answers *what may you
see and do*. Both are enforced **server-side** — the UI hides what you cannot
use, and the API refuses it regardless.

| Capability | Admin | Procurement | Supply Chain | Finance | Auditor | Vendor |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| View vendors / orders / contracts | ✔ | ✔ | ✔ | ✔ | ✔ | own only |
| Register & edit vendors | ✔ | ✔ | ✔ | — | — | — |
| Approve / reject / suspend vendors | ✔ | ✔ | — | — | — | — |
| Raise & approve procurement requests | ✔ | ✔ | raise only | — | — | — |
| Raise purchase orders, change status | ✔ | ✔ | ✔ | — | — | — |
| Record & settle invoices | ✔ | — | — | ✔ | — | — |
| Contracts & compliance | ✔ | ✔ | ✔¹ | — | — | — |
| **Performance dashboard** | ✔ | ✔ | ✔ | ✔ | ✔ | own only |
| **Analytics dashboard** | ✔ | ✔ | ✔ | ✔ | ✔ | own only |
| **Recalculate reliability scores** | ✔ | ✔ | ✔ | — | — | — |
| **Run the alert sweep** | ✔ | ✔ | ✔ | — | — | — |
| **Reports & exports** | ✔ | ✔ | ✔ | ✔ | ✔ | own only |
| **Administration tab** | ✔ | — | — | — | — | — |
| Manage user accounts | ✔ | — | — | — | — | — |

¹ Supply Chain Managers create contracts and record compliance checks;
renewal and termination are restricted to Admin and Procurement.

**Vendor scoping.** A supplier login is pinned to its own `vendor_id` on the
server. Passing another vendor's id to an analytics endpoint does not widen
the result — the filter is overwritten before the query runs, and reading
another vendor's reliability returns `403`.

---

## 3. The screens

### Dashboard — `/dashboard`
Role-aware landing page. Ten headline cards (vendors, approvals, active POs,
pending requests, spend, on-time rate, average reliability, outstanding
invoices, expiring contracts, open conversations), distribution charts,
reliability leaders, at-risk vendors and the activity feed.

### Vendors — `/vendors`, `/vendors/:id`
Registration, profiles, categorisation, approval workflow, status monitoring
and contacts. The detail screen opens on a **Reliability** tab: score gauge,
six-factor radar, factor bars with their weights, the score history chart and
the procurement recommendation.

### Procurement & Purchase Orders — `/procurement`, `/purchase-orders`
Requests, approval workflow, vendor assignment, order tracking and invoices.
Status transitions are enforced server-side:

```
Pending → Approved → Ordered → Delivered → Completed
        ↘ Cancelled (from any pre-delivery state)
```

Raising a PO moves its request to `Ordered`; completing the PO completes the
request. Illegal jumps are rejected.

### Contracts — `/contracts`
Repository, renewal tracking, compliance monitoring, certifications and
expiry alerts. Status is date-driven: `Active` flips to `Expiring` inside the
renewal notice window and `Expired` past the expiry date. A failed compliance
check flips the contract to `Non-Compliant` and alerts procurement and audit.

### Performance — `/performance`
The Vendor Performance module. Eight metric cards covering the six required
metrics, three trend charts, the reliability gauge and radar for the selected
vendor, the recommendation, an on-time-rate bar chart and a per-vendor table.

Filters: vendor, category, date range, trend window. **Changing any of them
re-queries the backend** — nothing is filtered in the browser.

### Analytics — `/analytics`
Four tabs (five for an Administrator) over one shared filter set:

- **Procurement** — requests, active POs, procurement value, on-time delivery,
  performance score, issue resolution, outstanding invoices; spend and volume
  trends; delivery and status donuts; cost by category and by vendor;
  on-time rate by category; budget vs actual.
- **Vendor risk** — risk distribution donut, reliability bars, the
  "vendors needing attention" table with the reason and the action, and the
  full supplier ranking with its factor columns.
- **Delay predictions** — the model card (accuracy, baseline, AUC, precision/
  recall, what it predicts, how it was validated) and every open order scored,
  with a plain-language explanation per order.
- **Vendor view** — order history, delivery rate, communication activity,
  contract status and the reliability breakdown for the selected vendor.
- **Administration** (Admin only) — users by role, vendor analytics,
  compliance monitoring and system statistics.

**Interactivity.** Selecting a vendor, category, risk level or date range
re-runs the queries. Clicking a bar in *Cost by category* or a band in the
*risk* donut applies that value as a filter across every tab; clicking it
again clears it. Two buttons act on real data: **Recalculate scores** reruns
the scoring engine, **Run alert sweep** re-derives every notification.

### Reports — `/reports`
Five reports — Vendor Performance, Procurement, Purchase Order, Compliance,
Contract. Pick one, set filters, **Generate** runs the query and returns the
dataset; the preview shows a summary block and the table. **Export PDF** and
**Export Excel** re-run the same query and stream a real file, so the export
always matches what was previewed. Each run is recorded in `report_runs`.

### Notifications — `/notifications`
Procurement alerts, delivery-delay notifications, vendor approvals, contract
expiry, compliance and predictive delivery-risk alerts. Every alert is derived
from a real event and links to the record that caused it.

---

## 4. How the intelligence is computed

### Vendor performance
Aggregated in SQL from purchase orders, evaluations, message threads and
compliance checks. On-time and delayed deliveries come from
`actual_delivery` vs `expected_delivery`; **response time is measured from the
gap between an internal message and the supplier's reply**, not read from a
stored column.

### Reliability score
Six factors, each normalised to 0–100, combined by configurable weights:

| Factor | Weight | Built from |
| --- | :-: | --- |
| Delivery History | 0.30 | On-time rate, less penalties for delay severity and anything overdue now |
| Product Quality | 0.20 | Mean quality rating, rescaled onto the 2.0–4.5 acceptance band |
| Communication Efficiency | 0.15 | Measured response time + thread resolution rate |
| Contract Compliance | 0.15 | Check results (smoothed), contract state, certificate validity |
| Purchase History | 0.10 | Order count, spend depth, completion rate, less cancellations |
| Issue Resolution | 0.10 | Time to close issues + how many get closed |

A factor with no evidence is **dropped and the remaining weights
renormalised**, so a vendor is never punished for a module it has no history
in. Compliance rates are smoothed toward a prior, so a handful of checks
cannot produce a 0% or 100% verdict.

### Risk level
The score maps onto a band via configurable thresholds (73 / 65 / 55), then
gets two adjustments the score alone cannot express:

- a **high model-predicted delay probability** pushes a vendor one band worse
  — the score looks backwards, the prediction looks forwards;
- fewer than five orders marks the score **provisional** and prevents a
  confident `Low`.

Thresholds are calibrated against the supplier base, as any scorecard is, and
are overridable in `.env`.

### Trend
Compares the last three months' on-time rate with the prior three:
≥ +3pp `Improving`, ≤ −3pp `Declining`, otherwise `Stable`.

### Recommendation
Generated from the factor scores — names the specific weak factors, quotes the
delivery record, flags overdue orders and a declining trend, and states what
to do (expand sourcing / monitor / restrict to non-critical / do not award).

### History
Each recalculation writes one snapshot per vendor per day. The `--backfill`
option reconstructs past snapshots using **only the data that existed on each
date**, so the curve shows what the score would genuinely have read at the
time rather than projecting today's answer backwards.

---

## 5. The end-to-end demonstration

The full intelligence workflow the milestone asks for:

**1. Sign in** as Procurement Manager. Note the dashboard cards and the
at-risk vendors panel.

**2. Select a vendor** — Performance → pick *Ironclad Maintenance Co.*
(a High-risk supplier).

**3. View historical performance** — its on-time rate, delay distribution and
12-month trend.

**4. Calculate reliability** — Vendors → Ironclad → Reliability tab. Score
55.9 from the six factors, with the radar showing which are dented.

**5. Determine risk** — `High`, with the rank and the reasons visible.

**6. Visualise** — Analytics → Vendor risk. Click **High** in the donut; every
tab narrows to high-risk suppliers.

**7. Generate recommendations** — the recommendation panel names the weakest
factors and the action to take.

**8. Trigger notifications** — Analytics → **Run alert sweep**. Alerts are
re-derived from current data; open Notifications to see delivery delays,
contract expiries, compliance failures and predicted delays, each linking to
its record.

**9. Generate a report** — Reports → Vendor Performance → **Generate** →
**Export PDF** / **Export Excel**.

**10. Switch roles** — sign in as the Vendor and confirm only its own data is
visible; as the Administrator to see the Administration tab; as the Auditor to
confirm recalculation and the sweep are refused.

### The Milestone 2 business flow still holds

Create vendor → approve vendor → create procurement request → approve →
assign vendor → raise purchase order → approve → track through
Ordered/Delivered/Completed → manage contract → message the vendor. Each state
change is recorded, and the new order immediately affects that vendor's
metrics on the next recalculation.

---

## 6. Verifying it

```bash
# with the API running on port 8000
python tests/smoke_test.py        # 110 checks — Milestones 1 & 2
python tests/milestone3_test.py   # 130 checks — Milestone 3
```

The Milestone 3 suite checks the arithmetic, not just the plumbing: that
on-time + delayed equals delivered, that the overall score really is the
weighted mean of its factors, that filters *narrow* results rather than
re-render them, that no outcome column reaches the model, that the sweep does
not duplicate alerts, that exports are real PDF/XLSX files, and that the key
endpoints answer inside the 300 ms target.

Both suites derive their expectations from live data rather than fixed seed
totals, so they are safe to re-run after reloading the dataset.

---

## 7. Configuration

`backend/.env` — the settings worth knowing:

| Setting | Default | Effect |
| --- | --- | --- |
| `WEIGHT_DELIVERY` … `WEIGHT_ISSUE_RESOLUTION` | 0.30 … 0.10 | Reliability factor weights |
| `RISK_THRESHOLD_LOW` / `_MEDIUM` / `_HIGH` | 73 / 65 / 55 | Score → risk band |
| `RELIABILITY_MIN_ORDERS` | 5 | Below this a score is provisional |
| `DELIVERY_GRACE_DAYS` | 0 | Tolerance on the committed date |
| `DELAY_RISK_MEDIUM` / `_HIGH` | 0.30 / 0.55 | Prediction → risk band |
| `CONTRACT_EXPIRY_ALERT_DAYS` | 30 | Renewal notice window |
| `CERTIFICATION_ALERT_DAYS` | 60 | Certificate expiry window |
| `EMAIL_ENABLED`, `SMTP_*` | off | SMTP delivery for alerts |
| `SMS_ENABLED`, `TWILIO_*` | off | SMS delivery for alerts |

With email and SMS disabled the alert is still raised in-app and the payload
is logged, so the flow is demonstrable without a mail server — and
`email_sent` stays `false`, so nothing claims a delivery that did not happen.
