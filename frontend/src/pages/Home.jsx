import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_URL = "http://127.0.0.1:8000";

function Home() {
  const [dashboardData, setDashboardData] = useState({
    vendors: null,
    activePOs: null,
    atRisk: null,
    reliability: null,
    totalPOs: null,
    deliveredPOs: null,
    loading: true,
    error: false,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const response = await fetch(`${API_URL}/analytics/public-summary`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      setDashboardData({
        vendors: Number(data.total_vendors || 0),
        activePOs: Number(data.active_purchase_orders || 0),
        atRisk: Number(data.at_risk_vendors || 0),
        reliability: Number(data.average_reliability || 0),
        totalPOs: Number(data.total_purchase_orders || 0),
        deliveredPOs: Number(data.delivered_purchase_orders || 0),
        loading: false,
        error: false,
      });
    } catch (error) {
      console.error("Failed to load Home dashboard data:", error);

      setDashboardData({
        vendors: null,
        activePOs: null,
        atRisk: null,
        reliability: null,
        totalPOs: null,
        deliveredPOs: null,
        loading: false,
        error: true,
      });
    }
  }

  return (
    <div style={page}>
      {/* =====================================================
          NAVBAR
      ====================================================== */}

      <nav style={navbar}>
        <Link to="/" style={brand}>
          <div style={brandIcon}>V</div>

          <div>
            <div style={brandName}>VRIPRM</div>
            <div style={brandSub}>PROCUREMENT INTELLIGENCE</div>
          </div>
        </Link>

        <div style={navLinks}>
          <a href="#solutions" style={navLink}>
            Solutions
          </a>

          <a href="#platform" style={navLink}>
            Platform
          </a>

          <a href="#about" style={navLink}>
            About
          </a>

          <Link to="/login" style={loginButton}>
            Sign In
          </Link>

          <Link to="/register" style={navButton}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* =====================================================
          HERO
      ====================================================== */}

      <main>
        <section style={hero}>
          <div style={heroLeft}>
            <div style={heroTag}>
              <span style={dot}></span>
              INTELLIGENT PROCUREMENT PLATFORM
            </div>

            <h1 style={heroTitle}>
              Know your vendors.
              <br />
              <span style={heroAccent}>Control your risk.</span>
            </h1>

            <p style={heroText}>
              VRIPRM brings vendor reliability, procurement operations,
              supplier performance and risk intelligence together in one
              enterprise platform.
            </p>

            <div style={heroActions}>
              <Link to="/register" style={primaryButton}>
                Start Managing Vendors →
              </Link>

              <a href="#platform" style={secondaryButton}>
                Explore Platform
              </a>
            </div>

            <div style={trustRow}>
              <TrustItem value="6" label="User Roles" />
              <TrustItem value="10+" label="Core Modules" />
              <TrustItem value="24/7" label="Visibility" />
            </div>
          </div>

          <div style={heroRight}>
            <DashboardPreview data={dashboardData} />
          </div>
        </section>

        {/* =====================================================
            SOLUTIONS
        ====================================================== */}

        <section id="solutions" style={section}>
          <div style={sectionHeading}>
            <div style={eyebrow}>WHY VRIPRM</div>

            <h2 style={sectionTitle}>
              One platform for smarter procurement decisions.
            </h2>

            <p style={sectionText}>
              Replace fragmented vendor information with a centralized
              system designed for reliable, transparent and risk-aware
              procurement.
            </p>
          </div>

          <div style={featureGrid}>
            <FeatureCard
              icon="◈"
              title="Vendor Intelligence"
              text="Centralize vendor profiles, categories, approval status, performance and reliability."
            />

            <FeatureCard
              icon="↗"
              title="Procurement Control"
              text="Track procurement requests, purchase orders, approvals, deliveries and completion."
            />

            <FeatureCard
              icon="◎"
              title="Risk Visibility"
              text="Identify reliability concerns and monitor supplier risk before they impact operations."
            />

            <FeatureCard
              icon="▦"
              title="Performance Analytics"
              text="Turn delivery, quality and operational data into meaningful performance insights."
            />
          </div>
        </section>

        {/* =====================================================
            PLATFORM
        ====================================================== */}

        <section id="platform" style={darkSection}>
          <div style={platformContainer}>
            <div>
              <div style={darkEyebrow}>THE VRIPRM PLATFORM</div>

              <h2 style={darkTitle}>
                From vendor onboarding
                <br />
                to procurement completion.
              </h2>

              <p style={darkText}>
                Every important procurement activity can be managed through
                role-based workflows and centralized operational visibility.
              </p>
            </div>

            <div style={workflow}>
              <WorkflowStep
                number="01"
                text="Vendor Registration"
              />

              <WorkflowLine />

              <WorkflowStep
                number="02"
                text="Approval & Verification"
              />

              <WorkflowLine />

              <WorkflowStep
                number="03"
                text="Procurement & PO"
              />

              <WorkflowLine />

              <WorkflowStep
                number="04"
                text="Delivery & Performance"
              />

              <WorkflowLine />

              <WorkflowStep
                number="05"
                text="Risk & Analytics"
              />
            </div>
          </div>
        </section>

        {/* =====================================================
            ABOUT
        ====================================================== */}

        <section id="about" style={aboutSection}>
          <div style={aboutCard}>
            <div>
              <div style={eyebrow}>
                BUILT FOR ENTERPRISE OPERATIONS
              </div>

              <h2 style={aboutTitle}>
                Reliable vendors.
                <br />
                Better procurement.
              </h2>
            </div>

            <p style={aboutText}>
              VRIPRM is designed to help organizations make procurement
              decisions using structured vendor data, operational workflows
              and performance intelligence.
            </p>

            <Link to="/register" style={primaryButton}>
              Create Your Account →
            </Link>
          </div>
        </section>
      </main>

      {/* =====================================================
          FOOTER
      ====================================================== */}

      <footer style={footer}>
        <div>
          <strong>VRIPRM</strong>

          <span style={footerMuted}>
            {" "}
            · Vendor Reliability Intelligence & Procurement Risk Management
          </span>
        </div>

        <div style={footerMuted}>
          © 2026 VRIPRM
        </div>
      </footer>
    </div>
  );
}

