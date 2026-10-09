import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import WorkspacePage, { pageRoles } from './pages/WorkspacePage';
import Shell from './components/Shell';
import { useAuth } from './lib/auth';

function ProtectedShell() {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="loader-ring" /><span>Loading VendorIQ…</span></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Shell />;
}

function RoleGate({ page }: { page: string }) {
  const { hasRole } = useAuth();
  const roles = pageRoles[page];
  if (roles && !hasRole(roles)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <WorkspacePage page={page} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedShell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {Object.keys(pageRoles).map((page) => (
          <Route
            key={page}
            path={`/${page}`}
            element={<RoleGate page={page} />}
          />
        ))}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
