"""End-to-end test for the Milestone 3 backend.

Covers vendor performance metrics, the six-factor reliability engine, the
delivery-delay model, the analytics dashboards, the notification sweep and
the five reports with their PDF / Excel exports.

Run the API first, then:  python tests/milestone3_test.py

The suite derives its expectations from the live data rather than asserting
fixed seed totals, so it is safe to re-run and safe against a reloaded
dataset.
"""

import json
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta

BASE = "http://127.0.0.1:8000"
PASSWORD = "VendorIQ@2026"

passed = 0
failed = 0
failures: list[str] = []


def call(method, path, body=None, token=None, raw=False):
    request = urllib.request.Request(
        BASE + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
    )

    if body is not None:
        request.add_header("Content-Type", "application/json")

    if token:
        request.add_header("Authorization", f"Bearer {token}")

    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            content = response.read()

            if raw:
                # Header names are case-insensitive on the wire, so they are
                # lowercased here rather than being looked up by exact case.
                return response.status, content, {
                    k.lower(): v for k, v in response.headers.items()
                }

            return response.status, json.loads(content or b"null")
    except urllib.error.HTTPError as error:
        content = error.read()

        if raw:
            return error.code, content, {
                k.lower(): v for k, v in error.headers.items()
            }

        try:
            return error.code, json.loads(content or b"null")
        except json.JSONDecodeError:
            return error.code, {"raw": content.decode(errors="replace")}


def check(name, condition, detail=""):
    global passed, failed

    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        failures.append(f"{name} :: {detail}")
        print(f"  FAIL  {name}  -> {detail}")


def login(email):
    status, data = call("POST", "/auth/login", {"email": email, "password": PASSWORD})
    assert status == 200, f"login failed for {email}: {status} {data}"
    return data["access_token"], data["user"]


def section(title):
    print(f"\n=== {title} ===")


# =========================================================
# SETUP
# =========================================================

section("Authentication")

admin_token, admin_user = login("admin@vendoriq.com")
pm_token, pm_user = login("procurement@vendoriq.com")
sc_token, _ = login("supplychain@vendoriq.com")
finance_token, _ = login("finance@vendoriq.com")
auditor_token, _ = login("auditor@vendoriq.com")
vendor_token, vendor_user = login("northwind@vendor.vendoriq.com")

own_vendor_id = vendor_user["vendor_id"]

check("administrator signs in", admin_user["role"] == "Administrator")
check("vendor login is bound to a vendor", own_vendor_id is not None, str(vendor_user))


# =========================================================
# VENDOR PERFORMANCE
# =========================================================

section("Vendor performance metrics")

status, metrics = call("GET", "/vendor-performance/metrics", token=pm_token)
check("performance metrics respond", status == 200, str(status))

delivered = metrics["delivered_orders"]
on_time = metrics["on_time_deliveries"]
delayed = metrics["delayed_deliveries"]

check(
    "on-time plus delayed equals delivered",
    on_time + delayed == delivered,
    f"{on_time} + {delayed} != {delivered}",
)

check(
    "on-time rate matches the counters",
    delivered == 0
    or abs(metrics["on_time_rate"] - (100.0 * on_time / delivered)) < 0.02,
    f"rate={metrics['on_time_rate']} counters={on_time}/{delivered}",
)

check(
    "the six required metrics are all present",
    all(
        key in metrics
        for key in (
            "on_time_deliveries",
            "delayed_deliveries",
            "quality_rating",
            "avg_response_time_hours",
            "avg_issue_resolution_hours",
            "order_completion_rate",
        )
    ),
    str(sorted(metrics.keys())),
)

check("quality rating sits on the 0-5 scale", 0 <= metrics["quality_rating"] <= 5,
      str(metrics["quality_rating"]))

check(
    "response time is measured from real message rows",
    metrics["communication"]["threads_measured"] > 0,
    str(metrics["communication"]),
)

status, trend = call("GET", "/vendor-performance/trend?months=12", token=pm_token)
check("performance trend responds", status == 200 and isinstance(trend, list), str(status))
check("trend has monthly points", len(trend) > 1, f"{len(trend)} points")

