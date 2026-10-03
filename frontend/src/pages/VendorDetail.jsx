import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import Layout from '../components/Layout'
import apiClient from '../api/client'

const COLORS = ['#C9962C', '#14213D', '#2E7D5B', '#C0463C', '#6B7280', '#8B95B3']

function MetricBox({ label, value }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="text-xs text-gray-500 mb-1.5">{label}</div>
      <div className="text-lg font-bold text-[#14213D]" style={{ fontFamily: 'Sora, sans-serif' }}>{value}</div>
    </div>
  )
}

function VendorDetail() {
  const { id } = useParams()
  const [vendor, setVendor] = useState(null)
  const [scoreData, setScoreData] = useState(null)
  const [trend, setTrend] = useState([])
  const [forecast, setForecast] = useState(null)
  const [vendorCharts, setVendorCharts] = useState(null)
  const [orders, setOrders] = useState([])
  const [contracts, setContracts] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    apiClient.get(`/vendors/${id}`).then((res) => setVendor(res.data)).catch((err) => setError(err.response?.data?.detail || 'Failed to load vendor'))
    apiClient.get(`/performance/vendor/${id}/score`).then((res) => setScoreData(res.data)).catch(() => {})
    apiClient.get(`/performance/vendor/${id}/trend`).then((res) => {
      const formatted = res.data.map((h, i) => ({ point: `#${i + 1}`, score: h.score }))
      setTrend(formatted)
    }).catch(() => {})
    apiClient.get(`/performance/vendor/${id}/forecast`).then((res) => setForecast(res.data)).catch(() => {})
    apiClient.get(`/dashboard/vendor/${id}/charts`).then((res) => setVendorCharts(res.data)).catch(() => {})
    apiClient.get('/purchase-orders/').then((res) => setOrders(res.data.filter((o) => o.vendor_id === Number(id)))).catch(() => {})
    apiClient.get('/contracts/').then((res) => setContracts(res.data.filter((c) => c.vendor_id === Number(id)))).catch(() => {})
  }, [id])

  if (error) return <Layout title="Vendor"><div className="text-red-600 text-sm">{error}</div></Layout>
  if (!vendor) return <Layout title="Vendor">Loading...</Layout>

  const trendColor = forecast?.direction === 'improving' ? '#2E7D5B' : forecast?.direction === 'declining' ? '#C0463C' : '#C9962C'

  const contractPie = vendorCharts
    ? Object.entries(vendorCharts.contract_status_breakdown).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k.replace(/_/g, ' '), value: v }))
    : []

  return (
    <Layout title={vendor.company_name} subtitle={`${vendor.category.replace(/_/g, ' ')} · ${vendor.contact_person || '—'}`}>
      <div className="flex justify-between items-start mb-6">
        <div className="text-sm text-gray-500">{vendor.email} · {vendor.phone}</div>
        <div className="text-right">
          <div className="text-3xl font-bold" style={{ fontFamily: 'Sora, sans-serif', color: '#C9962C' }}>
            {vendor.reliability_score.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">
            {vendor.risk_level && <span className="capitalize">{vendor.risk_level.replace('_', ' ')}</span>}
          </div>
        </div>
      </div>

      {vendor.recommendation && (
        <div className="bg-[#FBF3E3] border border-[#C9962C]/30 rounded-lg p-4 mb-6 text-sm">
          <span className="font-semibold text-[#14213D]">Recommendation: </span>
          <span className="text-gray-700">{vendor.recommendation}</span>
        </div>
      )}

      {scoreData && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <MetricBox label="On-Time Delivery" value={scoreData.on_time_delivery_rate != null ? `${scoreData.on_time_delivery_rate}%` : '—'} />
          <MetricBox label="Avg Quality Rating" value={scoreData.avg_quality_rating != null ? `${scoreData.avg_quality_rating} / 5` : '—'} />
          <MetricBox label="Avg Response Time" value={scoreData.avg_response_time_hours != null ? `${scoreData.avg_response_time_hours} hrs` : '—'} />
          <MetricBox label="Total Records" value={scoreData.total_records} />
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-5">
        <div className="flex justify-between items-center mb-4">
          <div className="font-semibold text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>Reliability trend</div>
          {forecast && forecast.direction !== 'insufficient_data' && (
            <div className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
              style={{ background: `${trendColor}1A`, color: trendColor }}>
              {forecast.direction} · projected next: {forecast.projected_score}
            </div>
          )}
        </div>
        {trend.length >= 2 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F3" />
              <XAxis dataKey="point" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#9CA3AF" />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#C9962C" strokeWidth={2.5} dot={{ r: 4, fill: '#C9962C' }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-gray-400 py-10 text-center">Not enough data yet.</div>
        )}
      </div>

      {vendorCharts && (
        <div className="grid grid-cols-2 gap-5 mb-5">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="font-semibold text-sm mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Reliability factor breakdown</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={vendorCharts.performance_bars}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F3" />
                <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="score" fill="#14213D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="font-semibold text-sm mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Contract status</div>
            {contractPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={contractPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {contractPie.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-gray-400 py-16 text-center">No contracts yet.</div>
            )}
          </div>
        </div>
      )}

      {vendorCharts && vendorCharts.order_history.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-5">
          <div className="font-semibold text-sm mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Order value by month</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={vendorCharts.order_history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#C9962C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-5">
        <div className="font-semibold text-sm mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Order history</div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-200"><th className="py-2">Order No.</th><th className="py-2">Total</th><th className="py-2">Status</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2.5">{o.order_number}</td>
                <td className="py-2.5">₹{o.total_amount.toLocaleString('en-IN')}</td>
                <td className="py-2.5 capitalize">{o.status}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan="3" className="py-6 text-center text-gray-400">No orders yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="font-semibold text-sm mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Contracts</div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-200"><th className="py-2">Title</th><th className="py-2">Ends</th><th className="py-2">Status</th></tr></thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2.5">{c.title}</td>
                <td className="py-2.5">{new Date(c.end_date).toLocaleDateString()}</td>
                <td className="py-2.5 capitalize">{c.status.replace(/_/g, ' ')}</td>
              </tr>
            ))}
            {contracts.length === 0 && <tr><td colSpan="3" className="py-6 text-center text-gray-400">No contracts yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}

export default VendorDetail