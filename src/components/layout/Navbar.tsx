import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Bell, 
  UploadCloud, 
  RefreshCw, 
  ChevronDown, 
  UserCheck, 
  Menu,
  Home,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { Badge } from '../common/Badge';
import { UserAvatar } from '../common/UserAvatar';

export const Navbar: React.FC<{ 
  onOpenDatasetModal?: () => void;
  onToggleMobileSidebar?: () => void;
}> = ({ onOpenDatasetModal, onToggleMobileSidebar }) => {
  const {
    currentRole,
    setCurrentRole,
    currentUser,
    unreadNotificationCount,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    setActiveView,
    resetToDefaultData,
    vendors,
    currentVendorId,
    setCurrentVendorId,
    setShowLanding,
    logout,
  } = useApp();

  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-800/90 bg-slate-950/80 px-4 sm:px-6 backdrop-blur-md">
      {/* Brand & Mobile Hamburger */}
      <div className="flex items-center gap-3">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div 
          onClick={() => setActiveView('dashboard')}
          className="flex cursor-pointer items-center gap-2.5 group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-500 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-white font-mono">VendorIQ</span>
              <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400 border border-sky-500/20">ENTERPRISE</span>
            </div>
            <p className="text-[10px] text-slate-400 -mt-0.5 hidden sm:block">Predictive Vendor Intelligence & Risk Platform</p>
          </div>
        </div>

        {/* Current Active Vendor Indicator if in Vendor role */}
        {currentRole === 'Vendor' && (
          <div className="ml-2 pl-3 border-l border-slate-800 hidden md:flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Supplier:</span>
            <div className="rounded-lg bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-300 font-bold flex items-center gap-1.5">
              <span>{currentUser.companyName || vendors.find(v => v.id === currentVendorId)?.name || 'Authorized Supplier'}</span>
              <span className="text-[10px] text-emerald-400/80 font-mono font-normal">({currentVendorId})</span>
            </div>
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Overview Portal Link */}
        <button
          onClick={() => setShowLanding(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors shadow-sm cursor-pointer"
          title="Return to Platform Overview Portal"
        >
          <Home className="h-3.5 w-3.5 text-sky-400" />
          <span className="hidden lg:inline">Overview Portal</span>
        </button>

        {/* Upload Dataset Button */}
        {onOpenDatasetModal && (
          <button
            onClick={onOpenDatasetModal}
            className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-300 transition-colors shadow-sm"
            title="Upload custom dataset (CSV/Excel) to benchmark vendor intelligence"
          >
            <UploadCloud className="h-4 w-4" />
            <span className="hidden sm:inline">Upload Dataset</span>
          </button>
        )}

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-slate-950 animate-pulse">
                {unreadNotificationCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl z-50">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">Notifications</h4>
                  {unreadNotificationCount > 0 && (
                    <Badge variant="danger" size="sm">{unreadNotificationCount} new</Badge>
                  )}
                </div>
                <button
                  onClick={() => {
                    markAllNotificationsRead();
                    setShowNotifMenu(false);
                  }}
                  className="text-xs text-sky-400 hover:underline"
                >
                  Mark all read
                </button>
              </div>

              <div className="divide-y divide-slate-800/80 max-h-72 overflow-y-auto my-2">
                {notifications.slice(0, 6).map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      markNotificationRead(notif.id);
                      setActiveView('notifications');
                      setShowNotifMenu(false);
                    }}
                    className={`py-2.5 px-2 hover:bg-slate-800/60 rounded-lg cursor-pointer transition-colors ${
                      !notif.read ? 'bg-slate-800/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">
                        {notif.severity === 'error' ? (
                          <AlertTriangle className="h-4 w-4 text-rose-400" />
                        ) : notif.severity === 'warning' ? (
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-sky-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-baseline">
                          <p className={`text-xs ${!notif.read ? 'font-semibold text-white' : 'text-slate-300'}`}>
                            {notif.title}
                          </p>
                          <span className="text-[10px] text-slate-500">{notif.timestamp.split(' ')[1]}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{notif.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-800 pt-2 text-center">
                <button
                  onClick={() => {
                    setActiveView('notifications');
                    setShowNotifMenu(false);
                  }}
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300"
                >
                  View All Notifications →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Role Identity Display (Locked to Authenticated Session - No Dropdown) */}
        <div 
          className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 shadow-inner"
          title="Role is locked to your authenticated session. Log out in order to switch users or view another dashboard."
        >
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] uppercase font-semibold text-slate-400 leading-none">Role View</p>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1 rounded">Locked</span>
            </div>
            <p className="text-xs font-bold text-white leading-tight">{currentRole}</p>
          </div>
        </div>

        {/* Prominent Sign Out Button */}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-950/40 hover:bg-rose-900/60 px-3 py-1.5 text-xs font-bold text-rose-300 hover:text-rose-200 transition-colors shadow-sm cursor-pointer"
          title="Sign out to view another person's dashboard"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>

        {/* User Profile & Sign Out Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <UserAvatar name={currentUser.role} role={currentUser.role} size="sm" />
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-white leading-tight">{currentUser.role}</p>
              <p className="text-[10px] text-slate-400 leading-none truncate max-w-[100px]">{currentUser.companyName || currentUser.department || 'Active Account'}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-800 bg-slate-900 p-3 shadow-2xl z-50">
              <div className="px-2 py-2 border-b border-slate-800">
                <p className="text-xs font-bold text-white">{currentUser.role}</p>
                <p className="text-[11px] text-slate-400 font-mono truncate">{currentUser.email}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge variant="primary" size="sm">{currentUser.role}</Badge>
                  {currentUser.department && (
                    <span className="text-[10px] text-slate-400 truncate">{currentUser.department}</span>
                  )}
                </div>
              </div>

              <div className="p-1 mt-1 space-y-1">
                <button
                  onClick={() => {
                    setShowLanding(true);
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
                >
                  <Home className="h-3.5 w-3.5 text-sky-400" />
                  <span>Public Landing Page</span>
                </button>

                {currentRole === 'Administrator' && (
                  <button
                    onClick={() => {
                      if (confirm('Restore application data back to realistic initial baseline state?')) {
                        resetToDefaultData();
                        setShowUserMenu(false);
                      }
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-rose-400 flex items-center gap-2"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                    <span>Restore Baseline Data</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-950/40 flex items-center gap-2"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

