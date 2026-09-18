import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import apiClient from '../api/client'

function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className="text-2xl font-bold text-[#14213D]" style={{ fontFamily: 'Sora, sans-serif' }}>
        {value}
      </div>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-5">
      <div className="font-semibold text-sm mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Dashboard() {
  const [tab, setTab] = useState('procurement')
  const [procData, setProcData] = useState(null)
  const [adminData, setAdminData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiClient.get('/dashboard/procurement')
      .then((res) => setProcData(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load procurement dashboard'))

    apiClient.get('/dashboard/admin')
      .then((res) => setAdminData(res.data))
      .catch(() => {}) // silently ignore if user isn't admin
  }, [])

  return (
    <Layout title="Dashboard" subtitle="Live overview across procurement and vendor performance">
      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-md mb-4">{error}</div>
      )}

      <div className="flex gap-6 border-b border-gray-200 mb-6">
        {['procurement', 'admin'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2.5 text-sm font-semibold capitalize ${
              tab === t
                ? 'text-[#14213D] border-b-2 border-[#C9962C]'
                : 'text-gray-400 border-b-2 border-transparent'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'procurement' && procData && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Requests" value={procData.total_requests} />
            <StatCard label="Active Purchase Orders" value={procData.active_purchase_orders} />
            <StatCard label="Completion Rate" value={`${procData.completion_rate}%`} />
            <StatCard label="On-Time Delivery Rate" value={`${procData.delivery_rate}%`} />
          </div>
          <Panel title="Procurement value">
            <div className="text-3xl font-bold text-[#14213D]" style={{ fontFamily: 'Sora, sans-serif' }}>
              ₹{procData.total_procurement_value.toLocaleString('en-IN')}
            </div>
          </Panel>
        </>
      )}

      {tab === 'admin' && adminData && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Users" value={adminData.total_users} />
            <StatCard label="Total Vendors" value={adminData.total_vendors} />
            <StatCard label="High-Risk Vendors" value={adminData.high_risk_vendors} />
            <StatCard label="Pending Approvals" value={adminData.pending_approvals} />
          </div>
          <Panel title="Users by role">
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(adminData.users_by_role).map(([role, count]) => (
                  <tr key={role} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 capitalize">{role.replace(/_/g, ' ')}</td>
                    <td className="py-2 text-right font-medium">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}

      {tab === 'admin' && !adminData && (
        <div className="text-sm text-gray-500">Admin dashboard requires an admin account.</div>
      )}
    </Layout>
  )
}

export default Dashboard