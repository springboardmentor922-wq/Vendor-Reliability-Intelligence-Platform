import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Vendors } from './pages/Vendors';
import { Procurement } from './pages/Procurement';
import { Contracts } from './pages/Contracts';
import { Analytics } from './pages/Analytics';
import { Reports } from './pages/Reports';
import { Communication } from './pages/Communication';
import { AuditLogs } from './pages/AuditLogs';
import { VendorPortal } from './pages/VendorPortal';
import { StaffManagement } from './pages/StaffManagement';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Standalone Landing & Auth Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/signup" element={<Register />} />

          {/* Embedded Platform Shell with Left Sidebar Column */}
          <Route element={<AppLayout />}>
            {/* Vendor Portal - Embedded with Sidebar Column */}
            <Route path="/vendor-portal" element={<VendorPortal />} />

            {/* Authenticated Dashboard & Module Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/procurement" element={<Procurement />} />
              <Route path="/purchase-orders" element={<Navigate to="/procurement?tab=orders" replace />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/messages" element={<Communication />} />
            </Route>

            {/* Role-Restricted Routes: Admin Only */}
            <Route element={<ProtectedRoute allowedRoles={['Administrator']} />}>
              <Route path="/staff" element={<StaffManagement />} />
            </Route>

            {/* Role-Restricted Routes (Admin & Auditor) */}
            <Route element={<ProtectedRoute allowedRoles={['Administrator', 'Auditor']} />}>
              <Route path="/audit-logs" element={<AuditLogs />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