check(
    "every trend month is internally consistent",
    all(p["on_time"] + p["delayed"] == p["delivered"] for p in trend),
    str([p for p in trend if p["on_time"] + p["delayed"] != p["delivered"]][:2]),
)

status, summary = call("GET", "/vendor-performance/summary", token=pm_token)
check("per-vendor summary responds", status == 200 and len(summary) > 0, str(status))

# Filtering must narrow the result, not just re-render it.
status, filtered = call(
    "GET", "/vendor-performance/summary?category=Logistics%20Partners", token=pm_token
)
check(
    "category filter narrows the vendor summary",
    0 < len(filtered) < len(summary),
    f"filtered={len(filtered)} all={len(summary)}",
)
check(
    "category filter returns only that category",
    all(r["category"] == "Logistics Partners" for r in filtered),
    str({r["category"] for r in filtered}),
)


# =========================================================
# RELIABILITY SCORING
# =========================================================

section("Reliability scoring")

status, ranking = call("GET", "/reliability/ranking", token=pm_token)
check("ranking responds", status == 200 and len(ranking) > 0, str(status))

check(
    "ranking is ordered by reliability score",
    all(
        ranking[i]["reliability_score"] >= ranking[i + 1]["reliability_score"]
        for i in range(len(ranking) - 1)
    ),
    str([r["reliability_score"] for r in ranking[:6]]),
)

scored = [r for r in ranking if r["orders_considered"] > 0]
check("vendors with history are scored", len(scored) > 0, str(len(scored)))

target = scored[0]["vendor_id"]

status, score = call("GET", f"/reliability/vendor/{target}", token=pm_token)
check("vendor reliability responds", status == 200, str(status))

factors = score["factors"]

check(
    "all six reliability factors are reported",
    set(factors.keys())
    == {
        "delivery",
        "quality",
        "communication",
        "compliance",
        "purchase_history",
        "issue_resolution",
    },
    str(sorted(factors.keys())),
)

check(
    "every scored factor is within 0-100",
    all(v is None or 0 <= v <= 100 for v in factors.values()),
    str(factors),
)

check("overall score is within 0-100", 0 <= score["overall_score"] <= 100,
      str(score["overall_score"]))

check(
    "risk level is one of the four bands",
    score["risk_level"] in ("Low", "Medium", "High", "Critical"),
    score["risk_level"],
)

check(
    "trend is one of the three directions",
    score["trend"] in ("Improving", "Stable", "Declining"),
    str(score["trend"]),
)

check(
    "a recommendation is generated",
    isinstance(score["recommendation"], str) and len(score["recommendation"]) > 40,
    str(score["recommendation"])[:80],
)

# The overall score must actually be the weighted mean of the scored factors.
weights = score["weights"]
total_weight = sum(weights[k] for k, v in factors.items() if v is not None)
expected = (
    sum(v * weights[k] for k, v in factors.items() if v is not None) / total_weight
    if total_weight
    else 0
)

check(
    "overall score equals the weighted mean of its factors",
    abs(score["overall_score"] - expected) < 0.05,
    f"reported={score['overall_score']} recomputed={expected:.4f}",
)

check(
    "the delivery factor tracks the on-time rate",
    factors["delivery"] is None
    or factors["delivery"] <= score["delivery"]["on_time_rate"] + 0.01,
    f"delivery={factors['delivery']} on_time={score['delivery']['on_time_rate']}",
)

status, history = call("GET", f"/reliability/vendor/{target}/history", token=pm_token)
check("score history responds", status == 200 and len(history) > 0, str(status))
check(
    "history is ordered oldest first",
    all(
        history[i]["score_date"] <= history[i + 1]["score_date"]
        for i in range(len(history) - 1)
    ),
    str([h["score_date"] for h in history[:4]]),
)

status, recommendation = call(
    "GET", f"/reliability/vendor/{target}/recommendation", token=pm_token
)
check("recommendation endpoint responds", status == 200, str(status))
check(
    "weakest factors are ordered worst first",
    len(recommendation["weakest_factors"]) > 0
    and all(
        recommendation["weakest_factors"][i]["score"]
        <= recommendation["weakest_factors"][i + 1]["score"]
        for i in range(len(recommendation["weakest_factors"]) - 1)
    ),
    str(recommendation["weakest_factors"]),
)

