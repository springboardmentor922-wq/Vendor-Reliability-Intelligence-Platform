import { useAuth } from "../../context/AuthContext";
import AppLayout from "../../components/layout/AppLayout";

export default function DashboardPage() {
  const { currentUser } = useAuth();

  return (
    <AppLayout>
      <h1>Welcome, {currentUser?.full_name}</h1>
      <p>Role: {currentUser?.role}</p>

      {/* TODO: swap this out for role-specific dashboard content
          (Procurement Dashboard / Vendor Dashboard / Admin Dashboard
          per the spec doc, Module 8) */}
      <p>Dashboard content goes here.</p>
    </AppLayout>
  );
}
