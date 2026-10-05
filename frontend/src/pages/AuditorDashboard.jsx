import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_URL = "http://127.0.0.1:8000";

const MENU_ITEMS = [
  "Dashboard",
  "Records",
  "Vendors",
  "Procurement",
  "Risk Assessments",
  "Performance",
  "Reports"
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
  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.items)) {
    return data.items;
  }

  if (data && Array.isArray(data.data)) {
    return data.data;
  }

  if (data && Array.isArray(data.results)) {
    return data.results;
  }

  return [];
}

function safeNumber(value) {
  const number = Number(value);

  if (Number.isFinite(number)) {
    return number;
  }

  return 0;
}

function getVendorName(vendor) {
  if (!vendor) {
    return "Unknown Vendor";
  }

  if (vendor.company_name) {
    return vendor.company_name;
  }

  if (vendor.companyName) {
    return vendor.companyName;
  }

  if (vendor.vendor_name) {
    return vendor.vendor_name;
  }

  if (vendor.name) {
    return vendor.name;
  }

  if (vendor.id !== undefined && vendor.id !== null) {
    return "Vendor #" + vendor.id;
  }

  return "Unknown Vendor";
}

function getReliability(vendor) {
  if (!vendor) {
    return 0;
  }

  const value =
    vendor.reliability_score !== undefined
      ? vendor.reliability_score
      : vendor.reliabilityScore !== undefined
      ? vendor.reliabilityScore
      : vendor.overall_score !== undefined
      ? vendor.overall_score
      : vendor.overall_reliability !== undefined
      ? vendor.overall_reliability
      : 0;

  return safeNumber(value);
}

function getRiskLevel(score) {
  if (score < 60) {
    return "High";
  }

  if (score < 80) {
    return "Medium";
  }

  return "Low";
}

