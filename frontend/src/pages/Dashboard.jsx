import { useState, useEffect } from 'react'
import {
  ComposedChart, Line, Area, AreaChart, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  ShoppingCart, Users, Building2, FileText, Star, ShieldCheck, Wallet,
  ClipboardList, Truck, Activity, Clock, ArrowUp, ArrowDown,
} from 'lucide-react'
import Layout from '../components/Layout'
import apiClient from '../api/client'

const PALETTE = ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#EC4899']
const STATUS_COLORS = {
  completed: '#10B981', delivered: '#3B82F6', ordered: '#8B5CF6', approved: '#06B6D4',
  pending: '#F59E0B', draft: '#9CA3AF', cancelled: '#EF4444',
}
const CONTRACT_COLORS = { active: '#10B981', expiring_soon: '#F59E0B', expired: '#EF4444', terminated: '#9CA3AF' }
const ISSUE_COLORS = { open: '#EF4444', in_progress: '#F59E0B', resolved: '#10B981' }
const TINTS = [
  { bg: '#EFF6FF', fg: '#2563EB' },
  { bg: '#FFF1F2', fg: '#E11D48' },
  { bg: '#ECFDF5', fg: '#059669' },
  { bg: '#F5F3FF', fg: '#7C3AED' },
]
const THEMES = {
  procurement: {
    from: '#1D4ED8', to: '#3B82F6', icon: ShoppingCart, title: 'Procurement Dashboard',
    sub: 'Track procurement activities, costs, vendors and delivery performance in real-time',
  },
  vendor: {
    from: '#15803D', to: '#22C55E', icon: Users, title: 'Vendor Dashboard',
    sub: 'Monitor vendor performance, reliability, contracts and communication',
  },
  admin: {
    from: '#6D28D9', to: '#A78BFA', icon: ShieldCheck, title: 'Admin Dashboard',
    sub: 'Manage users, analyze vendors, monitor compliance and system performance',
  },
}

const fmtMoney = (n) => {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}
const axisMoney = (v) => (v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : v)
const pctChange = (arr, key) => {
  if (!arr || arr.length < 2) return null
  const prev = arr[arr.length - 2][key]
  const cur = arr[arr.length - 1][key]
  if (!prev) return null
  return ((cur - prev) / prev) * 100
}
const pretty = (s) => s.replace(/_/g, ' ')

function Delta({ value }) {
  const up = value >= 0
  const Arrow = up ? ArrowUp : ArrowDown
  return (
    <div className="text-[11px] font-semibold flex items-center gap-0.5" style={{ color: up ? '#059669' : '#DC2626' }}>
      <Arrow size={12} /> {Math.abs(value).toFixed(0)}%
      <span className="text-gray-400 font-normal ml-1">vs last month</span>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, tint, delta }) {
  return (
    <div className="rounded-xl p-4 border border-white flex items-center gap-3" style={{ background: tint.bg }}>
      <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-white shrink-0" style={{ color: tint.fg }}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-xl font-bold text-[#14213D]" style={{ fontFamily: 'Sora, sans-serif' }}>{value}</div>
        {delta != null && <Delta value={delta} />}
      </div>
    </div>
  )
}

function Panel({ title, icon: Icon, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="font-semibold text-sm mb-3 flex items-center gap-2 text-[#14213D]" style={{ fontFamily: 'Sora, sans-serif' }}>
        {Icon && <Icon size={16} />} {title}
      </div>
      {children}
    </div>
  )
}

function Empty({ text }) {
  return <div className="text-sm text-gray-400 py-16 text-center">{text}</div>
}

