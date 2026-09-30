import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { RoleDashboard } from './components/modules/dashboard/RoleDashboard';
import { VendorManagementModule } from './components/modules/vendors/VendorManagementModule';
import { ProcurementModule } from './components/modules/procurement/ProcurementModule';
import { PerformanceModule } from './components/modules/performance/PerformanceModule';
import { ReliabilityRiskModule } from './components/modules/reliability/ReliabilityRiskModule';
import { ContractComplianceModule } from './components/modules/contracts/ContractComplianceModule';
import { CommunicationModule } from './components/modules/communication/CommunicationModule';
import { NotificationModule } from './components/modules/notifications/NotificationModule';
import { ReportsModule } from './components/modules/reports/ReportsModule';
import { DatasetUploadModule } from './components/modules/dataset/DatasetUploadModule';
import { AdminUserManagementModule } from './components/modules/admin/AdminUserManagementModule';
import { EnterprisePortal } from './components/landing/LandingPage';
import { AuthModal } from './components/auth/AuthModal';
import { CursorSpotlight } from './components/effects/CursorSpotlight';
import { UserRole } from './types';

const MainLayout: React.FC<{
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  onOpenDataset: () => void;
}> = ({ isMobileSidebarOpen, setIsMobileSidebarOpen, onOpenDataset }) => {
  const { currentModule } = useApp();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-sky-500 selection:text-white relative">
      {/* Top Navigation Bar */}
      <Navbar 
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)} 
        onOpenDatasetModal={onOpenDataset}
      />

      {/* Body Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Responsive Sidebar */}
        <Sidebar
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Dynamic Content Surface */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="max-w-7xl mx-auto">
            {currentModule === 'dashboard' && <RoleDashboard />}
            {currentModule === 'vendors' && <VendorManagementModule />}
            {currentModule === 'procurement' && <ProcurementModule />}
            {currentModule === 'performance' && <PerformanceModule />}
            {currentModule === 'reliability' && <ReliabilityRiskModule />}
            {currentModule === 'contracts' && <ContractComplianceModule />}
            {currentModule === 'communication' && <CommunicationModule />}
            {currentModule === 'notifications' && <NotificationModule />}
            {currentModule === 'reports' && <ReportsModule />}
            {currentModule === 'dataset' && <DatasetUploadModule />}
            {currentModule === 'admin-users' && <AdminUserManagementModule />}
          </div>
        </main>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { showLanding, setActiveView } = useApp();
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    mode: 'login' | 'register';
    defaultRole?: UserRole;
  }>({
    isOpen: false,
    mode: 'login',
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const openAuth = (mode: 'login' | 'register', defaultRole?: UserRole) => {
    setAuthModalState({ isOpen: true, mode, defaultRole });
  };

  const closeAuth = () => {
    setAuthModalState((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <>
      {/* Interactive Cursor Reactive Spotlight & Glow */}
      <CursorSpotlight />

      {/* Auth Modal (Login / Register / Persona Select) */}
      <AuthModal
        isOpen={authModalState.isOpen}
        onClose={closeAuth}
        initialMode={authModalState.mode}
        defaultRole={authModalState.defaultRole}
      />

      {/* Dynamic View: Overview Portal vs Authenticated Role Dashboard */}
      {showLanding ? (
        <EnterprisePortal onOpenAuth={openAuth} />
      ) : (
        <MainLayout
          isMobileSidebarOpen={isMobileSidebarOpen}
          setIsMobileSidebarOpen={setIsMobileSidebarOpen}
          onOpenDataset={() => setActiveView('dataset')}
        />
      )}
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
