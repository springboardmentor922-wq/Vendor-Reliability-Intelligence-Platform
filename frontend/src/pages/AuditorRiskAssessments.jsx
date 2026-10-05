import React, { useEffect, useState } from "react";
import RoleTablePage from "../components/RoleTablePage";

const API_URL = "http://127.0.0.1:8000";

const MENU_ITEMS = [
  "Dashboard",
  "Records",
  "Vendors",
  "Procurement",
  "Risk Assessments",
  "Performance",
  "Reports",
];

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("access_token")
  );
}

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function getScore(vendor) {
  const score = Number(
    vendor.reliability_score ??
      vendor.reliabilityScore ??
      0
  );

  return Number.isFinite(score) ? score : 0;
}

function getRisk(score) {
  if (score < 60) return "High";
  if (score < 80) return "Medium";
  return "Low";
}

function AuditorRiskAssessments() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRiskData = async () => {
    try {
      setLoading(true);

      const token = getToken();

      if (!token) return;

      const response = await fetch(
        `${API_URL}/vendors`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load vendor risk data."
        );
      }

      const data = await response.json();

      setVendors(normalizeArray(data));
    } catch (error) {
      console.error(error);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRiskData();
  }, []);

  const high = vendors.filter(
    (vendor) => getScore(vendor) < 60
  ).length;

  const medium = vendors.filter((vendor) => {
    const score = getScore(vendor);
    return score >= 60 && score < 80;
  }).length;

  const low = vendors.filter(
    (vendor) => getScore(vendor) >= 80
  ).length;

  return (
    <RoleTablePage
      title="Risk Assessments"
      subtitle="Review risk levels calculated from current vendor reliability scores."
      role="Auditor"
      menuItems={MENU_ITEMS}
      cards={[
        {
          label: "Total Vendors",
          value: loading ? "..." : vendors.length,
        },
        {
          label: "High Risk",
          value: loading ? "..." : high,
        },
        {
          label: "Medium Risk",
          value: loading ? "..." : medium,
        },
        {
          label: "Low Risk",
          value: loading ? "..." : low,
        },
      ]}
      columns={[
        "Vendor",
        "Reliability Score",
        "Risk Level",
        "Approval Status",
        "Audit Status",
      ]}
      data={vendors.map((vendor) => {
        const score = getScore(vendor);
        const risk = getRisk(score);

        return [
          vendor.company_name ||
            vendor.companyName ||
            vendor.name ||
            `Vendor #${vendor.id}`,
          `${score.toFixed(1)}%`,
          risk,
          vendor.approval_status ||
            vendor.vendor_status ||
            "—",
          risk === "High"
            ? "Review Required"
            : "Monitoring",
        ];
      })}
    />
  );
}

export default AuditorRiskAssessments;