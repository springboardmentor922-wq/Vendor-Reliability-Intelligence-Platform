import React from 'react';
import {
  LayoutDashboard,
  Building2,
  ShoppingCart,
  TrendingUp,
  ShieldAlert,
  FileCheck2,
  MessageSquareQuote,
  BellRing,
  FileSpreadsheet,
  DatabaseZap,
  Users,
  HardDriveUpload,
  Receipt,
  FileText,
  LogOut
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SidebarProps {
  onOpenDatasetModal?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenDatasetModal }) => {
  const { activeView, setActiveView, currentRole, unreadNotificationCount, logout } = useApp();

  const isVendor = currentRole === 'Vendor';

  // Vendor navigation
  const vendorNavItems = [
    {
      id: 'dashboard',
      label: 'Supplier Portal',
      icon: LayoutDashboard,
      badge: 'Vendor',
    },
    {
      id: 'vendors',
      label: 'Vendor Management',
      icon: Building2,
    },
    {
      id: 'procurement',
      label: 'Orders & Invoices',
      icon: ShoppingCart,
    },
    {
      id: 'contracts',
      label: 'Contracts & Compliance',
      icon: FileCheck2,
    },
    {
      id: 'communication',
      label: 'Communication Hub',
      icon: MessageSquareQuote,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: BellRing,
      unread: unreadNotificationCount,
    },
  ];

  // Enterprise staff navigation
  const enterpriseNavItems = [
    {
      id: 'dashboard',
      label: 'Role Dashboard',
      icon: LayoutDashboard,
      badge: currentRole.split(' ')[0],
    },
    {
      id: 'vendors',
      label: 'Vendor Management',
      icon: Building2,
    },
    {
      id: 'procurement',
      label: 'Procurement & Orders',
      icon: ShoppingCart,
    },
    {
      id: 'performance',
      label: 'Vendor Performance',
      icon: TrendingUp,
    },
    {
      id: 'reliability',
      label: 'Reliability & AI Risk',
      icon: ShieldAlert,
    },
    {
      id: 'contracts',
      label: 'Contract & Compliance',
      icon: FileCheck2,
    },
    {
      id: 'communication',
      label: 'Communication Hub',
      icon: MessageSquareQuote,
    },
    {
      id: 'notifications',
      label: 'Notification Center',
      icon: BellRing,
      unread: unreadNotificationCount,
    },
    {
      id: 'reports',
      label: 'Reports & Export',
      icon: FileSpreadsheet,
    },
    {
      id: 'dataset',
      label: 'Dataset Intelligence',
      icon: DatabaseZap,
    },
  ];

  if (currentRole === 'Administrator') {
    enterpriseNavItems.push({
      id: 'admin-users',
      label: 'User & System Control',
      icon: Users,
    });
  }

  const navItems = isVendor ? vendorNavItems : enterpriseNavItems;

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between hidden md:flex min-h-[calc(100vh-4rem)]">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {isVendor ? 'Supplier Workspace' : 'Navigation Modules'}
          </p>
          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30 shadow-sm'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 transition-colors ${
                        isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-300'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                      {item.badge}
                    </span>
                  )}

                  {item.unread && item.unread > 0 ? (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                      {item.unread}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Dataset Quick Action Card - Only shown to enterprise roles */}
        {!isVendor && (
          <div className="rounded-xl border border-sky-500/20 bg-gradient-to-b from-sky-950/40 to-slate-900/60 p-3.5 text-left">
            <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs mb-1">
              <HardDriveUpload className="h-4 w-4" />
              <span>Dataset Ingestion</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
              Upload custom vendor or supply chain datasets (CSV) to retrain predictive late delivery models.
            </p>
            <button
              onClick={onOpenDatasetModal}
              className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 px-2.5 py-1.5 text-xs font-bold text-white transition-colors text-center shadow-sm cursor-pointer"
            >
              Import CSV File
            </button>
          </div>
        )}
      </div>

      {/* Role & System badge footer */}
      <div className="border-t border-slate-800/80 pt-3 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Role Access</span>
          <span className="flex items-center gap-1 text-emerald-400 font-mono font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {currentRole}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>Security Boundary</span>
          <span className="font-mono">{isVendor ? 'Company Isolated' : 'Enterprise Level'}</span>
        </div>
        <button
          onClick={logout}
          className="w-full mt-1.5 flex items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-950/20 hover:bg-rose-900/40 py-2 px-3 text-xs font-semibold text-rose-300 transition-colors cursor-pointer"
          title="Sign out in order to view another person's dashboard"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out / Switch User</span>
        </button>
      </div>
    </aside>
  );
};