function formatStatus(value) {
  if (!value) {
    return "Unknown";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, function (char) {
      return char.toUpperCase();
    });
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getPerformanceVendorId(item) {
  if (!item) {
    return null;
  }

  if (item.vendor_id !== undefined && item.vendor_id !== null) {
    return item.vendor_id;
  }

  if (item.vendorId !== undefined && item.vendorId !== null) {
    return item.vendorId;
  }

  return null;
}

function getPerformanceVendorName(item, vendors) {
  if (!item) {
    return "Unknown Vendor";
  }

  if (item.company_name) {
    return item.company_name;
  }

  if (item.vendor_name) {
    return item.vendor_name;
  }

  if (item.vendorName) {
    return item.vendorName;
  }

  const vendorId = getPerformanceVendorId(item);

  if (vendorId !== null) {
    const vendor = vendors.find(function (v) {
      return Number(v.id) === Number(vendorId);
    });

    if (vendor) {
      return getVendorName(vendor);
    }

    return "Vendor #" + vendorId;
  }

  return "Unknown Vendor";
}

function getPerformanceScore(item) {
  if (!item) {
    return 0;
  }

  if (item.reliability_score !== undefined) {
    return safeNumber(item.reliability_score);
  }

  if (item.overall_score !== undefined) {
    return safeNumber(item.overall_score);
  }

  if (item.overall_reliability !== undefined) {
    return safeNumber(item.overall_reliability);
  }

  if (item.reliability !== undefined) {
    return safeNumber(item.reliability);
  }

  return 0;
}

function AuditorDashboard() {
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [performance, setPerformance] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [searchText, setSearchText] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");

  async function loadDashboard(isRefresh) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const token = getToken();

      const headers = {
        Accept: "application/json"
      };

      if (token) {
        headers.Authorization = "Bearer " + token;
      }

      const vendorResponse = await fetch(API_URL + "/vendors", {
        method: "GET",
        headers: headers
      });

      const orderResponse = await fetch(API_URL + "/purchase-orders", {
        method: "GET",
        headers: headers
      });

      const performanceResponse = await fetch(API_URL + "/performance", {
        method: "GET",
        headers: headers
      });

      let vendorData = [];
      let orderData = [];
      let performanceData = [];

      if (vendorResponse.ok) {
        vendorData = normalizeArray(await vendorResponse.json());
      }

      if (orderResponse.ok) {
        orderData = normalizeArray(await orderResponse.json());
      }

      if (performanceResponse.ok) {
        performanceData = normalizeArray(await performanceResponse.json());
      }

      setVendors(vendorData);
      setPurchaseOrders(orderData);
      setPerformance(performanceData);

      const failed = [];

      if (!vendorResponse.ok) {
        failed.push("vendors");
      }

      if (!orderResponse.ok) {
        failed.push("purchase orders");
      }

      if (!performanceResponse.ok) {
        failed.push("performance");
      }

      if (failed.length > 0) {
        setError(
          "Some audit data could not be loaded: " + failed.join(", ") + "."
        );
      }
    } catch (err) {
      setError(
        "Unable to connect to the backend. Please make sure FastAPI is running."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(function () {
    loadDashboard(false);
  }, []);

  const vendorRows = useMemo(
    function () {
      return vendors.map(function (vendor) {
        const score = getReliability(vendor);

        return {
          id: vendor.id,
          name: getVendorName(vendor),
          score: score,
          risk: getRiskLevel(score),
          email: vendor.email || "—",
          category:
            vendor.category ||
            vendor.vendor_category ||
            vendor.vendorCategory ||
            "—"
        };
      });
    },
    [vendors]
  );

  const filteredVendors = useMemo(
    function () {
      const search = searchText.trim().toLowerCase();

      return vendorRows.filter(function (vendor) {
        const matchesSearch =
          search === "" ||
          vendor.name.toLowerCase().includes(search) ||
          String(vendor.id).includes(search) ||
          vendor.email.toLowerCase().includes(search);

        const matchesRisk =
          riskFilter === "All" || vendor.risk === riskFilter;

        return matchesSearch && matchesRisk;
      });
    },
    [vendorRows, searchText, riskFilter]
  );

  const riskCounts = useMemo(
    function () {
      let low = 0;
      let medium = 0;
      let high = 0;

      vendorRows.forEach(function (vendor) {
        if (vendor.risk === "Low") {
          low += 1;
        } else if (vendor.risk === "Medium") {
          medium += 1;
        } else {
          high += 1;
        }
      });

      return {
        low: low,
        medium: medium,
        high: high
      };
    },
    [vendorRows]
  );

  const orderCounts = useMemo(
    function () {
      let delivered = 0;
      let approved = 0;
      let pending = 0;
      let cancelled = 0;
      let shipped = 0;

      purchaseOrders.forEach(function (order) {
        const status = String(
          order.status || order.order_status || ""
        ).toLowerCase();

        if (status === "delivered") {
          delivered += 1;
        } else if (status === "approved") {
          approved += 1;
        } else if (status === "pending") {
          pending += 1;
        } else if (status === "cancelled" || status === "canceled") {
          cancelled += 1;
        } else if (status === "shipped") {
          shipped += 1;
        }
      });

      return {
        delivered: delivered,
        approved: approved,
        pending: pending,
        cancelled: cancelled,
        shipped: shipped
      };
    },
    [purchaseOrders]
  );

  const averageReliability = useMemo(
    function () {
      if (vendorRows.length === 0) {
        return 0;
      }

      const total = vendorRows.reduce(function (sum, vendor) {
        return sum + vendor.score;
      }, 0);

      return total / vendorRows.length;
    },
    [vendorRows]
  );

  const deliveryRate = useMemo(
    function () {
      if (purchaseOrders.length === 0) {
        return 0;
      }

      return (orderCounts.delivered / purchaseOrders.length) * 100;
    },
    [purchaseOrders, orderCounts]
  );

  const topVendors = useMemo(
    function () {
      return vendorRows
        .slice()
        .sort(function (a, b) {
          return b.score - a.score;
        })
        .slice(0, 5);
    },
    [vendorRows]
  );

  const recentPerformance = useMemo(
    function () {
      return performance.slice(0, 8);
    },
    [performance]
  );

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e8ebf1",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 6px 18px rgba(11, 31, 58, 0.06)"
  };

  const statValueStyle = {
    fontSize: "28px",
    fontWeight: "800",
    color: "#0b1f3a",
    marginTop: "8px"
  };

  const labelStyle = {
    fontSize: "13px",
    color: "#7b8495",
    fontWeight: "600"
  };

  function riskColor(risk) {
    if (risk === "Low") {
      return "#16845b";
    }

    if (risk === "Medium") {
      return "#c88719";
    }

    return "#c94747";
  }

  function statusColor(status) {
    const value = String(status).toLowerCase();

    if (value === "delivered") {
      return "#16845b";
    }

    if (value === "approved" || value === "shipped") {
      return "#137388";
    }

    if (value === "cancelled" || value === "canceled") {
      return "#c94747";
    }

    return "#c88719";
  }

  if (loading) {
    return (
      <DashboardLayout
        title="Auditor Dashboard"
        menuItems={MENU_ITEMS}
        activeItem="Dashboard"
      >
        <div
          style={{
            minHeight: "70vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#7b8495",
            fontSize: "16px"
          }}
        >
          Loading audit dashboard...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Auditor Dashboard"
      menuItems={MENU_ITEMS}
      activeItem="Dashboard"
    >
      <div
        style={{
          background: "#f5f7fb",
          minHeight: "100%",
          padding: "28px"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            marginBottom: "24px",
            flexWrap: "wrap"
          }}
        >
          <div>
            <div
              style={{
                color: "#0b1f3a",
                fontSize: "28px",
                fontWeight: "800"
              }}
            >
              Auditor Dashboard
            </div>

            <div
              style={{
                color: "#7b8495",
                fontSize: "14px",
                marginTop: "6px"
              }}
            >
              Monitor vendor reliability, procurement activity and audit records.
            </div>
          </div>

          <button
            onClick={function () {
              loadDashboard(true);
            }}
            disabled={refreshing}
            style={{
              border: "none",
              borderRadius: "10px",
              padding: "11px 18px",
              background: "#123f61",
              color: "#ffffff",
              fontWeight: "700",
              cursor: refreshing ? "not-allowed" : "pointer",
              opacity: refreshing ? 0.7 : 1
            }}
          >
            {refreshing ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "#fff5f5",
              border: "1px solid #f0caca",
              color: "#a63b3b",
              padding: "13px 16px",
              borderRadius: "10px",
              marginBottom: "20px",
              fontSize: "14px"
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "16px",
            marginBottom: "20px"
          }}
        >
          <div style={cardStyle}>
            <div style={labelStyle}>TOTAL VENDORS</div>
            <div style={statValueStyle}>{vendors.length}</div>
            <div style={{ color: "#137388", fontSize: "13px", marginTop: "5px" }}>
              Registered suppliers
            </div>
          </div>

          <div style={cardStyle}>
            <div style={labelStyle}>PURCHASE ORDERS</div>
            <div style={statValueStyle}>{purchaseOrders.length}</div>
            <div style={{ color: "#137388", fontSize: "13px", marginTop: "5px" }}>
              Procurement records
            </div>
          </div>

          <div style={cardStyle}>
            <div style={labelStyle}>DELIVERED ORDERS</div>
            <div style={statValueStyle}>{orderCounts.delivered}</div>
            <div style={{ color: "#16845b", fontSize: "13px", marginTop: "5px" }}>
              {deliveryRate.toFixed(1)}% delivery rate
            </div>
          </div>

          <div style={cardStyle}>
            <div style={labelStyle}>HIGH RISK VENDORS</div>
            <div style={{ ...statValueStyle, color: "#c94747" }}>
              {riskCounts.high}
            </div>
            <div style={{ color: "#c94747", fontSize: "13px", marginTop: "5px" }}>
              Requires audit attention
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: "20px",
            marginBottom: "20px"
          }}
        >
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px"
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "800",
                    color: "#0b1f3a"
                  }}
                >
                  Vendor Risk Distribution
                </div>

                <div
                  style={{
                    color: "#7b8495",
                    fontSize: "13px",
                    marginTop: "4px"
                  }}
                >
                  Reliability-based audit classification
                </div>
              </div>

              <div
                style={{
                  fontSize: "25px",
                  fontWeight: "800",
                  color: "#137388"
                }}
              >
                {averageReliability.toFixed(1)}%
              </div>
            </div>

            {[
              {
                label: "Low Risk",
                value: riskCounts.low,
                color: "#16845b"
              },
              {
                label: "Medium Risk",
                value: riskCounts.medium,
                color: "#c88719"
              },
              {
                label: "High Risk",
                value: riskCounts.high,
                color: "#c94747"
              }
            ].map(function (item) {
              const percentage =
                vendors.length > 0 ? (item.value / vendors.length) * 100 : 0;

              return (
                <div key={item.label} style={{ marginBottom: "18px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "7px",
                      fontSize: "13px"
                    }}
                  >
                    <span style={{ color: "#172033", fontWeight: "700" }}>
                      {item.label}
                    </span>

                    <span style={{ color: "#7b8495" }}>
                      {item.value} vendors
                    </span>
                  </div>

                  <div
                    style={{
                      height: "9px",
                      background: "#edf0f4",
                      borderRadius: "20px",
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        width: percentage + "%",
                        height: "100%",
                        background: item.color,
                        borderRadius: "20px"
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={cardStyle}>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "800",
                color: "#0b1f3a",
                marginBottom: "4px"
              }}
            >
              Procurement Lifecycle
            </div>

            <div
              style={{
                color: "#7b8495",
                fontSize: "13px",
                marginBottom: "20px"
              }}
            >
              Current purchase order status
            </div>

            {[
              { label: "Delivered", value: orderCounts.delivered },
              { label: "Approved", value: orderCounts.approved },
              { label: "Shipped", value: orderCounts.shipped },
              { label: "Pending", value: orderCounts.pending },
              { label: "Cancelled", value: orderCounts.cancelled }
            ].map(function (item) {
              const maxValue = Math.max(purchaseOrders.length, 1);
              const width = (item.value / maxValue) * 100;

              return (
                <div
                  key={item.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "90px 1fr 35px",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "12px"
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#172033",
                      fontWeight: "600"
                    }}
                  >
                    {item.label}
                  </span>

                  <div
                    style={{
                      height: "8px",
                      background: "#edf0f4",
                      borderRadius: "20px",
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        width: width + "%",
                        height: "100%",
                        background: "#137388",
                        borderRadius: "20px"
                      }}
                    />
                  </div>

                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "#0b1f3a",
                      textAlign: "right"
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...cardStyle, marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "18px"
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "800",
                  color: "#0b1f3a"
                }}
              >
                Top Vendor Reliability
              </div>

              <div
                style={{
                  color: "#7b8495",
                  fontSize: "13px",
                  marginTop: "4px"
                }}
              >
                Based on current backend performance data
              </div>
            </div>
          </div>

          {topVendors.length === 0 ? (
            <div
              style={{
                padding: "25px",
                textAlign: "center",
                color: "#7b8495"
              }}
            >
              No vendor data available.
            </div>
          ) : (
            topVendors.map(function (vendor, index) {
              return (
                <div
                  key={vendor.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "35px 190px 1fr 70px",
                    alignItems: "center",
                    gap: "14px",
                    marginBottom: "14px"
                  }}
                >
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      background: "#e8f5f7",
                      color: "#137388",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "800",
                      fontSize: "12px"
                    }}
                  >
                    {index + 1}
                  </div>

                  <div
                    style={{
                      color: "#172033",
                      fontWeight: "700",
                      fontSize: "13px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {vendor.name}
                  </div>

                  <div
                    style={{
                      height: "9px",
                      background: "#edf0f4",
                      borderRadius: "20px",
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        width: Math.min(vendor.score, 100) + "%",
                        height: "100%",
                        background: "#137388",
                        borderRadius: "20px"
                      }}
                    />
                  </div>

                  <div
                    style={{
                      fontWeight: "800",
                      color: "#0b1f3a",
                      textAlign: "right"
                    }}
                  >
                    {vendor.score.toFixed(1)}%
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ ...cardStyle, marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "18px"
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "800",
                  color: "#0b1f3a"
                }}
              >
                Vendor Audit Records
              </div>

              <div
                style={{
                  color: "#7b8495",
                  fontSize: "13px",
                  marginTop: "4px"
                }}
              >
                Search and review current vendor risk information
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap"
              }}
            >
              <input
                value={searchText}
                onChange={function (event) {
                  setSearchText(event.target.value);
                }}
                placeholder="Search vendor..."
                style={{
                  border: "1px solid #dfe4eb",
                  borderRadius: "8px",
                  padding: "9px 12px",
                  outline: "none",
                  minWidth: "190px"
                }}
              />

              <select
                value={riskFilter}
                onChange={function (event) {
                  setRiskFilter(event.target.value);
                }}
                style={{
                  border: "1px solid #dfe4eb",
                  borderRadius: "8px",
                  padding: "9px 12px",
                  background: "#ffffff",
                  color: "#172033"
                }}
              >
                <option value="All">All Risk</option>
                <option value="Low">Low Risk</option>
                <option value="Medium">Medium Risk</option>
                <option value="High">High Risk</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "700px"
              }}
            >
              <thead>
                <tr>
                  {[
                    "Vendor",
                    "Category",
                    "Email",
                    "Reliability",
                    "Risk"
                  ].map(function (heading) {
                    return (
                      <th
                        key={heading}
                        style={{
                          textAlign: "left",
                          padding: "12px",
                          background: "#f8f9fb",
                          color: "#7b8495",
                          fontSize: "12px",
                          fontWeight: "800",
                          borderBottom: "1px solid #e8ebf1"
                        }}
                      >
                        {heading}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {filteredVendors.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      style={{
                        padding: "30px",
                        textAlign: "center",
                        color: "#7b8495"
                      }}
                    >
                      No vendors found.
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map(function (vendor) {
                    return (
                      <tr key={vendor.id}>
                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom: "1px solid #eef0f4"
                          }}
                        >
                          <div
                            style={{
                              fontWeight: "700",
                              color: "#172033"
                            }}
                          >
                            {vendor.name}
                          </div>

                          <div
                            style={{
                              fontSize: "11px",
                              color: "#9aa2b1",
                              marginTop: "3px"
                            }}
                          >
                            Vendor ID: {vendor.id}
                          </div>
                        </td>

                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom: "1px solid #eef0f4",
                            color: "#586174",
                            fontSize: "13px"
                          }}
                        >
                          {vendor.category}
                        </td>

                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom: "1px solid #eef0f4",
                            color: "#586174",
                            fontSize: "13px"
                          }}
                        >
                          {vendor.email}
                        </td>

                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom: "1px solid #eef0f4",
                            fontWeight: "800",
                            color: "#0b1f3a"
                          }}
                        >
                          {vendor.score.toFixed(1)}%
                        </td>

                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom: "1px solid #eef0f4"
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              padding: "5px 10px",
                              borderRadius: "20px",
                              background:
                                vendor.risk === "Low"
                                  ? "#eaf7f1"
                                  : vendor.risk === "Medium"
                                  ? "#fff6e5"
                                  : "#fff0f0",
                              color: riskColor(vendor.risk),
                              fontSize: "12px",
                              fontWeight: "800"
                            }}
                          >
                            {vendor.risk}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              fontSize: "18px",
              fontWeight: "800",
              color: "#0b1f3a",
              marginBottom: "4px"
            }}
          >
            Recent Performance Records
          </div>

          <div
            style={{
              color: "#7b8495",
              fontSize: "13px",
              marginBottom: "18px"
            }}
          >
            Latest vendor performance information received from the backend
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "700px"
              }}
            >
              <thead>
                <tr>
                  {[
                    "Vendor",
                    "Reliability",
                    "Status",
                    "Updated"
                  ].map(function (heading) {
                    return (
                      <th
                        key={heading}
                        style={{
                          textAlign: "left",
                          padding: "12px",
                          background: "#f8f9fb",
                          color: "#7b8495",
                          fontSize: "12px",
                          fontWeight: "800",
                          borderBottom: "1px solid #e8ebf1"
                        }}
                      >
                        {heading}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {recentPerformance.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      style={{
                        padding: "30px",
                        textAlign: "center",
                        color: "#7b8495"
                      }}
                    >
                      No performance records available.
                    </td>
                  </tr>
                ) : (
                  recentPerformance.map(function (item, index) {
                    const score = getPerformanceScore(item);
                    const status =
                      item.status ||
                      item.performance_status ||
                      item.risk_level ||
                      getRiskLevel(score);

                    const updated =
                      item.updated_at ||
                      item.updatedAt ||
                      item.created_at ||
                      item.createdAt;

                    return (
                      <tr key={item.id || index}>
                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom: "1px solid #eef0f4",
                            fontWeight: "700",
                            color: "#172033"
                          }}
                        >
                          {getPerformanceVendorName(item, vendors)}
                        </td>

                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom: "1px solid #eef0f4",
                            fontWeight: "800",
                            color: "#0b1f3a"
                          }}
                        >
                          {score.toFixed(1)}%
                        </td>

                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom: "1px solid #eef0f4"
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              padding: "5px 10px",
                              borderRadius: "20px",
                              background: "#f0f5f8",
                              color: statusColor(status),
                              fontSize: "12px",
                              fontWeight: "800"
                            }}
                          >
                            {formatStatus(status)}
                          </span>
                        </td>

                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom: "1px solid #eef0f4",
                            color: "#7b8495",
                            fontSize: "13px"
                          }}
                        >
                          {formatDate(updated)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AuditorDashboard;