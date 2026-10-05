import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import {
  getPurchaseOrders,
  getVendors,
} from "../services/procurementService";

function SupplyChainDelayedDeliveries() {
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [poData, vendorData] = await Promise.all([
        getPurchaseOrders(),
        getVendors(),
      ]);

      setOrders(
        Array.isArray(poData)
          ? poData
          : poData?.items ||
            poData?.purchase_orders ||
            []
      );

      setVendors(
        Array.isArray(vendorData)
          ? vendorData
          : vendorData?.items ||
            vendorData?.vendors ||
            []
      );
    } catch (err) {
      setError(
        err.message || "Unable to load delayed deliveries"
      );
    } finally {
      setLoading(false);
    }
  }

  function getVendorName(vendorId) {
    const vendor = vendors.find(
      (vendor) => vendor.id === vendorId
    );

    return vendor?.company_name || "Not assigned";
  }

  function getDelayDays(order) {
    if (!order.expected_delivery_date) {
      return 0;
    }

    const expected = new Date(
      order.expected_delivery_date
    );

    let actual;

    if (order.actual_delivery_date) {
      actual = new Date(order.actual_delivery_date);
    } else if (order.status === "shipped") {
      // Still in transit, so compare expected date
      // with today's date.
      actual = new Date();
    } else {
      return 0;
    }

    const difference = actual - expected;

    return Math.max(
      0,
      Math.ceil(
        difference / (1000 * 60 * 60 * 24)
      )
    );
  }

  /*
    A delivery is considered delayed when:

    1. PO is shipped but not delivered and expected
       delivery date has passed

    OR

    2. PO is delivered but actual delivery date was
       later than expected date
  */
  const delayed = orders.filter((order) => {
    if (order.status === "cancelled") {
      return false;
    }

    if (
      order.status !== "shipped" &&
      order.status !== "delivered"
    ) {
      return false;
    }

    return getDelayDays(order) > 0;
  });

  const criticalDelays = delayed.filter(
    (order) => getDelayDays(order) >= 5
  ).length;

  const averageDelay =
    delayed.length > 0
      ? (
          delayed.reduce(
            (sum, order) =>
              sum + getDelayDays(order),
            0
          ) / delayed.length
        ).toFixed(1)
      : "0.0";

  const affectedVendors = new Set(
    delayed.map((order) => order.vendor_id)
  ).size;

  return (
    <DashboardLayout
      title="Delayed Deliveries"
      role="Supply Chain Manager"
      menuItems={[
        "Dashboard",
        "Suppliers",
        "Purchase Orders",
        "Deliveries",
        "Delayed Deliveries",
        "Performance",
        "Risk",
      ]}
    >
      <div style={header}>
        <h2>Delayed Deliveries</h2>

        <p>
          Monitor purchase orders that are delayed based
          on actual delivery dates and expected delivery
          dates.
        </p>
      </div>

      {error && (
        <div style={errorBox}>
          {error}
        </div>
      )}

      <div style={cards}>
        <Card
          label="Delayed Deliveries"
          value={delayed.length}
        />

        <Card
          label="Critical Delays"
          value={criticalDelays}
        />

        <Card
          label="Average Delay"
          value={`${averageDelay} Days`}
        />

        <Card
          label="Affected Vendors"
          value={affectedVendors}
        />
      </div>

      <div style={box}>
        <div style={tableHeader}>
          <div>
            <h3 style={{ margin: 0 }}>
              Delayed Delivery Records
            </h3>

            <p style={subText}>
              Calculated from real purchase order dates.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            style={refreshButton}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <p>Loading delayed deliveries...</p>
        ) : delayed.length === 0 ? (
          <div style={emptyBox}>
            <h4>No delayed deliveries found</h4>

            <p>
              Shipped orders that pass their expected
              delivery date will appear here.
            </p>
          </div>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>PO Number</th>
                <th style={th}>Vendor</th>
                <th style={th}>Expected Date</th>
                <th style={th}>Actual Date</th>
                <th style={th}>Delay</th>
                <th style={th}>Status</th>
                <th style={th}>Priority</th>
              </tr>
            </thead>

            <tbody>
              {delayed.map((order) => {
                const days = getDelayDays(order);

                const priority =
                  days >= 5
                    ? "High"
                    : days >= 3
                    ? "Medium"
                    : "Low";

                return (
                  <tr key={order.id}>
                    <td style={td}>
                      <strong>
                        {order.order_number ||
                          `PO-${order.id}`}
                      </strong>
                    </td>

                    <td style={td}>
                      {getVendorName(
                        order.vendor_id
                      )}
                    </td>

                    <td style={td}>
                      {order.expected_delivery_date ||
                        "—"}
                    </td>

                    <td style={td}>
                      {order.actual_delivery_date ||
                        "Not delivered"}
                    </td>

                    <td style={td}>
                      {days}{" "}
                      {days === 1
                        ? "Day"
                        : "Days"}
                    </td>

                    <td style={td}>
                      <span
                        style={statusStyle(
                          order.status
                        )}
                      >
                        {order.status ===
                        "shipped"
                          ? "In Transit"
                          : "Delivered"}
                      </span>
                    </td>

                    <td style={td}>
                      <span
                        style={priorityStyle(
                          priority
                        )}
                      >
                        {priority}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}

function Card({ label, value }) {
  return (
    <div style={card}>
      <p style={cardLabel}>{label}</p>

      <strong style={cardValue}>
        {value}
      </strong>
    </div>
  );
}

function statusStyle(status) {
  if (status === "Delivered") {
    return {
      background: "#e8f7ee",
      color: "#16803c",
      padding: "6px 10px",
      borderRadius: "15px",
      fontSize: "12px",
      fontWeight: "600",
    };
  }

  return {
    background: "#e8f0ff",
    color: "#175cd3",
    padding: "6px 10px",
    borderRadius: "15px",
    fontSize: "12px",
    fontWeight: "600",
  };
}

function priorityStyle(priority) {
  if (priority === "High") {
    return {
      background: "#ffe8e8",
      color: "#b42318",
      padding: "6px 10px",
      borderRadius: "15px",
      fontSize: "12px",
      fontWeight: "600",
    };
  }

  if (priority === "Medium") {
    return {
      background: "#fff3cd",
      color: "#856404",
      padding: "6px 10px",
      borderRadius: "15px",
      fontSize: "12px",
      fontWeight: "600",
    };
  }

  return {
    background: "#e8f0ff",
    color: "#175cd3",
    padding: "6px 10px",
    borderRadius: "15px",
    fontSize: "12px",
    fontWeight: "600",
  };
}

const header = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "22px",
};

const cards = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: "18px",
  marginBottom: "22px",
};

const card = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
};

const cardLabel = {
  margin: "0 0 8px",
  color: "#667085",
  fontSize: "14px",
};

const cardValue = {
  fontSize: "28px",
};

const box = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  overflowX: "auto",
};

const tableHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "18px",
};

const subText = {
  margin: "6px 0 0",
  color: "#667085",
  fontSize: "13px",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
};

const th = {
  textAlign: "left",
  padding: "14px",
  background: "#f5f7fb",
  whiteSpace: "nowrap",
};

const td = {
  padding: "15px",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
};

const refreshButton = {
  border: "1px solid #d0d5dd",
  background: "#fff",
  padding: "8px 14px",
  borderRadius: "8px",
  cursor: "pointer",
};

const errorBox = {
  background: "#ffe8e8",
  color: "#b42318",
  padding: "12px 16px",
  borderRadius: "10px",
  marginBottom: "20px",
};

const emptyBox = {
  padding: "30px",
  textAlign: "center",
  color: "#667085",
};

export default SupplyChainDelayedDeliveries;