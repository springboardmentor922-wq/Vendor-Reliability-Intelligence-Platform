import React from "react";

import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";

// ================= PUBLIC =================

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Unauthorized from "./pages/Unauthorized";

// ================= COMMON REPORTS =================

import Reports from "./pages/Reports";

// ================= DASHBOARDS =================

import AdminDashboard from "./pages/AdminDashboard";
import ProcurementDashboard from "./pages/ProcurementDashboard";
import SupplyChainDashboard from "./pages/SupplyChainDashboard";
import VendorDashboard from "./pages/VendorDashboard";
import FinanceDashboard from "./pages/FinanceDashboard";
import AuditorDashboard from "./pages/AuditorDashboard";

// ================= ADMIN =================

import AdminUsers from "./pages/AdminUsers";
import AdminVendors from "./pages/AdminVendors";
import AdminSuppliers from "./pages/AdminSuppliers";
import AdminProcurement from "./pages/AdminProcurement";
import AdminPurchaseOrders from "./pages/AdminPurchaseOrders";
import AdminRiskAnalysis from "./pages/AdminRiskAnalysis";
import AdminReports from "./pages/AdminReports";
import AdminSettings from "./pages/AdminSettings";
import AdminNotifications from "./pages/AdminNotifications";
import AdminContractCompliance from "./pages/AdminContractCompliance";

// ================= PROCUREMENT =================

import VendorPortal from "./pages/VendorPortal";
import ProcurementRequests from "./pages/ProcurementRequests";
import ProcurementPurchaseOrders from "./pages/ProcurementPurchaseOrders";
import ProcurementApprovals from "./pages/ProcurementApprovals";
import ProcurementPerformance from "./pages/ProcurementPerformance";
import ProcurementReports from "./pages/ProcurementReports";
import ProcurementNotifications from "./pages/ProcurementNotifications";

// ================= SUPPLY CHAIN =================

import Suppliers from "./pages/Suppliers";
import SupplyChainPurchaseOrders from "./pages/SupplyChainPurchaseOrders";
import SupplyChainDeliveries from "./pages/SupplyChainDeliveries";
import SupplyChainDelayedDeliveries from "./pages/SupplyChainDelayedDeliveries";
import SupplyChainPerformance from "./pages/SupplyChainPerformance";
import SupplyChainRisk from "./pages/SupplyChainRisk";

// ================= VENDOR =================

import VendorProfile from "./pages/VendorProfile";
import VendorPurchaseOrders from "./pages/VendorPurchaseOrders";
import VendorDeliveries from "./pages/VendorDeliveries";
import VendorDelayedDeliveries from "./pages/VendorDelayedDeliveries";
import VendorPerformance from "./pages/VendorPerformance";
import VendorRiskStatus from "./pages/VendorRiskStatus";
import VendorContracts from "./pages/VendorContracts";
import VendorCompliance from "./pages/VendorCompliance";
import VendorCommunications from "./pages/VendorCommunications";
import VendorNotifications from "./pages/VendorNotifications";

// ================= FINANCE =================

import FinancePurchaseOrders from "./pages/FinancePurchaseOrders";
import FinanceInvoices from "./pages/FinanceInvoices";
import FinancePayments from "./pages/FinancePayments";
import FinanceStatus from "./pages/FinanceStatus";
import FinanceReports from "./pages/FinanceReports";
import FinanceNotifications from "./pages/FinanceNotifications";

// ================= AUDITOR =================

import AuditorRecords from "./pages/AuditorRecords";
import AuditorVendors from "./pages/AuditorVendors";
import AuditorProcurement from "./pages/AuditorProcurement";
import AuditorRiskAssessments from "./pages/AuditorRiskAssessments";
import AuditorPerformance from "./pages/AuditorPerformance";
import AuditorReports from "./pages/AuditorReports";

// ================= COMMON =================

import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";

// ============================================================
// ROLE CONFIGURATION
// ============================================================

