import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import apiClient from '../api/client'

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
  const [orders, setOrders] = useState([])
  const [contracts, setContracts] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    apiClient.get(`/vendors/${id}`).then((res) => setVendor(res.data)).catch((err) => setError(err.response?.data?.detail || 'Failed to load vendor'))
    apiClient.get(`/performance/vendor/${id}/score`).then((res) => setScoreData(res.data)).catch(() => {})
    apiClient.get('/purchase-orders/').then((res) => setOrders(res.data.filter((o) => o.vendor_id === Number(id)))).catch(() => {})
    apiClient.get('/contracts/').then((res) => setContracts(res.data.filter((c) => c.vendor_id === Number(id)))).catch(() => {})
  }, [id])

  if (error) return <Layout title="Vendor"><div className="text-red-600 text-sm">{error}</div></Layout>
  if (!vendor) return <Layout title="Vendor">Loading...</Layout>

  return (
    <Layout title={vendor.company_name} subtitle={`${vendor.category.replace(/_/g, ' ')} · ${vendor.contact_person || '—'}`}>
      <div className="flex justify-between items-start mb-6">
        <div className="text-sm text-gray-500">{vendor.email} · {vendor.phone}</div>
        <div className="text-right">
          <div className="text-3xl font-bold" style={{ fontFamily: 'Sora, sans-serif', color: '#C9962C' }}>
            {vendor.reliability_score.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">Reliability Score</div>
        </div>
      </div>

      {scoreData && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <MetricBox label="On-Time Delivery" value={scoreData.on_time_delivery_rate != null ? `${scoreData.on_time_delivery_rate}%` : '—'} />
          <MetricBox label="Avg Quality Rating" value={scoreData.avg_quality_rating != null ? `${scoreData.avg_quality_rating} / 5` : '—'} />
          <MetricBox label="Avg Communication" value={scoreData.avg_communication_rating != null ? `${scoreData.avg_communication_rating} / 5` : '—'} />
          <MetricBox label="Avg Response Time" value={scoreData.avg_response_time_hours != null ? `${scoreData.avg_response_time_hours} hrs` : '—'} />
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