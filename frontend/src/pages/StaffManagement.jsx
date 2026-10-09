import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const StaffManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [roleLoadingId, setRoleLoadingId] = useState(null);
  const [staffMsg, setStaffMsg] = useState(null);

  const isAdmin = user?.role === 'Administrator';

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getUsers();
      setUsers(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load staff directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (targetUserId, newRole) => {
    setRoleLoadingId(targetUserId);
    setStaffMsg(null);
    try {
      const updated = await api.updateUserRole(targetUserId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === targetUserId ? { ...u, role: updated.role } : u)));
      setStaffMsg({
        type: 'success',
        text: `Role for ${updated.full_name} successfully updated to ${updated.role}.`
      });
    } catch (err) {
      setStaffMsg({
        type: 'error',
        text: `Role update failed: ${err.message}`
      });
    } finally {
      setRoleLoadingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const internal = users.filter((u) => u.role !== 'Vendor').length;
    const admins = users.filter((u) => u.role === 'Administrator').length;
    const vendors = users.filter((u) => u.role === 'Vendor').length;
    return { total, internal, admins, vendors };
  }, [users]);

  return (
    <div className="staff-management-page">
      
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              
              <span>Staff Management & Role Promotions</span>
            </h1>
            <p className="page-subtitle" style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
              Promote or reassign internal staff roles. Vendor accounts are protected to maintain supplier isolation.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              className="badge"
              style={{
                background: isAdmin ? '#edfbf5' : '#f0fdfa',
                color: isAdmin ? '#0d7658' : '#0f766e',
                border: `1px solid ${isAdmin ? '#a7edd1' : '#99f6e4'}`,
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isAdmin ? 'Admin Authorization Active' : 'Staff Directory View'}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={fetchUsers}
              disabled={loading}
              title="Refresh Staff List"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>↻</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        <div className="card" style={{ padding: '16px 20px', margin: 0 }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Accounts</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Registered in database</div>
        </div>

        <div className="card" style={{ padding: '16px 20px', margin: 0 }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Internal Staff</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#145e47', marginTop: '4px' }}>
            {stats.internal}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Operational personnel</div>
        </div>

        <div className="card" style={{ padding: '16px 20px', margin: 0 }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Administrators</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
            {stats.admins}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Full privilege tier</div>
        </div>

        <div className="card" style={{ padding: '16px 20px', margin: 0 }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>External Suppliers</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#6366f1', marginTop: '4px' }}>
            {stats.vendors}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Isolated vendor accounts</div>
        </div>
      </div>

      
      <div className="card" style={{ margin: 0 }}>
        
        <div
          className="card-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
            padding: '16px 20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '260px' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search staff by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  fontSize: '13px',
                  padding: '7px 12px',
                  borderRadius: '6px'
                }}
              />
            </div>

            <select
              className="form-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                width: 'auto',
                minWidth: '180px',
                fontSize: '13px',
                padding: '7px 12px',
                borderRadius: '6px'
              }}
            >
              <option value="ALL">All Roles ({users.length})</option>
              <option value="Administrator">Administrator</option>
              <option value="Procurement Manager">Procurement Manager</option>
              <option value="Supply Chain Manager">Supply Chain Manager</option>
              <option value="Finance Officer">Finance Officer</option>
              <option value="Auditor">Auditor</option>
              <option value="Vendor">Vendor</option>
            </select>
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> staff accounts
          </div>
        </div>

        
        {staffMsg && (
          <div
            style={{
              margin: '14px 20px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: staffMsg.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
              border: `1px solid ${staffMsg.type === 'error' ? 'var(--danger-border)' : 'var(--success-border)'}`,
              fontSize: '13px',
              color: staffMsg.type === 'error' ? 'var(--danger)' : 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>{staffMsg.text}</span>
            <button
              type="button"
              onClick={() => setStaffMsg(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
            >
              &times;
            </button>
          </div>
        )}

        
        {error && (
          <div style={{ margin: '14px 20px' }} className="alert alert-danger">
            {error}
          </div>
        )}

        
        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading staff directory...
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ padding: '14px 20px' }}>STAFF NAME</th>
                  <th>EMAIL ADDRESS</th>
                  <th>CURRENT ROLE</th>
                  <th>ACCOUNT STATUS</th>
                  <th>PROMOTION / ROLE REASSIGNMENT</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                      No staff accounts found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isVendorUser = u.role === 'Vendor';
                    const isCurrentSessionUser = u.id === user?.id;

                    return (
                      <tr key={u.id}>
                        <td style={{ padding: '14px 20px' }}>
                          <strong style={{ color: 'var(--text-primary)', fontSize: '13.5px' }}>{u.full_name}</strong>
                          {isCurrentSessionUser && (
                            <span
                              style={{
                                marginLeft: '8px',
                                fontSize: '11px',
                                color: 'var(--primary)',
                                background: 'var(--primary-light)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 700
                              }}
                            >
                              (You)
                            </span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{u.email}</td>
                        <td>
                          <span
                            className="badge badge-neutral"
                            style={{
                              fontWeight: 600,
                              fontSize: '12px',
                              padding: '4px 10px'
                            }}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${u.is_active ? 'badge-active' : 'badge-suspended'}`}
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                          >
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          {isVendorUser ? (
                            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              
                              <span>External Supplier (Protected)</span>
                            </span>
                          ) : isAdmin ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <select
                                className="form-select"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12.5px',
                                  width: '210px',
                                  borderRadius: '6px'
                                }}
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                disabled={roleLoadingId === u.id}
                              >
                                <option value="Administrator">Administrator</option>
                                <option value="Procurement Manager">Procurement Manager</option>
                                <option value="Supply Chain Manager">Supply Chain Manager</option>
                                <option value="Finance Officer">Finance Officer</option>
                                <option value="Auditor">Auditor</option>
                              </select>
                              {roleLoadingId === u.id && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Updating...</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              
                              <span>Admin Authorization Required</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default StaffManagement;
