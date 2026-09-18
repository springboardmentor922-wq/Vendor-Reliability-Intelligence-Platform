import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import apiClient from '../api/client'

function ScoreBar({ score }) {
  const color = score >= 70 ? '#2E7D5B' : score >= 50 ? '#C9962C' : '#C0463C'
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full" style={{ width: `${Math.min(score, 100)}%`, background: color }} />
      </div>
      <span className="text-sm">{score.toFixed(1)}</span>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    approved: 'bg-[#E7F4EE] text-[#2E7D5B]',
    pending: 'bg-[#FBF3E3] text-[#C9962C]',
    suspended: 'bg-[#FBEBE9] text-[#C0463C]',
    rejected: 'bg-[#FBEBE9] text-[#C0463C]',
  }
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  )
}

function Vendors() {
  const [vendors, setVendors] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    company_name: '', contact_person: '', email: '', phone: '', address: '', category: 'it_vendor',
  })

  const loadVendors = () => {
    apiClient.get('/vendors/')
      .then((res) => setVendors(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load vendors'))
  }

  useEffect(() => { loadVendors() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await apiClient.post('/vendors/', form)
      setShowForm(false)
      setForm({ company_name: '', contact_person: '', email: '', phone: '', address: '', category: 'it_vendor' })
      loadVendors()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create vendor')
    }
  }

  const filtered = vendors.filter((v) =>
    v.company_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout title="Vendors" subtitle="All registered suppliers and their reliability status">
      {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-md mb-4">{error}</div>}

      <div className="flex justify-between items-center mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendors..."
          className="w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#14213D] text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          {showForm ? 'Cancel' : '+ Register Vendor'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-lg p-6 mb-5">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Company name</label>
              <input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Contact person</label>
              <input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="raw_material_supplier">Raw Material Supplier</option>
                <option value="equipment_vendor">Equipment Vendor</option>
                <option value="it_vendor">IT Vendor</option>
                <option value="service_provider">Service Provider</option>
                <option value="logistics_partner">Logistics Partner</option>
                <option value="maintenance_vendor">Maintenance Vendor</option>
              </select>
            </div>
          </div>
          <button type="submit" className="bg-[#14213D] text-white px-5 py-2.5 rounded-lg text-sm font-semibold">
            Save vendor
          </button>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Reliability</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3.5">{v.company_name}</td>
                <td className="px-4 py-3.5 capitalize">{v.category.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3.5"><ScoreBar score={v.reliability_score} /></td>
                <td className="px-4 py-3.5"><StatusBadge status={v.status} /></td>
                <td className="px-4 py-3.5">
                  <Link to={`/vendors/${v.id}`} className="text-xs text-gray-500 font-medium">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-400">No vendors found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}

export default Vendors