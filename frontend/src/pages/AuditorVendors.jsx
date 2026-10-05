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

function vendorName(vendor) {
  return (
    vendor.company_name ||
    vendor.companyName ||
    vendor.name ||
    vendor.vendor_name ||
    `Vendor #${vendor.id}`
  );
}

function reliability(vendor) {
  const value = Number(
    vendor.reliability_score ??
      vendor.reliabilityScore ??
      0
  );

  return Number.isFinite(value) ? value : 0;
}

function riskLevel(score) {
  if (score < 60) return "High";
  if (score < 80) return "Medium";
  return "Low";
}

function format(value) {
  if (!value) return "—";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function AuditorVendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadVendors = async () => {
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
        throw new Error("Unable to load vendors.");
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
    loadVendors();
  }, []);

  const compliant = vendors.filter(
    (vendor) =>
      String(
        vendor.approval_status || ""
      ).toLowerCase() === "approved"
  ).length;

  const highRisk = vendors.filter(
    (vendor) => reliability(vendor) < 60
  ).length;

  return (
    <RoleTablePage
      title="Vendor Audit"
      subtitle="Review actual vendor records, status and reliability information."
      role="Auditor"
      menuItems={MENU_ITEMS}
      cards={[
        {
          label: "Total Vendors",
          value: loading ? "..." : vendors.length,
        },
        {
          label: "Approved",
          value: loading ? "..." : compliant,
        },
        {
          label: "High Risk",
          value: loading ? "..." : highRisk,
        },
        {
          label: "Records",
          value: loading ? "..." : vendors.length,
        },
      ]}
      columns={[
        "Vendor",
        "Category",
        "Reliability",
        "Risk Level",
        "Status",
      ]}
      data={vendors.map((vendor) => {
        const score = reliability(vendor);

        return [
          vendorName(vendor),
          format(vendor.category),
          `${score.toFixed(1)}%`,
          riskLevel(score),
          format(
            vendor.vendor_status ||
              vendor.approval_status
          ),
        ];
      })}
    />
  );
}

export default AuditorVendors;