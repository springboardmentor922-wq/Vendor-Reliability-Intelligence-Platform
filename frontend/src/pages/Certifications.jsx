import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import apiClient from '../api/client'

const STATUS_STYLES = {
  compliant: 'bg-green-50 text-green-700',
  non_compliant: 'bg-red-50 text-red-700',
  pending_review: 'bg-amber-50 text-amber-700',
}

function Certifications() {
  const [certs, setCerts] = useState([])
  const [vendors, setVendors] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ vendor_id: '', name: '', document_url: '', issue_date: '', expiry_date: '' })

  const load = () => {
    apiClient.get('/certifications/').then((res) => setCerts(res.data)).catch((err) => setError(err.response?.data?.detail || 'Failed to load certifications'))
  }

  useEffect(() => {
    load()
    apiClient.get('/vendors/').then((res) => setVendors(res.data)).catch(() => {})
  }, [])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await apiClient.post('/certifications/', {
        vendor_id: Number(form.vendor_id),
        name: form.name,
        document_url: form.document_url || null,
        issue_date: form.issue_date ? new Date(form.issue_date).toISOString() : null,
        expiry_date: new Date(form.expiry_date).toISOString(),
      })
      setForm({ vendor_id: '', name: '', document_url: '', issue_date: '', expiry_date: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add certification')
    }
  }

  const updateStatus = async (id, compliance_status) => {
    try {
      await apiClient.put(`/certifications/${id}`, { compliance_status })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update certification')
    }
  }

  const vendorName = (id) => vendors.find((v) => v.id === id)?.company_name || `Vendor #${id}`
  const isExpiringSoon = (date) => {
    const days = (new Date(date) - new Date()) / (1000 * 60 * 60 * 24)
    return days >= 0 && days <= 30
  }
  const isExpired = (date) => new Date(date) < new Date()

  return (
    <Layout title="Certifications" subtitle="Track vendor compliance documents and expiry">
      {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-md mb-4">{error}</div>}

      <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-lg p-6 mb-6 grid grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Vendor</label>
          <select name="vendor_id" value={form.vendor_id} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
            <option value="">Select vendor</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Certification Name</label>
          <input name="name" value={form.name} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Document URL</label>
          <input name="document_url" value={form.document_url} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Issue Date</label>
          <input name="issue_date" type="date" value={form.issue_date} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Expiry Date</label>
          <input name="expiry_date" type="date" value={form.expiry_date} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
        <button type="submit" className="col-span-5 bg-[#14213D] text-white text-sm font-semibold py-2.5 rounded-md hover:bg-[#1E2E52]">
          Add Certification
        </button>
      </form>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Certification</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Update</th>
            </tr>
          </thead>
          <tbody>
            {certs.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium">
                  {c.document_url ? <a href={c.document_url} target="_blank" rel="noreferrer" className="hover:underline">{c.name}</a> : c.name}
                </td>
                <td className="px-4 py-3">{vendorName(c.vendor_id)}</td>
                <td className="px-4 py-3">{c.issue_date ? new Date(c.issue_date).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3">
                  <span className={isExpired(c.expiry_date) ? 'text-red-600 font-semibold' : isExpiringSoon(c.expiry_date) ? 'text-amber-600 font-semibold' : ''}>
                    {new Date(c.expiry_date).toLocaleDateString()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[c.compliance_status]}`}>
                    {c.compliance_status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={c.compliance_status}
                    onChange={(e) => updateStatus(c.id, e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded-md text-xs"
                  >
                    {Object.keys(STATUS_STYLES).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {certs.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-400 py-8">No certifications on file.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}

export default Certifications