const roleConfigs = {
  administrator: {
    allowedRole: "administrator",
    displayRole: "Administrator",

    menuItems: [
      "Dashboard",
      "Users",
      "Vendors",
      "Suppliers",
      "Procurement",
      "Purchase Orders",
      "Risk Analysis",
      "Contract & Compliance",
      "Reports",
      "Settings",
      "Notifications",
    ],

    routes: [
      ["/admin-dashboard", AdminDashboard],
      ["/admin-users", AdminUsers],
      ["/admin-vendors", AdminVendors],
      ["/admin-suppliers", AdminSuppliers],
      ["/admin-procurement", AdminProcurement],
      ["/admin-purchase-orders", AdminPurchaseOrders],
      ["/admin-risk-analysis", AdminRiskAnalysis],
      ["/admin-contract-compliance", AdminContractCompliance],
      ["/admin-reports", AdminReports],
      ["/admin-settings", AdminSettings],
      ["/admin-notifications", AdminNotifications],
    ],
  },

  procurement_manager: {
    allowedRole: "procurement_manager",
    displayRole: "Procurement Manager",

    menuItems: [
      "Dashboard",
      "Vendors",
      "Requests",
      "Purchase Orders",
      "Approvals",
      "Performance",
      "Reports",
      "Notifications",
    ],

    routes: [
      ["/procurement-dashboard", ProcurementDashboard],
      ["/vendor-portal", VendorPortal],
      ["/procurement-requests", ProcurementRequests],
      ["/procurement-purchase-orders", ProcurementPurchaseOrders],
      ["/procurement-approvals", ProcurementApprovals],
      ["/procurement-performance", ProcurementPerformance],
      ["/procurement-reports", ProcurementReports],
      ["/procurement-notifications", ProcurementNotifications],
    ],
  },

  supply_chain_manager: {
    allowedRole: "supply_chain_manager",
    displayRole: "Supply Chain Manager",

    menuItems: [
      "Dashboard",
      "Suppliers",
      "Purchase Orders",
      "Deliveries",
      "Delayed Deliveries",
      "Performance",
      "Risk",
    ],

    routes: [
      ["/supply-chain-dashboard", SupplyChainDashboard],
      ["/supply-chain-suppliers", Suppliers],
      ["/supply-chain-purchase-orders", SupplyChainPurchaseOrders],
      ["/supply-chain-deliveries", SupplyChainDeliveries],
      ["/supply-chain-delayed-deliveries", SupplyChainDelayedDeliveries],
      ["/supply-chain-performance", SupplyChainPerformance],
      ["/supply-chain-risk", SupplyChainRisk],
    ],
  },

  vendor: {
    allowedRole: "vendor",
    displayRole: "Vendor",

    menuItems: [
      "Dashboard",
      "Profile",
      "Purchase Orders",
      "Deliveries",
      "Delayed Deliveries",
      "Performance",
      "Risk Status",
      "Contracts",
      "Compliance",
      "Communications",
      "Notifications",
    ],

    routes: [
      ["/vendor-dashboard", VendorDashboard],
      ["/vendor-profile", VendorProfile],
      ["/vendor-purchase-orders", VendorPurchaseOrders],
      ["/vendor-deliveries", VendorDeliveries],
      ["/vendor-delayed-deliveries", VendorDelayedDeliveries],
      ["/vendor-performance", VendorPerformance],
      ["/vendor-risk-status", VendorRiskStatus],
      ["/vendor-contracts", VendorContracts],
      ["/vendor-compliance", VendorCompliance],
      ["/vendor-communications", VendorCommunications],
      ["/vendor-notifications", VendorNotifications],
    ],
  },

  finance_officer: {
    allowedRole: "finance_officer",
    displayRole: "Finance Officer",

    menuItems: [
      "Dashboard",
      "Purchase Orders",
      "Invoices",
      "Payments",
      "Status",
      "Reports",
      "Notifications",
    ],

    routes: [
      ["/finance-dashboard", FinanceDashboard],
      ["/finance-purchase-orders", FinancePurchaseOrders],
      ["/finance-invoices", FinanceInvoices],
      ["/finance-payments", FinancePayments],
      ["/finance-status", FinanceStatus],
      ["/finance-reports", FinanceReports],
      ["/finance-notifications", FinanceNotifications],
    ],
  },

  auditor: {
    allowedRole: "auditor",
    displayRole: "Auditor",

    menuItems: [
      "Dashboard",
      "Records",
      "Vendors",
      "Procurement",
      "Risk Assessments",
      "Performance",
      "Reports",
    ],

    routes: [
      ["/auditor-dashboard", AuditorDashboard],
      ["/auditor-records", AuditorRecords],
      ["/auditor-vendors", AuditorVendors],
      ["/auditor-procurement", AuditorProcurement],
      ["/auditor-risk-assessments", AuditorRiskAssessments],
      ["/auditor-performance", AuditorPerformance],
      ["/auditor-reports", AuditorReports],
    ],
  },
};

// ============================================================
// ROLE SHELL
// ============================================================

function RoleShell({ config }) {
  return (
    <ProtectedRoute allowedRole={config.allowedRole}>
      <DashboardLayout
        role={config.displayRole}
        menuItems={config.menuItems}
      >
        <Outlet />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

// ============================================================
// APP
// ============================================================

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ================= PUBLIC ================= */}

        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />

        <Route path="/register" element={<Register />} />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/unauthorized"
          element={<Unauthorized />}
        />

        {/* ================= COMMON PROTECTED REPORTS ================= */}

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />

        {/* ================= ROLE ROUTES ================= */}

        {Object.values(roleConfigs).map((config) => (
          <Route
            key={config.allowedRole}
            element={<RoleShell config={config} />}
          >
            {config.routes.map(([path, Component]) => (
              <Route
                key={path}
                path={path}
                element={<Component />}
              />
            ))}
          </Route>
        ))}

        {/* ================= FALLBACK ================= */}

        <Route
          path="*"
          element={<Unauthorized />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;