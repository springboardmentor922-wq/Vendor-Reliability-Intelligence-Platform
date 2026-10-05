import React, { useEffect, useMemo, useState } from "react";
import RoleTablePage from "../components/RoleTablePage";

const API_URL = "http://127.0.0.1:8000";

function FinancePurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getToken = () => {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("access_token")
    );
  };

  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      if (!token) {
        setError("Please login again.");
        return;
      }

      const response = await fetch(`${API_URL}/purchase-orders`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let message = "Unable to load purchase orders.";

        try {
          const data = await response.json();

          if (data.detail) {
            message =
              typeof data.detail === "string"
                ? data.detail
                : JSON.stringify(data.detail);
          }
        } catch {
          // Ignore JSON parsing errors.
        }

        throw new Error(message);
      }

      const data = await response.json();

      const items = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.data)
        ? data.data
        : [];

      setOrders(items);
    } catch (err) {
      console.error("Purchase order loading error:", err);
      setError(err.message || "Unable to load purchase orders.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchaseOrders();
  }, []);

  const getValue = (order, ...keys) => {
    for (const key of keys) {
      if (
        order &&
        order[key] !== undefined &&
        order[key] !== null &&
        order[key] !== ""
      ) {
        return order[key];
      }
    }

    return null;
  };

  const formatCurrency = (amount) => {
    const value = Number(amount);

    if (Number.isNaN(value)) {
      return "₹0";
    }

    return `₹${value.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "—";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatus = (order) => {
    const status = getValue(order, "status", "order_status");

    if (!status) {
      return "Pending";
    }

    return String(status)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const getApproval = (order) => {
    const approval = getValue(
      order,
      "approval_status",
      "approvalStatus",
      "approval"
    );

    if (approval) {
      return String(approval)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    const status = String(
      getValue(order, "status", "order_status") || ""
    ).toLowerCase();

    if (status === "approved" || status === "shipped" || status === "delivered") {
      return "Approved";
    }

    return "Pending";
  };

  const getVendorName = (order) => {
    const directName = getValue(
      order,
      "vendor_name",
      "vendorName",
      "vendor_company",
      "company_name"
    );

    if (directName) {
      return directName;
    }

    if (order.vendor && typeof order.vendor === "object") {
      return (
        order.vendor.company_name ||
        order.vendor.name ||
        order.vendor.companyName ||
        `Vendor #${order.vendor_id || "—"}`
      );
    }

    const vendorId = getValue(order, "vendor_id", "vendorId");

    return vendorId ? `Vendor #${vendorId}` : "—";
  };

  const getPONumber = (order) => {
    return (
      getValue(
        order,
        "order_number",
        "po_number",
        "poNumber",
        "purchase_order_number"
      ) || `PO-${order.id || "—"}`
    );
  };

  const totalOrders = orders.length;

  const approvedOrders = useMemo(() => {
    return orders.filter((order) => {
      const approval = String(getApproval(order)).toLowerCase();

      return approval === "approved";
    }).length;
  }, [orders]);

  const pendingOrders = useMemo(() => {
    return orders.filter((order) => {
      const approval = String(getApproval(order)).toLowerCase();

      return approval === "pending";
    }).length;
  }, [orders]);

  const cancelledOrders = useMemo(() => {
    return orders.filter((order) => {
      const status = String(getStatus(order)).toLowerCase();

      return status === "cancelled" || status === "canceled";
    }).length;
  }, [orders]);

  const tableData = orders.map((order) => {
    const amount = getValue(
      order,
      "total_amount",
      "totalAmount",
      "amount",
      "estimated_amount"
    );

    return [
      getPONumber(order),
      getVendorName(order),
      formatCurrency(amount),
      getApproval(order),
      getStatus(order),
    ];
  });

  return (
    <>
      {error && (
        <div
          style={{
            margin: "20px",
            padding: "14px 18px",
            borderRadius: "8px",
            background: "#fff4f4",
            border: "1px solid #f0b5b5",
            color: "#b42318",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      <RoleTablePage
        title="Purchase Orders"
        subtitle="Review purchase orders from a financial perspective."
        role="Finance Officer"
        menuItems={[
          "Dashboard",
          "Purchase Orders",
          "Invoices",
          "Payments",
          "Financial Status",
          "Finance Reports",
          "Notifications",
        ]}
        cards={[
          {
            label: "Total Orders",
            value: loading ? "..." : String(totalOrders),
          },
          {
            label: "Approved",
            value: loading ? "..." : String(approvedOrders),
          },
          {
            label: "Pending",
            value: loading ? "..." : String(pendingOrders),
          },
          {
            label: "Cancelled",
            value: loading ? "..." : String(cancelledOrders),
          },
        ]}
        columns={[
          "PO Number",
          "Vendor",
          "Amount",
          "Approval",
          "Status",
        ]}
        data={loading ? [] : tableData}
      />
    </>
  );
}

export default FinancePurchaseOrders;