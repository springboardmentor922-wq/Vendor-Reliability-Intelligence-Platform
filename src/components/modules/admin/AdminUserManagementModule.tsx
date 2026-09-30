import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Trash2, 
  Key, 
  Search, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  Filter,
  Building2,
  Lock,
  Mail,
  User
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { UserRole, VendorCategory } from '../../../types';
import { Badge } from '../../common/Badge';
import { UserAvatar } from '../../common/UserAvatar';

export const AdminUserManagementModule: React.FC = () => {
  const { 
    users, 
    toggleUserStatus, 
    updateUserRole, 
    createUser, 
    deleteUser, 
    switchAccountToRole, 
    currentUser 
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Procurement Manager');
  const [newCompany, setNewCompany] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newCategory, setNewCategory] = useState<VendorCategory>('Raw Material Suppliers');
  const [formError, setFormError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newUsername.trim() || !newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setFormError('Please fill in all required fields.');
      return;
    }

    const res = createUser({
      username: newUsername.trim(),
      name: newName.trim(),
      email: newEmail.trim(),
      password: newPassword.trim(),
      role: newRole,
      companyName: newCompany.trim() || undefined,
      department: newDepartment.trim() || undefined,
      vendorCategory: newRole === 'Vendor' ? newCategory : undefined,
    });

    if (res.success) {
      setSuccessNotice(`User account "${newName}" successfully created with role ${newRole}.`);
      setIsCreateModalOpen(false);
      setNewUsername('');
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewCompany('');
      setNewDepartment('');
    } else {
      setFormError(res.error || 'Failed to create user account.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesQuery = 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.companyName && u.companyName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

    return matchesQuery && matchesRole;
  });

  const activeCount = users.filter(u => u.status === 'Active').length;
  const suspendedCount = users.filter(u => u.status === 'Suspended').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Enterprise User & Identity Management</h1>
            <Badge variant="purple" size="sm">Role-Based Access Control</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage authorized staff identities across all 6 procurement intelligence roles. Configure access credentials, assign responsibilities, and oversee governance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Create User Account</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-800/80 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-400 font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Accounts</span>
          <p className="text-2xl font-black text-white font-mono mt-1">{users.length}</p>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Configured profiles</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Active Users</span>
          <p className="text-2xl font-black text-emerald-400 font-mono mt-1">{activeCount}</p>
          <span className="text-[10px] text-emerald-400/80 mt-0.5 block">Full system access</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Suspended</span>
          <p className="text-2xl font-black text-rose-400 font-mono mt-1">{suspendedCount}</p>
          <span className="text-[10px] text-rose-400/80 mt-0.5 block">Access revoked</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Distinct Roles</span>
          <p className="text-2xl font-black text-sky-400 font-mono mt-1">6 Roles</p>
          <span className="text-[10px] text-sky-400/80 mt-0.5 block">Zero cross-role leakage</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, role, or unit..."
            className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Roles ({users.length})</option>
            <option value="Administrator">Administrator</option>
            <option value="Procurement Manager">Procurement Manager</option>
            <option value="Supply Chain Manager">Supply Chain Manager</option>
            <option value="Vendor">Vendor</option>
            <option value="Finance Officer">Finance Officer</option>
            <option value="Auditor">Auditor</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">User Identity</th>
                <th className="py-3.5 px-4">System Role</th>
                <th className="py-3.5 px-4">Organization / Unit</th>
                <th className="py-3.5 px-4">Access Status</th>
                <th className="py-3.5 px-4 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.map((u) => {
                const isCurrent = u.id === currentUser.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Identity & Avatar */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={u.name} role={u.role} size="md" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-sm">{u.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] font-mono bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono">@{u.username} • {u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role selector dropdown */}
                    <td className="py-3 px-4">
                      <select
                        value={u.role}
                        disabled={isCurrent}
                        onChange={(e) => updateUserRole(u.id, e.target.value as UserRole)}
                        className="rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500 disabled:opacity-70 cursor-pointer"
                      >
                        <option value="Administrator">Administrator</option>
                        <option value="Procurement Manager">Procurement Manager</option>
                        <option value="Supply Chain Manager">Supply Chain Manager</option>
                        <option value="Vendor">Vendor</option>
                        <option value="Finance Officer">Finance Officer</option>
                        <option value="Auditor">Auditor</option>
                      </select>
                    </td>

                    {/* Organization / Dept */}
                    <td className="py-3 px-4">
                      <div className="text-slate-300">
                        {u.companyName ? (
                          <div className="flex items-center gap-1 text-emerald-400 font-medium">
                            <Building2 className="h-3 w-3" />
                            <span>{u.companyName}</span>
                          </div>
                        ) : u.department ? (
                          <span>{u.department}</span>
                        ) : (
                          <span className="text-slate-500">Corporate HQ</span>
                        )}
                        {u.vendorCategory && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {u.vendorCategory}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status toggle button */}
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        disabled={isCurrent}
                        onClick={() => toggleUserStatus(u.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          u.status === 'Active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                        } ${isCurrent ? 'opacity-60 cursor-not-allowed' : ''}`}
                        title={isCurrent ? 'Cannot suspend active logged-in administrator' : 'Click to toggle status'}
                      >
                        {u.status === 'Active' ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" />
                            <span>Suspended</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions: View Role Cockpit & Delete */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Switch operational session to ${u.name} (${u.role})? You will need to log out to return to your Administrator account.`)) {
                                switchAccountToRole(u.role, u.id);
                              }
                            }}
                            className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-sky-400 border border-slate-700 hover:border-sky-500/40 transition-colors flex items-center gap-1 cursor-pointer"
                            title={`Log into ${u.name}'s account (${u.role})`}
                          >
                            <span>Log In As User</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        )}

                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Are you sure you want to permanently delete user account "${u.name}"?`)) {
                                deleteUser(u.id);
                              }
                            }}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete User"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create User Account */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div 
            className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create Enterprise User</h3>
                  <p className="text-xs text-slate-400">Configure role identity and credentials</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. admin_ops"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Enterprise Admin"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Enterprise Email *
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="admin_ops@enterprise.com"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Temporary Password *
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Assign Organizational Role *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Administrator">Administrator (Platform & Governance Ops)</option>
                  <option value="Procurement Manager">Procurement Manager (Purchasing, POs, Approvals)</option>
                  <option value="Supply Chain Manager">Supply Chain Manager (Logistics, Supplier Reliability)</option>
                  <option value="Vendor">Vendor (Authorized Supplier Cockpit)</option>
                  <option value="Finance Officer">Finance Officer (Invoicing, Accounts Payable)</option>
                  <option value="Auditor">Auditor (Compliance & Certification Audits)</option>
                </select>
              </div>

              {newRole === 'Vendor' ? (
                <div className="space-y-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Supplier / Enterprise Name *
                    </label>
                    <input
                      type="text"
                      value={newCompany}
                      onChange={(e) => setNewCompany(e.target.value)}
                      placeholder="e.g. Apex Precision Metals Ltd."
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Vendor Supply Category *
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as VendorCategory)}
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Raw Material Suppliers">Raw Material Suppliers</option>
                      <option value="Equipment Vendors">Equipment Vendors</option>
                      <option value="IT Vendors">IT Vendors</option>
                      <option value="Service Providers">Service Providers</option>
                      <option value="Logistics Partners">Logistics Partners</option>
                      <option value="Maintenance Vendors">Maintenance Vendors</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Department / Business Unit
                  </label>
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="e.g. Global Strategic Procurement"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  Create User Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
