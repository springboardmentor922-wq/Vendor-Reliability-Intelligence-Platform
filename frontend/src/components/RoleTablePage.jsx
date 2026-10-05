import React from "react";
import DashboardLayout from "./DashboardLayout";

function RoleTablePage({
  title,
  subtitle,
  role,
  menuItems,
  cards = [],
  columns = [],
  data = [],
}) {
  return (
    <DashboardLayout
      title={title}
      role={role}
      menuItems={menuItems}
    >
      <div style={header}>
        <h2>{title}</h2>

        <p style={{ color: "#666", marginTop: "6px" }}>
          {subtitle}
        </p>
      </div>

      {/* Summary Cards */}
      {cards.length > 0 && (
        <div style={cardGrid}>
          {cards.map((card, index) => (
            <div style={cardBox} key={index}>
              <p>{card.label}</p>
              <h2>{card.value}</h2>
            </div>
          ))}
        </div>
      )}

      {/* Data Table */}
      <div style={tableBox}>
        <div style={{ marginBottom: "18px" }}>
          <h3>{title}</h3>
          <p style={{ color: "#777", marginTop: "5px" }}>
            {subtitle}
          </p>
        </div>

        {data.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  {columns.map((column, index) => (
                    <th key={index} style={th}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {data.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} style={td}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={emptyBox}>
            No records available.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

const header = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "22px",
};

const cardGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "18px",
  marginBottom: "22px",
};

const cardBox = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
};

const tableBox = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "700px",
};

const th = {
  textAlign: "left",
  padding: "14px",
  background: "#f5f7fb",
  borderBottom: "1px solid #e5e7eb",
};

const td = {
  padding: "14px",
  borderBottom: "1px solid #eee",
};

const emptyBox = {
  padding: "40px",
  textAlign: "center",
  color: "#777",
  background: "#f8f9fb",
  borderRadius: "10px",
};

export default RoleTablePage;