function Donut({ data, total, totalLabel }) {
  if (!data.length) return <Empty text="No data yet." />
  return (
    <div className="relative" style={{ height: 230 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cy="42%" innerRadius={55} outerRadius={80} paddingAngle={2} stroke="none">
            {data.map((d, i) => <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-x-0 text-center pointer-events-none" style={{ top: '25%' }}>
        <div className="text-2xl font-bold text-[#14213D]">{total}</div>
        <div className="text-[11px] text-gray-500">{totalLabel}</div>
      </div>
    </div>
  )
}

function Gauge({ value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  const data = [{ value: v }, { value: 100 - v }]
  return (
    <div className="relative" style={{ height: 150 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" startAngle={180} endAngle={0} cx="50%" cy="88%" innerRadius={70} outerRadius={95} stroke="none">
            <Cell fill="#10B981" />
            <Cell fill="#E5E7EB" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <div className="text-2xl font-bold text-[#14213D]">{v.toFixed(0)}%</div>
        <div className="text-[11px] text-gray-500">On-Time Delivery</div>
      </div>
    </div>
  )
}

function Dashboard() {
  const [tab, setTab] = useState('procurement')
  const [procData, setProcData] = useState(null)
  const [procCharts, setProcCharts] = useState(null)
  const [adminData, setAdminData] = useState(null)
  const [adminCharts, setAdminCharts] = useState(null)
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState('')

  const [vendors, setVendors] = useState([])
  const [selectedVendor, setSelectedVendor] = useState('')
  const [vendorSummary, setVendorSummary] = useState(null)
  const [vendorCharts, setVendorCharts] = useState(null)
  const [vendorTrend, setVendorTrend] = useState([])
  const [vendorIssues, setVendorIssues] = useState([])

  useEffect(() => {
    apiClient.get('/dashboard/procurement').then((res) => setProcData(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load procurement dashboard'))
    apiClient.get('/dashboard/procurement/charts').then((res) => setProcCharts(res.data)).catch(() => {})
    apiClient.get('/dashboard/admin').then((res) => setAdminData(res.data)).catch(() => {})
    apiClient.get('/dashboard/admin/charts').then((res) => setAdminCharts(res.data)).catch(() => {})
    apiClient.get('/dashboard/my-tasks').then((res) => setTasks(res.data)).catch(() => {})
    apiClient.get('/vendors/').then((res) => {
      setVendors(res.data)
      if (res.data.length > 0) setSelectedVendor(String(res.data[0].id))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedVendor) return
    apiClient.get(`/dashboard/vendor/${selectedVendor}`).then((res) => setVendorSummary(res.data)).catch(() => {})
    apiClient.get(`/dashboard/vendor/${selectedVendor}/charts`).then((res) => setVendorCharts(res.data)).catch(() => {})
    apiClient.get(`/performance/vendor/${selectedVendor}/trend`).then((res) => {
      setVendorTrend(res.data.map((h, i) => ({ point: `#${i + 1}`, score: h.score })))
    }).catch(() => {})
    apiClient.get(`/issues/vendor/${selectedVendor}`).then((res) => setVendorIssues(res.data)).catch(() => {})
  }, [selectedVendor])

  const theme = THEMES[tab]
  const HeaderIcon = theme.icon

  // ---------- procurement derived data ----------
  const monthly = procCharts?.monthly_trend || []
  const rangeLabel = monthly.length ? `${monthly[0].month} – ${monthly[monthly.length - 1].month}` : ''
  const breakdown = procCharts?.po_status_breakdown || {}
  const totalPOs = Object.values(breakdown).reduce((a, b) => a + b, 0)
  const poStatusData = Object.entries(breakdown).filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v, color: STATUS_COLORS[k] }))
  const categoryData = (procCharts?.cost_by_category || []).map((c) => ({ name: pretty(c.category), value: c.cost }))
  const categoryTotal = categoryData.reduce((a, b) => a + b.value, 0)
  const delivered = (breakdown.delivered || 0) + (breakdown.completed || 0)
  const inTransit = (breakdown.ordered || 0) + (breakdown.approved || 0)
  const activeVendorCount = vendors.filter((v) => v.status === 'approved').length

  const radarRows = (() => {
    const rows = procCharts?.vendor_performance_radar || []
    if (!rows.length) return []
    const avgOf = (r) => (r.delivery + r.quality + r.communication + r.compliance) / 4
    const top = rows.reduce((a, b) => (avgOf(b) > avgOf(a) ? b : a), rows[0])
    return [['delivery', 'Delivery'], ['quality', 'Quality'], ['communication', 'Communication'], ['compliance', 'Compliance']]
      .map(([k, label]) => ({
        metric: label,
        top: top[k],
        average: Math.round(rows.reduce((s, r) => s + r[k], 0) / rows.length),
      }))
  })()

  // ---------- vendor derived data ----------
  const bars = vendorCharts?.performance_bars || []
  const perfScore = bars.length ? Math.round(bars.reduce((s, b) => s + b.score, 0) / bars.length) : 0
  const contractData = vendorCharts
    ? Object.entries(vendorCharts.contract_status_breakdown).filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: pretty(k), value: v, color: CONTRACT_COLORS[k] }))
    : []
  const contractTotal = contractData.reduce((a, b) => a + b.value, 0)
  const issueCounts = { open: 0, in_progress: 0, resolved: 0 }
  vendorIssues.forEach((i) => { issueCounts[i.status] = (issueCounts[i.status] || 0) + 1 })
  const issueData = Object.entries(issueCounts).filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: pretty(k), value: v, color: ISSUE_COLORS[k] }))

  // ---------- admin derived data ----------
  const rolesData = adminCharts
    ? Object.entries(adminCharts.users_by_role).filter(([, v]) => v > 0).map(([k, v]) => ({ name: pretty(k), value: v }))
    : []
  const riskBar = adminCharts ? [
    { risk: 'Low', count: adminCharts.vendor_risk_distribution.low_risk, color: '#10B981' },
    { risk: 'Medium', count: adminCharts.vendor_risk_distribution.medium_risk, color: '#F59E0B' },
    { risk: 'High', count: adminCharts.vendor_risk_distribution.high_risk, color: '#EF4444' },
  ] : []
  const complianceData = adminCharts
    ? Object.entries(adminCharts.compliance_breakdown).filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: pretty(k), value: v, color: CONTRACT_COLORS[k] }))
    : []
  const complianceTotal = complianceData.reduce((a, b) => a + b.value, 0)

  const gridLine = <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F3" />

  return (
    <Layout title="Dashboard" subtitle="Live overview across procurement and vendor performance">
      {tasks && tasks.total_action_items > 0 && (
        <div className="bg-[#FBF3E3] border border-[#C9962C]/30 rounded-lg p-4 mb-5 text-sm">
          <span className="font-semibold text-[#14213D]">{tasks.total_action_items} items need your attention: </span>
          <span className="text-gray-600">
            {tasks.pending_purchase_orders} POs, {tasks.pending_vendor_approvals} vendor approvals, {tasks.contracts_expiring_soon} contracts expiring, {tasks.high_risk_vendors} high-risk vendors
          </span>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-md mb-4">{error}</div>}

      <div className="flex gap-2 mb-5">
        {Object.keys(THEMES).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-semibold capitalize border"
            style={tab === t
              ? { background: THEMES[t].from, color: '#fff', borderColor: THEMES[t].from }
              : { background: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }}>
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-xl p-5 mb-5 text-white flex items-center justify-between"
        style={{ background: `linear-gradient(90deg, ${theme.from}, ${theme.to})` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center"><HeaderIcon size={22} /></div>
          <div>
            <div className="text-lg font-bold" style={{ fontFamily: 'Sora, sans-serif' }}>{theme.title}</div>
            <div className="text-xs text-white/80">{theme.sub}</div>
          </div>
        </div>
        {tab === 'procurement' && rangeLabel && (
          <div className="text-xs bg-white/20 rounded-lg px-3 py-1.5">{rangeLabel}</div>
        )}
      </div>

      {/* ================= PROCUREMENT ================= */}
      {tab === 'procurement' && procData && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            <StatCard icon={ClipboardList} label="Total Purchase Orders" value={totalPOs || procData.total_requests}
              tint={TINTS[0]} delta={pctChange(monthly, 'po_count')} />
            <StatCard icon={Wallet} label="Total Procurement Cost" value={fmtMoney(procData.total_procurement_value)}
              tint={TINTS[1]} delta={pctChange(monthly, 'cost')} />
            <StatCard icon={Building2} label="Active Vendors" value={activeVendorCount} tint={TINTS[2]} />
            <StatCard icon={Clock} label="Overdue POs" value={procData.overdue_orders} tint={TINTS[3]} />
          </div>

          {procCharts && (
            <>
              <div className="grid grid-cols-3 gap-5">
                <Panel title="Procurement overview">
                  {monthly.length ? (
                    <ResponsiveContainer width="100%" height={230}>
                      <ComposedChart data={monthly}>
                        {gridLine}
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={axisMoney} />
                        <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v, name) => (name === 'Cost' ? fmtMoney(v) : v)} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                        <Bar yAxisId="left" dataKey="cost" name="Cost" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="po_count" name="POs" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : <Empty text="No orders yet." />}
                </Panel>

                <Panel title="Active purchase orders">
                  <Donut data={poStatusData} total={totalPOs} totalLabel="Total POs" />
                </Panel>

                <Panel title="Delivery status" icon={Truck}>
                  <Gauge value={procData.delivery_rate} />
                  <div className="mt-3 space-y-1.5 text-sm">
                    {[
                      ['Delivered', delivered, '#10B981'],
                      ['In transit', inTransit, '#3B82F6'],
                      ['Delivered late', procData.delayed_deliveries, '#F59E0B'],
                      ['Cancelled', breakdown.cancelled || 0, '#EF4444'],
                    ].map(([label, count, color]) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-gray-600">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />{label}
                        </span>
                        <span className="font-semibold text-[#14213D]">{count}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <Panel title="Vendor performance summary">
                  {radarRows.length ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <RadarChart data={radarRows}>
                        <PolarGrid stroke="#E2E5EA" />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Radar name="Top vendor" dataKey="top" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.35} />
                        <Radar name="Average" dataKey="average" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : <Empty text="No vendor performance data yet." />}
                </Panel>

                <Panel title="Procurement cost analysis">
                  <Donut data={categoryData} total={fmtMoney(categoryTotal)} totalLabel="Total cost" />
                </Panel>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================= VENDOR ================= */}
      {tab === 'vendor' && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">Select vendor</label>
            <select value={selectedVendor} onChange={(e) => setSelectedVendor(e.target.value)}
              className="w-72 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
            </select>
          </div>

          {vendorSummary && (
            <div className="grid grid-cols-4 gap-4">
              <StatCard icon={Star} label="Performance Score" value={`${perfScore}%`} tint={TINTS[2]} />
              <StatCard icon={ShieldCheck} label="Reliability Score" value={`${vendorSummary.reliability_score}%`} tint={TINTS[0]} />
              <StatCard icon={FileText} label="Active Contracts" value={vendorSummary.active_contracts} tint={TINTS[3]} />
              <StatCard icon={ShoppingCart} label="Total Orders" value={vendorSummary.total_orders} tint={TINTS[1]} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-5">
            <Panel title="Vendor performance (all vendors)">
              {procCharts?.vendor_performance_radar?.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={procCharts.vendor_performance_radar}>
                    {gridLine}
                    <XAxis dataKey="vendor" interval={0} tick={{ fontSize: 10 }} tickFormatter={(v) => v.split(' ')[0]} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="delivery" name="Delivery" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="quality" name="Quality" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="communication" name="Communication" fill="#10B981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="compliance" name="Compliance" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty text="No performance data yet." />}
            </Panel>

            <Panel title="Reliability score trend">
              {vendorTrend.length >= 2 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={vendorTrend}>
                    {gridLine}
                    <XAxis dataKey="point" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="score" stroke="#10B981" strokeWidth={2.5} fill="#10B981" fillOpacity={0.18} dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <Empty text="Not enough history yet." />}
            </Panel>

            <Panel title="Contract status">
              <Donut data={contractData} total={contractTotal} totalLabel="Contracts" />
            </Panel>

            <Panel title="Order history">
              {vendorCharts?.order_history?.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={vendorCharts.order_history}>
                    {gridLine}
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={axisMoney} />
                    <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, name) => (name === 'Order value' ? fmtMoney(v) : v)} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="value" name="Order value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="count" name="Orders" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : <Empty text="No orders yet." />}
            </Panel>

            <Panel title="Issues activity">
              <Donut data={issueData} total={vendorIssues.length} totalLabel="Issues" />
            </Panel>
          </div>
        </div>
      )}

      {/* ================= ADMIN ================= */}
      {tab === 'admin' && !adminData && (
        <div className="text-sm text-gray-500">The Admin dashboard requires an admin account.</div>
      )}

      {tab === 'admin' && adminData && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            <StatCard icon={Users} label="Total Users" value={adminData.total_users} tint={TINTS[0]} />
            <StatCard icon={Building2} label="Total Vendors" value={adminData.total_vendors} tint={TINTS[3]} />
            <StatCard icon={FileText} label="Total Contracts" value={adminData.total_contracts} tint={TINTS[2]} />
            <StatCard icon={ClipboardList} label="Pending Approvals" value={adminData.pending_approvals} tint={TINTS[1]} />
          </div>

          {adminCharts && (
            <>
              <div className="grid grid-cols-3 gap-5">
                <Panel title="User management">
                  <Donut data={rolesData} total={adminData.total_users} totalLabel="Users" />
                </Panel>

                <Panel title="Vendor analytics (risk distribution)">
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={riskBar}>
                      {gridLine}
                      <XAxis dataKey="risk" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Vendors" radius={[4, 4, 0, 0]}>
                        {riskBar.map((r, i) => <Cell key={i} fill={r.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>

                <Panel title="Compliance monitoring">
                  <Donut data={complianceData} total={complianceTotal} totalLabel="Contracts" />
                </Panel>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <Panel title="Procurement reports">
                  {adminCharts.procurement_monthly_trend.length ? (
                    <ResponsiveContainer width="100%" height={230}>
                      <ComposedChart data={adminCharts.procurement_monthly_trend}>
                        {gridLine}
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={axisMoney} />
                        <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v, name) => (name === 'Cost' ? fmtMoney(v) : v)} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                        <Bar yAxisId="left" dataKey="cost" name="Cost" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="po_count" name="POs" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : <Empty text="No orders yet." />}
                </Panel>

                <Panel title="System statistics" icon={Activity}>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Active users', adminData.active_users],
                      ['Active vendors', adminData.active_vendors],
                      ['Purchase orders', adminData.total_purchase_orders],
                      ['Procurement value', fmtMoney(adminData.total_procurement_value)],
                      ['High-risk vendors', adminData.high_risk_vendors],
                      ['Expired contracts', adminData.expired_certifications],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-[#F5F3FF] p-3">
                        <div className="text-[11px] text-gray-500">{label}</div>
                        <div className="text-lg font-bold text-[#14213D]" style={{ fontFamily: 'Sora, sans-serif' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </>
          )}
        </div>
      )}
    </Layout>
  )
}

export default Dashboard