/* ============================================================
   TRUST ITEM
============================================================ */

function TrustItem({ value, label }) {
  return (
    <div style={trustItem}>
      <strong style={trustValue}>{value}</strong>
      <span style={trustLabel}>{label}</span>
    </div>
  );
}

/* ============================================================
   FEATURE CARD
============================================================ */

function FeatureCard({ icon, title, text }) {
  return (
    <div style={featureCard}>
      <div style={featureIcon}>{icon}</div>

      <h3 style={featureTitle}>{title}</h3>

      <p style={featureText}>{text}</p>
    </div>
  );
}

/* ============================================================
   WORKFLOW STEP
============================================================ */

function WorkflowStep({ number, text }) {
  return (
    <div style={workflowStep}>
      <span style={workflowNumber}>{number}</span>
      <span style={workflowText}>{text}</span>
    </div>
  );
}

/* ============================================================
   WORKFLOW LINE
============================================================ */

function WorkflowLine() {
  return <div style={workflowLine}></div>;
}

/* ============================================================
   DASHBOARD PREVIEW
============================================================ */

function DashboardPreview({ data }) {
  const reliability = Number(data.reliability || 0);

  const chartValues = [
    Math.max(15, reliability - 28),
    Math.max(20, reliability - 18),
    Math.max(25, reliability - 10),
    Math.max(30, reliability - 6),
    Math.max(35, reliability - 3),
    Math.max(40, reliability),
    Math.min(100, reliability + 3),
    Math.min(100, reliability + 5),
  ];

  const loading = data.loading;

  return (
    <div style={preview}>
      <div style={previewTop}>
        <div>
          <div style={previewLabel}>
            PROCUREMENT OVERVIEW
          </div>

          <div style={previewTitle}>
            Operational Dashboard
          </div>
        </div>

        <div style={liveBadge}>
          <span style={liveDot}></span>
          LIVE DATA
        </div>
      </div>

      {/* =====================================================
          REAL STATS
      ====================================================== */}

      <div style={previewStats}>
        <PreviewStat
          label="Vendors"
          value={
            loading
              ? "..."
              : data.error
              ? "—"
              : String(data.vendors)
          }
        />

        <PreviewStat
          label="Active POs"
          value={
            loading
              ? "..."
              : data.error
              ? "—"
              : String(data.activePOs)
          }
        />

        <PreviewStat
          label="At Risk"
          value={
            loading
              ? "..."
              : data.error
              ? "—"
              : String(data.atRisk).padStart(2, "0")
          }
        />
      </div>

      {/* =====================================================
          REAL RELIABILITY
      ====================================================== */}

      <div style={previewChart}>
        <div style={chartHeader}>
          <span>Vendor Reliability</span>

          <strong>
            {loading
              ? "..."
              : data.error
              ? "—"
              : `${reliability.toFixed(1)}%`}
          </strong>
        </div>

        <div style={bars}>
          {chartValues.map((height, index) => (
            <div
              key={index}
              style={{
                ...bar,
                height: `${height}%`,
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* =====================================================
          REAL BACKEND DATA
      ====================================================== */}

      <div style={previewTable}>
        <PreviewRow
          vendor="Live vendor data"
          status={
            loading
              ? "Loading"
              : data.error
              ? "Unavailable"
              : data.vendors > 0
              ? "Active"
              : "None"
          }
          score={
            loading
              ? "..."
              : data.error
              ? "—"
              : `${data.vendors} Vendors`
          }
        />

        <PreviewRow
          vendor="Purchase Orders"
          status={
            loading
              ? "Loading"
              : data.error
              ? "Unavailable"
              : data.activePOs > 0
              ? "Active"
              : "None"
          }
          score={
            loading
              ? "..."
              : data.error
              ? "—"
              : `${data.totalPOs} Total`
          }
        />

        <PreviewRow
          vendor="Risk Monitoring"
          status={
            loading
              ? "Loading"
              : data.error
              ? "Unavailable"
              : data.atRisk > 0
              ? "Review"
              : "Stable"
          }
          score={
            loading
              ? "..."
              : data.error
              ? "—"
              : `${data.atRisk} At Risk`
          }
        />

        <PreviewRow
          vendor="Delivered Orders"
          status={
            loading
              ? "Loading"
              : data.error
              ? "Unavailable"
              : "Completed"
          }
          score={
            loading
              ? "..."
              : data.error
              ? "—"
              : `${data.deliveredPOs} Delivered`
          }
        />
      </div>
    </div>
  );
}

/* ============================================================
   PREVIEW STAT
============================================================ */

function PreviewStat({ label, value }) {
  return (
    <div style={previewStat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/* ============================================================
   PREVIEW ROW
============================================================ */

function PreviewRow({ vendor, status, score }) {
  return (
    <div style={previewRow}>
      <span>{vendor}</span>

      <span style={previewStatus}>
        {status}
      </span>

      <strong>{score}</strong>
    </div>
  );
}

/* ============================================================
   PAGE
============================================================ */

const page = {
  minHeight: "100vh",
  background: "#f5f7fb",
  color: "#172033",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

/* ============================================================
   NAVBAR
============================================================ */

const navbar = {
  minHeight: "76px",
  padding: "0 6%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "rgba(255,255,255,0.97)",
  borderBottom: "1px solid #e5eaf0",
  position: "sticky",
  top: 0,
  zIndex: 100,
  boxSizing: "border-box",
};

const brand = {
  display: "flex",
  alignItems: "center",
  gap: "11px",
  textDecoration: "none",
  color: "#172033",
};

const brandIcon = {
  width: "40px",
  height: "40px",
  borderRadius: "10px",
  background: "#123f61",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "800",
  fontSize: "18px",
  boxShadow: "0 6px 18px rgba(18,63,97,0.18)",
};

const brandName = {
  fontWeight: "800",
  fontSize: "18px",
  letterSpacing: "0.8px",
  color: "#172033",
};

const brandSub = {
  fontSize: "7px",
  letterSpacing: "1px",
  color: "#8a94a5",
  marginTop: "2px",
};

const navLinks = {
  display: "flex",
  alignItems: "center",
  gap: "25px",
};

const navLink = {
  color: "#596579",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: "500",
};

const loginButton = {
  textDecoration: "none",
  color: "#123f61",
  fontSize: "13px",
  fontWeight: "700",
};

const navButton = {
  background: "#123f61",
  color: "#fff",
  textDecoration: "none",
  padding: "10px 17px",
  borderRadius: "8px",
  fontSize: "12px",
  fontWeight: "700",
  boxShadow: "0 5px 15px rgba(18,63,97,0.15)",
};

/* ============================================================
   HERO
============================================================ */

const hero = {
  maxWidth: "1250px",
  margin: "0 auto",
  padding: "95px 5% 80px",
  display: "grid",
  gridTemplateColumns: "0.95fr 1.05fr",
  gap: "70px",
  alignItems: "center",
  boxSizing: "border-box",
};

const heroLeft = {
  maxWidth: "590px",
};

const heroTag = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "7px 11px",
  background: "#edf7f9",
  border: "1px solid #d9eef2",
  borderRadius: "20px",
  color: "#137388",
  fontSize: "9px",
  letterSpacing: "1.2px",
  fontWeight: "800",
};

const dot = {
  width: "6px",
  height: "6px",
  borderRadius: "50%",
  background: "#137388",
};

const heroTitle = {
  fontSize: "58px",
  lineHeight: "1.03",
  letterSpacing: "-2.5px",
  margin: "25px 0 23px",
  color: "#172033",
};

const heroAccent = {
  color: "#123f61",
};

const heroText = {
  fontSize: "16px",
  lineHeight: "1.75",
  color: "#6d7788",
  maxWidth: "530px",
};

const heroActions = {
  display: "flex",
  gap: "12px",
  marginTop: "32px",
};

const primaryButton = {
  display: "inline-block",
  textDecoration: "none",
  background: "#123f61",
  color: "#fff",
  padding: "13px 19px",
  borderRadius: "9px",
  fontSize: "12px",
  fontWeight: "700",
  boxShadow: "0 8px 20px rgba(18,63,97,0.16)",
};

const secondaryButton = {
  display: "inline-block",
  textDecoration: "none",
  background: "#fff",
  color: "#123f61",
  border: "1px solid #d9e0e8",
  padding: "13px 19px",
  borderRadius: "9px",
  fontSize: "12px",
  fontWeight: "700",
};

const trustRow = {
  display: "flex",
  gap: "35px",
  marginTop: "45px",
};

const trustItem = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
};

const trustValue = {
  fontSize: "20px",
  color: "#172033",
};

const trustLabel = {
  fontSize: "10px",
  color: "#8a94a5",
};

const heroRight = {
  display: "flex",
  justifyContent: "center",
};

/* ============================================================
   DASHBOARD PREVIEW
============================================================ */

const preview = {
  width: "100%",
  maxWidth: "570px",
  background: "#fff",
  borderRadius: "18px",
  padding: "24px",
  boxSizing: "border-box",
  boxShadow: "0 25px 70px rgba(18,63,97,0.13)",
  border: "1px solid #e5eaf0",
  transform: "rotate(1deg)",
};

const previewTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const previewLabel = {
  color: "#8a94a5",
  fontSize: "8px",
  letterSpacing: "1.5px",
  fontWeight: "800",
};

const previewTitle = {
  fontSize: "18px",
  fontWeight: "800",
  marginTop: "5px",
  color: "#172033",
};

const liveBadge = {
  fontSize: "8px",
  fontWeight: "800",
  color: "#137388",
  background: "#edf7f9",
  padding: "6px 8px",
  borderRadius: "20px",
  display: "flex",
  gap: "5px",
  alignItems: "center",
};

const liveDot = {
  width: "5px",
  height: "5px",
  background: "#67d7e8",
  borderRadius: "50%",
};

const previewStats = {
  display: "grid",
  gridTemplateColumns: "repeat(3,1fr)",
  gap: "10px",
  marginTop: "22px",
};

const previewStat = {
  background: "#f5f7fb",
  border: "1px solid #edf0f4",
  padding: "14px",
  borderRadius: "9px",
  display: "flex",
  flexDirection: "column",
  gap: "5px",
};

const previewChart = {
  marginTop: "12px",
  background: "#123f61",
  borderRadius: "10px",
  padding: "18px",
  color: "#fff",
};

const chartHeader = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "11px",
};

const bars = {
  height: "100px",
  marginTop: "16px",
  display: "flex",
  alignItems: "flex-end",
  gap: "8px",
};

const bar = {
  flex: 1,
  background: "#67d7e8",
  borderRadius: "4px 4px 0 0",
  opacity: 0.75,
};

const previewTable = {
  marginTop: "12px",
};

const previewRow = {
  display: "grid",
  gridTemplateColumns: "1.7fr 0.7fr 0.7fr",
  gap: "10px",
  padding: "11px 4px",
  borderBottom: "1px solid #eee",
  fontSize: "10px",
  alignItems: "center",
  color: "#354052",
};

const previewStatus = {
  color: "#137388",
  fontWeight: "700",
};

/* ============================================================
   SOLUTIONS SECTION
============================================================ */

const section = {
  maxWidth: "1250px",
  margin: "0 auto",
  padding: "90px 5%",
  boxSizing: "border-box",
};

const sectionHeading = {
  maxWidth: "650px",
  marginBottom: "45px",
};

const eyebrow = {
  fontSize: "9px",
  letterSpacing: "1.8px",
  color: "#137388",
  fontWeight: "800",
};

const sectionTitle = {
  fontSize: "38px",
  lineHeight: "1.15",
  margin: "10px 0 15px",
  color: "#172033",
};

const sectionText = {
  color: "#777f8e",
  lineHeight: "1.7",
  fontSize: "14px",
};

const featureGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4,1fr)",
  gap: "16px",
};

const featureCard = {
  background: "#fff",
  border: "1px solid #e5eaf0",
  borderRadius: "14px",
  padding: "25px",
  boxShadow: "0 8px 25px rgba(20,35,60,0.04)",
};

const featureIcon = {
  width: "38px",
  height: "38px",
  borderRadius: "9px",
  background: "#edf7f9",
  color: "#137388",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "17px",
  marginBottom: "18px",
};

const featureTitle = {
  fontSize: "15px",
  margin: "0 0 8px",
  color: "#172033",
};

const featureText = {
  color: "#777f8e",
  fontSize: "12px",
  lineHeight: "1.65",
  margin: 0,
};

/* ============================================================
   DARK PLATFORM
============================================================ */

const darkSection = {
  background:
    "linear-gradient(145deg, #0b1f3a 0%, #123f61 60%, #0e5b70 100%)",
  color: "#fff",
  padding: "90px 5%",
  boxSizing: "border-box",
};

const platformContainer = {
  maxWidth: "1250px",
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "80px",
  alignItems: "center",
};

const darkEyebrow = {
  fontSize: "9px",
  letterSpacing: "1.8px",
  opacity: 0.6,
  fontWeight: "800",
};

const darkTitle = {
  fontSize: "39px",
  lineHeight: "1.15",
  margin: "12px 0 18px",
};

const darkText = {
  color: "rgba(255,255,255,0.68)",
  lineHeight: "1.7",
  fontSize: "14px",
  maxWidth: "500px",
};

const workflow = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  padding: "25px",
  borderRadius: "15px",
  backdropFilter: "blur(8px)",
};

const workflowStep = {
  display: "flex",
  alignItems: "center",
  gap: "15px",
};

const workflowNumber = {
  fontSize: "10px",
  color: "#67d7e8",
  opacity: 0.8,
  fontWeight: "800",
};

const workflowText = {
  fontSize: "13px",
  fontWeight: "600",
};

const workflowLine = {
  width: "1px",
  height: "22px",
  background: "rgba(255,255,255,0.16)",
  margin: "6px 0 6px 4px",
};

/* ============================================================
   ABOUT
============================================================ */

const aboutSection = {
  maxWidth: "1250px",
  margin: "0 auto",
  padding: "90px 5%",
  boxSizing: "border-box",
};

const aboutCard = {
  background: "#fff",
  border: "1px solid #e5eaf0",
  borderRadius: "18px",
  padding: "45px",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "40px",
  alignItems: "center",
  boxShadow: "0 10px 35px rgba(20,35,60,0.05)",
};

const aboutTitle = {
  fontSize: "36px",
  lineHeight: "1.15",
  margin: "12px 0 0",
  color: "#172033",
};

const aboutText = {
  color: "#777f8e",
  fontSize: "14px",
  lineHeight: "1.8",
  margin: 0,
};

/* ============================================================
   FOOTER
============================================================ */

const footer = {
  padding: "25px 6%",
  borderTop: "1px solid #e5eaf0",
  display: "flex",
  justifyContent: "space-between",
  fontSize: "11px",
  background: "#fff",
  color: "#172033",
  boxSizing: "border-box",
};

const footerMuted = {
  color: "#8a94a5",
};

export default Home;