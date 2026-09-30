import React, { useState } from 'react';
import { 
  ShieldCheck, 
  X, 
  Lock, 
  User as UserIcon, 
  Mail, 
  Building2, 
  Briefcase, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole, VendorCategory } from '../../types';
import { Badge } from '../common/Badge';
import { UserAvatar } from '../common/UserAvatar';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  defaultRole?: UserRole;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  defaultRole = 'Administrator',
}) => {
  const { login, register, switchAccountToRole, setActiveView } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('password123');

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(defaultRole);
  const [regCompany, setRegCompany] = useState('');
  const [regDepartment, setRegDepartment] = useState('');
  const [regCategory, setRegCategory] = useState<VendorCategory>('Raw Material Suppliers');

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setError('Please enter both username/email and password.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const res = login(loginIdentifier, loginPassword);
      setLoading(false);
      if (res.success) {
        onClose();
      } else {
        setError(res.error || 'Failed to authenticate.');
      }
    }, 200);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!regUsername.trim() || !regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (regRole === 'Vendor' && !regCompany.trim()) {
      setError('Please specify your Supplier/Company name.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const res = register({
        username: regUsername,
        name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        companyName: regCompany,
        department: regDepartment,
        vendorCategory: regCategory,
      });
      setLoading(false);
      if (res.success) {
        onClose();
      } else {
        setError(res.error || 'Registration failed.');
      }
    }, 250);
  };

  const verifiedAccounts: { role: UserRole; username: string; name: string; tag: string }[] = [
    { role: 'Administrator', username: 'admin', name: 'Administrator', tag: 'Full Control' },
    { role: 'Procurement Manager', username: 'procurement', name: 'Procurement Manager', tag: 'Sourcing & POs' },
    { role: 'Supply Chain Manager', username: 'supplychain', name: 'Supply Chain Manager', tag: 'Logistics Radar' },
    { role: 'Vendor', username: 'vendor', name: 'Vendor', tag: 'Supplier Portal' },
    { role: 'Finance Officer', username: 'finance', name: 'Finance Officer', tag: 'Invoices & AP' },
    { role: 'Auditor', username: 'auditor', name: 'Auditor', tag: 'Certifications' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl shadow-sky-950/50 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500" />

        {/* Top Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 shadow-md shadow-sky-500/20">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white tracking-tight">VendorIQ Platform Access</h3>
                <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-400 border border-sky-500/20">SSO</span>
              </div>
              <p className="text-xs text-slate-400">Authenticate or register your operational credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Toggle: Log In vs Create Account */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-950/70 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`rounded-lg py-2 text-xs font-bold transition-all ${
                mode === 'login'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In to Dashboard
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className={`rounded-lg py-2 text-xs font-bold transition-all ${
                mode === 'register'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create New Account
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'login' ? (
            /* LOGIN FORM */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Username or Corporate Email
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. admin or procurement"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  <span className="text-[11px] text-slate-500">Default: password123</span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 py-3 text-xs font-bold text-white shadow-lg shadow-sky-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <>
                    <span>Enter Role Dashboard</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {/* Quick 1-Click Access for Vendors (No password or username entry required) */}
              <div className="pt-3 border-t border-slate-800/80 space-y-3">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-emerald-400" />
                      Direct Vendor Portal & Directory Access
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      No Password Required
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Click below to immediately enter the Vendor Workspace with full categorical partitions (Raw Material, Equipment, IT, Services, Logistics & Maintenance).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      switchAccountToRole('Vendor');
                      setActiveView('vendors');
                      onClose();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-900/40 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Enter Vendors Page (All Categories)</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Verified Enterprise Role Access */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 mb-2">
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Executive & Enterprise Role Identities</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-left">
                    {verifiedAccounts.map((acc) => (
                      <button
                        key={acc.username}
                        type="button"
                        onClick={() => {
                          if (acc.role === 'Vendor') {
                            switchAccountToRole('Vendor');
                            setActiveView('vendors');
                          } else {
                            login(acc.username, 'password123');
                          }
                          onClose();
                        }}
                        className="group p-2 rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-sky-500/50 hover:bg-slate-800/60 transition-all text-left flex items-start gap-2 cursor-pointer"
                      >
                        <UserAvatar name={acc.role} role={acc.role} size="sm" showRoleIconBadge={false} />
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] font-bold text-white group-hover:text-sky-300 truncate block">
                            {acc.role}
                          </span>
                          <span className="inline-block mt-0.5 text-[9px] font-semibold text-sky-400 bg-sky-500/10 px-1 py-0.2 rounded">
                            {acc.tag}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </form>
          ) : (
            /* REGISTER FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. jdoe_materials"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Work Email *
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="john@company.com"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Create secure password"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Assign Account Operational Role *
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as UserRole)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-sky-400 font-semibold focus:outline-none focus:border-sky-500"
                >
                  <option value="Vendor">Vendor (Self-Service Supplier Portal)</option>
                  <option value="Procurement Manager">Procurement Manager (Sourcing & PO Approvals)</option>
                  <option value="Supply Chain Manager">Supply Chain Manager (Logistics & Risk Radar)</option>
                  <option value="Administrator">Administrator (Platform & System Health)</option>
                  <option value="Finance Officer">Finance Officer (Accounts Payable & Invoices)</option>
                  <option value="Auditor">Auditor (Compliance & ISO Certifications)</option>
                </select>
              </div>

              {/* Conditional fields based on role */}
              {regRole === 'Vendor' ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Vendor Profile & Classification</span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-300 mb-1">
                      Supplier / Enterprise Company Name *
                    </label>
                    <input
                      type="text"
                      value={regCompany}
                      onChange={(e) => setRegCompany(e.target.value)}
                      placeholder="e.g. Apex Microelectronics Ltd."
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-300 mb-1">
                      Supply Category
                    </label>
                    <select
                      value={regCategory}
                      onChange={(e) => setRegCategory(e.target.value as VendorCategory)}
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Raw Material Suppliers">Raw Material Suppliers</option>
                      <option value="Equipment Vendors">Equipment Vendors</option>
                      <option value="IT Vendors">IT Vendors</option>
                      <option value="Service Providers">Service Providers</option>
                      <option value="Logistics Partners">Logistics Partners</option>
                      <option value="Maintenance Vendors">Maintenance Vendors</option>
                    </select>
                  </div>
                  <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/20 p-2 text-[10px] text-emerald-300">
                    <span className="font-semibold text-emerald-200">Notice:</span> New vendors enter as <span className="font-bold text-amber-300">Pending Verification</span> awaiting administrative approval and compliance onboarding.
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Department / Business Unit
                  </label>
                  <input
                    type="text"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    placeholder="e.g. Global Strategic Procurement"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <>
                    <UserCheck className="h-4 w-4" />
                    <span>Create Account & Enter Portal</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