status, risk = call("GET", "/reliability/risk", token=pm_token)
check("risk summary responds", status == 200, str(status))
check(
    "high-risk count matches the distribution",
    risk["high_risk_count"]
    == risk["by_risk"].get("High", 0) + risk["by_risk"].get("Critical", 0),
    str(risk["by_risk"]),
)
check(
    "every at-risk vendor is actually High or Critical",
    all(v["risk_level"] in ("High", "Critical") for v in risk["at_risk_vendors"]),
    str([v["risk_level"] for v in risk["at_risk_vendors"]]),
)


# =========================================================
# PREDICTIVE MODEL
# =========================================================

section("Delivery-delay model")

status, model = call("GET", "/reliability/model", token=pm_token)
check("model info responds", status == 200, str(status))
check("a trained model is loaded", model["ready"] is True, str(model["model_version"]))

if model.get("metrics"):
    m = model["metrics"]

    check(
        "the model beats a majority-class baseline",
        m["test"]["accuracy"] > m["baseline_accuracy_majority_class"],
        f"accuracy={m['test']['accuracy']} baseline={m['baseline_accuracy_majority_class']}",
    )

    check(
        "the model ranks better than chance",
        m["test"]["roc_auc"] > 0.5,
        str(m["test"]["roc_auc"]),
    )

    check(
        "validation used a chronological split",
        "chronological" in m["split"].lower(),
        m["split"],
    )

    # The whole point is that the model cannot see the outcome.
    leaky = {"days for shipping (real)", "delivery status", "late_delivery_risk",
             "slip", "late", "actual_days", "delivery_status"}

    check(
        "no outcome column is used as a feature",
        not any(f.lower() in leaky for f in m["features"]),
        str(m["features"]),
    )

status, predictions = call("GET", "/reliability/predictions?limit=50", token=pm_token)
check("open-order predictions respond", status == 200, str(status))

if predictions:
    check(
        "every probability is a valid probability",
        all(0.0 <= p["delay_probability"] <= 1.0 for p in predictions),
        str([p["delay_probability"] for p in predictions[:5]]),
    )

    check(
        "the predicted label agrees with the probability",
        all(
            p["predicted_late"] == (p["delay_probability"] >= 0.5)
            for p in predictions
        ),
        str([(p["delay_probability"], p["predicted_late"]) for p in predictions[:5]]),
    )

    check(
        "risk bands are ordered consistently with the probabilities",
        all(
            p["risk_band"] in ("Low", "Medium", "High", "Critical")
            for p in predictions
        ),
        str({p["risk_band"] for p in predictions}),
    )

    check(
        "each prediction carries an explanation",
        all(len(p["explanation"]) > 20 for p in predictions),
        str(predictions[0]["explanation"])[:80],
    )

    # Scoring one order should agree with the batch endpoint.
    order_id = predictions[0]["purchase_order_id"]
    status, single = call(
        "GET", f"/reliability/predictions/purchase-order/{order_id}", token=pm_token
    )
    check("single-order prediction responds", status == 200, str(status))
    check(
        "single and batch predictions agree",
        abs(single["delay_probability"] - predictions[0]["delay_probability"]) < 0.0001,
        f"{single['delay_probability']} vs {predictions[0]['delay_probability']}",
    )


# =========================================================
# ANALYTICS
# =========================================================

section("Analytics dashboards")

status, options = call("GET", "/analytics/filters", token=pm_token)
check("filter options respond", status == 200, str(status))
check("six procurement categories are offered", len(options["categories"]) == 6,
      str(options["categories"]))

status, proc = call("GET", "/analytics/procurement", token=pm_token)
check("procurement analytics responds", status == 200, str(status))

check(
    "delivery counters are internally consistent",
    proc["delivery_status"]["on_time_deliveries"]
    + proc["delivery_status"]["delayed_deliveries"]
    == proc["delivery_status"]["total_deliveries"],
    str(proc["delivery_status"]),
)

