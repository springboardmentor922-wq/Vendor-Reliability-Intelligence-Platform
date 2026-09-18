import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import apiClient from '../api/client'

function Performance() {
  const [vendors, setVendors] = useState([])
  const [selectedVendor, setSelectedVendor] = useState('')
  const [scoreData, setScoreData] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ on_time_delivery: 'true', quality_rating: '', communication_rating: '', response_time_hours: '', notes: '' })

  useEffect(() => {
    apiClient.get('/vendors/').then((res) => {
      setVendors(res.data)
      if (res.data.length > 0) setSelectedVendor(String(res.data[0].id))
    }).catch(() => {})
  }, [])

  const loadVendorData = (vendorId) => {
    if (!vendorId) return
    apiClient.get(`/performance/vendor/${vendorId}/score`).then((res) => setScoreData(res.data)).catch(() => {})
    apiClient.get(`/performance/vendor/${vendorId}`).then((res) => setHistory(res.data)).catch(() => {})
  }

  useEffect(() => { loadVendorData(selectedVendor) }, [selectedVendor])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await apiClient.post('/performance/', {
        vendor_id: Number(selectedVendor),
        on_time_delivery: form.on_time_delivery === 'true',
        quality_rating: form.quality_rating ? Number(form.quality_rating) : null,
        communication_rating: form.communication_rating ? Number(form.communication_rating) : null,
        response_time_hours: form.response_time_hours ? Number(form.response_time_hours) : null,
        notes: form.notes,
      })
      setForm({ on_time_delivery: 'true', quality_rating: '', communication_rating: '', response_time_hours: '', notes: '' })
      loadVendorData(selectedVendor)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to log performance')
    }
  }

  return (
    <Layout title="Vendor Performance" subtitle="Log delivery, quality, and communication data per vendor">
      {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-md mb-4">{error}</div>}

      <div className="mb-5">
        <label className="block text-sm font-medium mb-1.5">Vendor</label>
        <select value={selectedVendor} onChange={(e) => setSelectedVendor(e.target.value)}
          className="w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm">
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
        </select>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 mb-5">
        <div className="font-semibold text-sm mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Log new entry</div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">On-time delivery?</label>
            <select value={form.on_time_delivery} onChange={(e) => setForm({ ...form, on_time_delivery: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Quality rating (1-5)</label>
            <input type="number" step="0.1" min="1" max="5" value={form.quality_rating}
              onChange={(e) => setForm({ ...form, quality_rating: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="4.5" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Communication rating</label>
            <input type="number" step="0.1" min="1" max="5" value={form.communication_rating}
              onChange={(e) => setForm({ ...form, communication_rating: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="4.0" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Response time (hrs)</label>
            <input type="number" value={form.response_time_hours}
              onChange={(e) => setForm({ ...form, response_time_hours: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="6" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1.5">Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
        <button type="submit" className="bg-[#14213D] text-white px-5 py-2.5 rounded-lg text-sm font-semibold">
          Log entry
        </button>
      </form>

      {scoreData && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-5">
          <div className="font-semibold text-sm mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Reliability breakdown</div>
          <div className="grid grid-cols-4 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1.5">Reliability Score</div>
              <div className="text-lg font-bold" style={{ fontFamily: 'Sora, sans-serif', color: '#C9962C' }}>{scoreData.reliability_score}</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1.5">On-Time Rate</div>
              <div className="text-lg font-bold" style={{ fontFamily: 'Sora, sans-serif' }}>{scoreData.on_time_delivery_rate ?? '—'}%</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1.5">Avg Quality</div>
              <div className="text-lg font-bold" style={{ fontFamily: 'Sora, sans-serif' }}>{scoreData.avg_quality_rating ?? '—'} / 5</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1.5">Avg Response</div>
              <div className="text-lg font-bold" style={{ fontFamily: 'Sora, sans-serif' }}>{scoreData.avg_response_time_hours ?? '—'} hrs</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="font-semibold text-sm mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>History</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
              <th className="py-2">Date</th><th className="py-2">On-Time</th><th className="py-2">Quality</th><th className="py-2">Communication</th><th className="py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2.5">{new Date(h.recorded_at).toLocaleDateString()}</td>
                <td className="py-2.5">{h.on_time_delivery === true ? 'Yes' : h.on_time_delivery === false ? 'No' : '—'}</td>
                <td className="py-2.5">{h.quality_rating ?? '—'}</td>
                <td className="py-2.5">{h.communication_rating ?? '—'}</td>
                <td className="py-2.5">{h.notes || '—'}</td>
              </tr>
            ))}
            {history.length === 0 && <tr><td colSpan="5" className="py-6 text-center text-gray-400">No entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}

export default Performance