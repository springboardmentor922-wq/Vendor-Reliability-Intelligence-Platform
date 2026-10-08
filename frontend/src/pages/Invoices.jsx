import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import apiClient from '../api/client'

const STATUS_STYLES = {
  unpaid: 'bg-gray-100 text-gray-600',
  partially_paid: 'bg-amber-50 text-amber-700',
  paid: 'bg-green-50 text-green-700',
  overdue: 'bg-red-50 text-red-700',
}

function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [vendors, setVendors] = useState([])
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    invoice_number: '', purchase_order_id: '', vendor_id: '', invoice_amount: '', invoice_date: '',
  })

  const load = () => {
    apiClient.get('/invoices/').then((res) => setInvoices(res.data)).catch((err) => setError(err.response?.data?.detail || 'Failed to load invoices'))
  }

  useEffect(() => {
    load()
    apiClient.get('/vendors/').then((res) => setVendors(res.data.filter((v) => v.status === 'approved'))).catch(() => {})
    apiClient.get('/purchase-orders/').then((res) => setOrders(res.data)).catch(() => {})
  }, [])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await apiClient.post('/invoices/', {
        ...form,
        purchase_order_id: Number(form.purchase_order_id),
        vendor_id: Number(form.vendor_id),
        invoice_amount: Number(form.invoice_amount),
        invoice_date: new Date(form.invoice_date).toISOString(),
      })
      setForm({ invoice_number: '', purchase_order_id: '', vendor_id: '', invoice_amount: '', invoice_date: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create invoice')
    }
  }

  const updateStatus = async (id, payment_status) => {
    try {
      await apiClient.put(`/invoices/${id}`, { payment_status })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update invoice')
    }
  }

  const vendorName = (id) => vendors.find((v) => v.id === id)?.company_name || `Vendor #${id}`

  return (
    <Layout title="Invoices" subtitle="Track vendor invoices and payment status">
      {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-md mb-4">{error}</div>}

      <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-lg p-6 mb-6 grid grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Invoice Number</label>
          <input name="invoice_number" value={form.invoice_number} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Vendor</label>
          <select name="vendor_id" value={form.vendor_id} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
            <option value="">Select vendor</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Purchase Order</label>
          <select name="purchase_order_id" value={form.purchase_order_id} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
            <option value="">Select PO</option>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.order_number || `PO #${o.id}`}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount</label>
          <input name="invoice_amount" type="number" step="0.01" value={form.invoice_amount} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Invoice Date</label>
          <input name="invoice_date" type="date" value={form.invoice_date} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
        </div>
        <button type="submit" className="col-span-5 bg-[#14213D] text-white text-sm font-semibold py-2.5 rounded-md hover:bg-[#1E2E52]">
          Add Invoice
        </button>
      </form>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">PO</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Update</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium">{inv.invoice_number}</td>
                <td className="px-4 py-3">{vendorName(inv.vendor_id)}</td>
                <td className="px-4 py-3">#{inv.purchase_order_id}</td>
                <td className="px-4 py-3">₹{inv.invoice_amount.toLocaleString()}</td>
                <td className="px-4 py-3">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[inv.payment_status]}`}>
                    {inv.payment_status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={inv.payment_status}
                    onChange={(e) => updateStatus(inv.id, e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded-md text-xs"
                  >
                    {Object.keys(STATUS_STYLES).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={7} className="text-center text-gray-400 py-8">No invoices yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}

export default Invoices