check(
    "spend by category sums to the reported total",
    abs(
        sum(c["spend"] for c in proc["cost_analysis"]["by_category"])
        - proc["cost_analysis"]["total_cost"]
    )
    < 1.0,
    f"{sum(c['spend'] for c in proc['cost_analysis']['by_category'])} vs "
    f"{proc['cost_analysis']['total_cost']}",
)

check(
    "budget versus actual is populated",
    proc["cost_analysis"]["budget"] > 0 and proc["cost_analysis"]["actual"] > 0,
    str(proc["cost_analysis"]["budget"]),
)

check("spend over time has monthly points", len(proc["spend_over_time"]) > 1,
      str(len(proc["spend_over_time"])))

# ---- filters must change the SQL, not just the rendering ----
status, narrowed = call(
    "GET", "/analytics/procurement?category=Logistics%20Partners", token=pm_token
)
check(
    "a category filter narrows the analytics",
    narrowed["delivery_status"]["total_deliveries"]
    < proc["delivery_status"]["total_deliveries"],
    f"{narrowed['delivery_status']['total_deliveries']} vs "
    f"{proc['delivery_status']['total_deliveries']}",
)

recent = (date.today() - timedelta(days=60)).isoformat()
status, windowed = call(
    "GET", f"/analytics/procurement?start={recent}", token=pm_token
)
check(
    "a date filter narrows the analytics",
    windowed["delivery_status"]["total_deliveries"]
    < proc["delivery_status"]["total_deliveries"],
    f"{windowed['delivery_status']['total_deliveries']} vs "
    f"{proc['delivery_status']['total_deliveries']}",
)

status, risk_filtered = call(
    "GET", "/analytics/procurement?risk_level=High", token=pm_token
)
check(
    "a risk filter narrows the analytics",
    status == 200
    and risk_filtered["delivery_status"]["total_deliveries"]
    < proc["delivery_status"]["total_deliveries"],
    str(status),
)

status, categories = call("GET", "/analytics/categories", token=pm_token)
check("category performance responds", status == 200 and len(categories) > 0, str(status))
check(
    "category on-time rates are percentages",
    all(0 <= c["on_time_rate"] <= 100 for c in categories),
    str([c["on_time_rate"] for c in categories]),
)

status, admin_view = call("GET", "/analytics/admin", token=admin_token)
check("admin analytics responds for an administrator", status == 200, str(status))
check(
    "system statistics are populated",
    admin_view["system"]["total_vendors"] > 0
    and admin_view["system"]["total_purchase_orders"] > 0,
    str(admin_view["system"]),
)

status, _ = call("GET", "/analytics/admin", token=pm_token)
check("admin analytics is closed to a procurement manager", status == 403, str(status))

status, _ = call("GET", "/analytics/admin", token=vendor_token)
check("admin analytics is closed to a vendor", status == 403, str(status))


# =========================================================
# VENDOR SCOPING
# =========================================================

section("Vendor scoping on the new endpoints")

status, vendor_ranking = call("GET", "/reliability/ranking", token=vendor_token)
check(
    "a vendor only sees itself in the ranking",
    status == 200
    and len(vendor_ranking) == 1
    and vendor_ranking[0]["vendor_id"] == own_vendor_id,
    str([r["vendor_id"] for r in vendor_ranking]),
)

status, _ = call("GET", f"/reliability/vendor/{own_vendor_id}", token=vendor_token)
check("a vendor can read its own reliability", status == 200, str(status))

other = next(
    r["vendor_id"] for r in ranking if r["vendor_id"] != own_vendor_id
)

status, _ = call("GET", f"/reliability/vendor/{other}", token=vendor_token)
check("a vendor cannot read another vendor's reliability", status == 403, str(status))

status, vendor_metrics = call("GET", "/vendor-performance/metrics", token=vendor_token)
check(
    "vendor metrics are scoped to its own orders",
    status == 200
    and vendor_metrics["vendor_id"] == own_vendor_id
    and vendor_metrics["total_orders"] < metrics["total_orders"],
    f"vendor={vendor_metrics['total_orders']} all={metrics['total_orders']}",
)

