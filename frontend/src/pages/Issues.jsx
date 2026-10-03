import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import apiClient from '../api/client'

const STATUS_STYLES = {
  open: 'bg-red-50 text-red-700',
  in_progress: 'bg-amber-50 text-amber-700',
  resolved: 'bg-green-50 text-green-700',
}

function Issues() {
  const [issues, setIssues] = useState([])
  const [vendors, setVendors] = useState([])
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ vendor_id: '', purchase_order_id: '', title: '', description: '' })

  const load = () => {
    apiClient.get('/issues/').then((res) => setIssues(res.data)).catch((err) => setError(err.response?.data?.detail || 'Failed to load issues'))
  }

  useEffect(() => {
    load()
    apiClient.get('/vendors/').then((res) => setVendors(res.data)).catch(() => {})
    apiClient.get('/purchase-orders/').then((res) => setOrders(res.data)).catch(() => {})
  }, [])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await apiClient.post('/issues/', {
        vendor_id: Number(form.vendor_id),
        purchase_order_id: form.purchase_order_id ? Number(form.purchase_order_id) : null,
        title: form.title,
        description: form.description || null,
      })
      setForm({ vendor_id: '', purchase_order_id: '', title: '', description: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to raise issue')
    }
  }

  const resolveIssue = async (id) => {
    try {
      await apiClient.put(`/issues/${id}/resolve`)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resolve issue')
    }
  }

  const vendorName = (id) => vendors.find((v) => v.id === id)?.company_name || `Vendor #${id}`

  return (
    <Layout title="Issues" subtitle="Log and track vendor-related issues">
      {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-md mb-4">{error}</div>}

      <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-lg p-6 mb-6 grid grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Vendor</label>
          <select name="vendor_id" value={form.vendor_id} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
            <option value="">Select vendor</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Purchase Order (optional)</label>
          <select name="purchase_order_id" value={form.purchase_order_id} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
            <option value="">None</option>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.order_number || `PO #${o.id}`}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Title</label>
          <input name="title" value={form.title} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <input name="description" value={form.description} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
        <button type="submit" className="col-span-4 bg-[#14213D] text-white text-sm font-semibold py-2.5 rounded-md hover:bg-[#1E2E52]">
          Raise Issue
        </button>
      </form>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Raised</th>
              <th className="px-4 py-3">Resolved</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {issues.map((iss) => (
              <tr key={iss.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium">{iss.title}</td>
                <td className="px-4 py-3">{vendorName(iss.vendor_id)}</td>
                <td className="px-4 py-3">{new Date(iss.raised_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">{iss.resolved_at ? new Date(iss.resolved_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[iss.status]}`}>
                    {iss.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {iss.status !== 'resolved' && (
                    <button onClick={() => resolveIssue(iss.id)} className="text-xs font-semibold text-[#14213D] hover:underline">
                      Mark resolved
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {issues.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-400 py-8">No issues logged.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}

export default Issues