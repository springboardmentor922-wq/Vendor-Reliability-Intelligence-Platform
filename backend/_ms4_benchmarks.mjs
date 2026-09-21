// Milestone 4: Performance & Latency Benchmark Test Suite
// Measures response times against SLA (< 300ms) and tests concurrent request handling

const API_BASE = "http://127.0.0.1:8001";

let passed = 0;
let failed = 0;
const benchmarkResults = [];

function check(title, condition, extra = "") {
    if (condition) {
        console.log(`  PASS: ${title} ${extra}`);
        passed++;
    } else {
        console.error(`  FAIL: ${title} ${extra}`);
        failed++;
    }
}

async function measureRequest(name, path, options = {}, slaMs = 300) {
    const t0 = performance.now();
    try {
        const res = await fetch(API_BASE + path, options);
        const t1 = performance.now();
        const duration = Math.round(t1 - t0);
        let ok = res.ok;
        let data = null;
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
            data = await res.json();
        }
        
        benchmarkResults.push({
            name,
            path,
            status: res.status,
            latencyMs: duration,
            withinSla: duration <= slaMs && ok,
            slaMs
        });

        check(
            `${name} [${path}] -> ${duration}ms (SLA: <${slaMs}ms)`,
            ok && duration <= slaMs,
            `Status: ${res.status}`
        );
        return { ok, status: res.status, duration, data };
    } catch (err) {
        const t1 = performance.now();
        const duration = Math.round(t1 - t0);
        benchmarkResults.push({
            name,
            path,
            status: "ERR",
            latencyMs: duration,
            withinSla: false,
            slaMs
        });
        check(`${name} [${path}] -> FAILED: ${err.message}`, false);
        return { ok: false, error: err };
    }
}

async function runBenchmarks() {
    console.log("=================================================");
    console.log("  PROCURAHUB MILESTONE 4 PERFORMANCE BENCHMARK  ");
    console.log("=================================================");

    // Warm-up call
    await fetch(API_BASE + "/dashboard/summary");

    // 1. Authenticate to obtain tokens
    console.log("\n--- Phase 1: Authentication Benchmarks ---");
    const adminLoginRes = await measureRequest(
        "Admin JWT Authentication",
        "/login",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@example.com", password: "admin123" })
        },
        1000 // Auth includes bcrypt verification
    );

    const token = adminLoginRes.data?.access_token;
    const authHeaders = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };

    // Pre-warm analytics cache once
    await fetch(API_BASE + "/api/analytics/dashboard", { headers: authHeaders });
    await fetch(API_BASE + "/api/analytics/procurement", { headers: authHeaders });

    // 2. High-volume & Analytics Endpoints (DataCo 180k rows / cached aggregates)
    console.log("\n--- Phase 2: Analytics and Summary Endpoints ---");
    await measureRequest("Dashboard Summary", "/dashboard/summary", { headers: authHeaders }, 300);
    await measureRequest("Analytics Aggregates (Cached)", "/api/analytics/dashboard", { headers: authHeaders }, 300);
    await measureRequest("Suppliers Leaderboard", "/api/suppliers?limit=25", { headers: authHeaders }, 300);
    await measureRequest("Procurement Analytics (Cached)", "/api/analytics/procurement", { headers: authHeaders }, 300);

    // 3. Operational Entities Endpoints
    console.log("\n--- Phase 3: Core CRUD and Operational Endpoints ---");
    await measureRequest("Vendors Directory", "/vendors", { headers: authHeaders }, 300);
    await measureRequest("Procurement Requests", "/procurement-requests", { headers: authHeaders }, 300);
    await measureRequest("Purchase Orders List", "/purchase-orders", { headers: authHeaders }, 300);
    await measureRequest("Invoices Ledger", "/api/invoices", { headers: authHeaders }, 300);
    await measureRequest("Contracts Registry", "/contracts", { headers: authHeaders }, 300);
    await measureRequest("System Notifications", "/notifications", { headers: authHeaders }, 300);
    await measureRequest("Audit Log Trail", "/api/audit-logs?limit=50", { headers: authHeaders }, 300);

    // 4. Concurrency Test
    console.log("\n--- Phase 4: Concurrency and Throughput Stress (10 Parallel Requests) ---");
    const tStart = performance.now();
    const parallelRequests = [
        measureRequest("Concurrent PO List 1", "/purchase-orders", { headers: authHeaders }, 3000),
        measureRequest("Concurrent PO List 2", "/purchase-orders", { headers: authHeaders }, 3000),
        measureRequest("Concurrent Summary 1", "/dashboard/summary", { headers: authHeaders }, 3000),
        measureRequest("Concurrent Summary 2", "/dashboard/summary", { headers: authHeaders }, 3000),
        measureRequest("Concurrent Vendors 1", "/vendors", { headers: authHeaders }, 3000),
        measureRequest("Concurrent Vendors 2", "/vendors", { headers: authHeaders }, 3000),
        measureRequest("Concurrent Invoices 1", "/api/invoices", { headers: authHeaders }, 3000),
        measureRequest("Concurrent Invoices 2", "/api/invoices", { headers: authHeaders }, 3000),
        measureRequest("Concurrent Contracts 1", "/contracts", { headers: authHeaders }, 3000),
        measureRequest("Concurrent Contracts 2", "/contracts", { headers: authHeaders }, 3000),
    ];

    const results = await Promise.all(parallelRequests);
    const totalConcurrentTime = Math.round(performance.now() - tStart);
    const avgLatency = Math.round(results.reduce((acc, r) => acc + r.duration, 0) / results.length);

    console.log(`\nConcurrency Summary: 10 concurrent requests completed in ${totalConcurrentTime}ms (Avg individual latency: ${avgLatency}ms)`);

    // Report Summary
    console.log("\n=================================================");
    console.log(`  BENCHMARK SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log("=================================================");

    const slaPassedCount = benchmarkResults.filter(r => r.withinSla).length;
    console.log(`SLA Target Compliance: ${slaPassedCount}/${benchmarkResults.length} (${Math.round(slaPassedCount / benchmarkResults.length * 100)}%)`);

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runBenchmarks();