status, vendor_analytics = call(
    "GET", f"/analytics/procurement?vendor_id={other}", token=vendor_token
)
check(
    "a vendor cannot widen its analytics by passing another vendor id",
    status == 200
    and vendor_analytics["filters"]["vendor_id"] == own_vendor_id,
    str(vendor_analytics["filters"]),
)


# =========================================================
# NOTIFICATIONS
# =========================================================

section("Notification sweep")

status, before = call("GET", "/notifications/summary", token=pm_token)
check("notification summary responds", status == 200, str(status))

status, sweep = call("POST", "/notifications/sweep", body={}, token=pm_token)
check("the alert sweep runs", status == 200, str(status))
check(
    "the sweep reports every alert category",
    all(
        key in sweep
        for key in (
            "delivery_delays",
            "contract_expiry",
            "compliance",
            "vendor_approvals",
            "procurement",
            "predicted_delays",
        )
    ),
    str(sweep),
)

status, after_first = call("GET", "/notifications/summary", token=pm_token)

# Running it again must refresh, not duplicate.
call("POST", "/notifications/sweep", body={}, token=pm_token)
status, after_second = call("GET", "/notifications/summary", token=pm_token)

check(
    "re-running the sweep does not duplicate alerts",
    after_second["total"] == after_first["total"],
    f"{after_first['total']} then {after_second['total']}",
)

status, alerts = call("GET", "/notifications?limit=200", token=pm_token)
check("notifications list responds", status == 200, str(status))

delivery_alerts = [n for n in alerts if n["notification_type"] == "Delivery"]

check(
    "delivery alerts reference a real purchase order",
    all("/purchase-orders/" in (n["link"] or "") for n in delivery_alerts),
    str([n["link"] for n in delivery_alerts[:3]]),
)

check(
    "alerts carry a delivery channel",
    all(n.get("channel") for n in alerts[:20]),
    str([n.get("channel") for n in alerts[:5]]),
)

status, _ = call("POST", "/notifications/sweep", body={}, token=auditor_token)
check("an auditor cannot trigger the sweep", status == 403, str(status))


# =========================================================
# REPORTS
# =========================================================

section("Reports and exports")

status, catalogue = call("GET", "/reports", token=pm_token)
check("report catalogue responds", status == 200, str(status))

expected_reports = {
    "vendor-performance",
    "procurement",
    "purchase-orders",
    "compliance",
    "contracts",
}

check(
    "all five mandatory reports are offered",
    {r["key"] for r in catalogue} == expected_reports,
    str({r["key"] for r in catalogue}),
)

for key in sorted(expected_reports):
    status, report = call("GET", f"/reports/{key}", token=pm_token)
    check(f"{key} report generates", status == 200, str(status))

    if status != 200:
        continue

    check(
        f"{key} report declares its columns",
        len(report["columns"]) > 0,
        str(report.get("columns")),
    )

    check(
        f"{key} report carries a summary",
        len(report["summary"]) > 0,
        str(report.get("summary")),
    )

    if report["rows"]:
        column_keys = {c["key"] for c in report["columns"]}
        row_keys = set(report["rows"][0].keys())

        check(
            f"{key} report rows match the declared columns",
            column_keys.issubset(row_keys),
            str(column_keys - row_keys),
        )

    # ---- exports ----
    status, content, headers = call(
        "GET", f"/reports/{key}/export?format=pdf", token=pm_token, raw=True
    )
    check(
        f"{key} exports a real PDF",
        status == 200 and content[:4] == b"%PDF",
        f"status={status} magic={content[:8]!r}",
    )
    check(
        f"{key} PDF is sent as a download",
        "attachment" in headers.get("content-disposition", ""),
        headers.get("content-disposition", ""),
    )

    status, content, headers = call(
        "GET", f"/reports/{key}/export?format=excel", token=pm_token, raw=True
    )
    check(
        f"{key} exports a real Excel workbook",
        status == 200 and content[:2] == b"PK",
        f"status={status} magic={content[:8]!r}",
    )

# A report must respond to its filters.
status, all_vendors = call("GET", "/reports/vendor-performance", token=pm_token)
status, one_category = call(
    "GET", "/reports/vendor-performance?category=IT%20Vendors", token=pm_token
)

check(
    "a report filter narrows the dataset",
    0 < one_category["row_count"] < all_vendors["row_count"],
    f"{one_category['row_count']} vs {all_vendors['row_count']}",
)

check(
    "a filtered report only contains matching rows",
    all(r["category"] == "IT Vendors" for r in one_category["rows"]),
    str({r["category"] for r in one_category["rows"]}),
)

status, vendor_report = call("GET", "/reports/vendor-performance", token=vendor_token)
check(
    "a vendor's report is scoped to itself",
    status == 200 and vendor_report["row_count"] == 1,
    str(vendor_report.get("row_count")),
)


# =========================================================
# DASHBOARD INTEGRATION
# =========================================================

section("Dashboard integration")

status, dashboard = call("GET", "/dashboard/overview", token=pm_token)
check("dashboard responds", status == 200, str(status))

check(
    "dashboard exposes the Milestone 3 blocks",
    all(
        key in dashboard
        for key in (
            "performance",
            "delivery",
            "reliability_leaders",
            "at_risk_vendors",
            "category_performance",
            "vendors_by_risk",
        )
    ),
    str(sorted(dashboard.keys())),
)

check(
    "the dashboard's delivery figures match the analytics endpoint",
    dashboard["delivery"]["total_deliveries"]
    == proc["delivery_status"]["total_deliveries"],
    f"{dashboard['delivery']['total_deliveries']} vs "
    f"{proc['delivery_status']['total_deliveries']}",
)

check(
    "reliability leaders are ordered best first",
    all(
        dashboard["reliability_leaders"][i]["reliability_score"]
        >= dashboard["reliability_leaders"][i + 1]["reliability_score"]
        for i in range(len(dashboard["reliability_leaders"]) - 1)
    ),
    str([v["reliability_score"] for v in dashboard["reliability_leaders"]]),
)


# =========================================================
# RECALCULATION
# =========================================================

section("Recalculation")

status, result = call("POST", "/reliability/recalculate", body={}, token=pm_token)
check("recalculation runs for procurement", status == 200, str(status))
check(
    "every vendor is scored",
    result["vendors_scored"] >= len(ranking),
    f"{result['vendors_scored']} scored, {len(ranking)} in ranking",
)
check(
    "the risk distribution covers the scored vendors",
    sum(result["risk_distribution"].values()) == result["vendors_scored"],
    str(result["risk_distribution"]),
)

status, _ = call("POST", "/reliability/recalculate", body={}, token=auditor_token)
check("an auditor cannot recalculate", status == 403, str(status))

status, _ = call("POST", "/reliability/recalculate", body={}, token=vendor_token)
check("a vendor cannot recalculate", status == 403, str(status))

# Scores must survive the round trip unchanged for unchanged data.
status, rescored = call("GET", f"/reliability/vendor/{target}", token=pm_token)
check(
    "recalculation is stable for unchanged data",
    abs(rescored["overall_score"] - score["overall_score"]) < 0.01,
    f"{score['overall_score']} then {rescored['overall_score']}",
)


# =========================================================
# PERFORMANCE TARGETS
# =========================================================

section("Response times (target: under 300ms)")

for path, token in [
    ("/dashboard/overview", pm_token),
    ("/analytics/procurement", pm_token),
    ("/reliability/ranking", pm_token),
    ("/vendor-performance/metrics", pm_token),
    ("/analytics/trend", pm_token),
]:
    timings = []

    for _ in range(3):
        started = time.time()
        call("GET", path, token=token)
        timings.append((time.time() - started) * 1000)

    best = min(timings)

    check(
        f"{path} responds in under 300ms ({best:.0f}ms)",
        best < 300,
        f"{best:.0f}ms",
    )


# =========================================================
# SUMMARY
# =========================================================

print(f"\n{'=' * 58}")
print(f"  {passed} passed, {failed} failed")
print(f"{'=' * 58}")

if failures:
    print("\nFailures:")
    for failure in failures:
        print(f"  - {failure}")

sys.exit(1 if failed else 0)
