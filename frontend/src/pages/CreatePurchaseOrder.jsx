import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import apiClient from '../api/client'

function CreatePurchaseOrder() {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    order_number: '', vendor_id: '', department: '', payment_terms: 'Net 30',
    shipping_address: '', billing_address: '', remarks: '', expected_delivery_date: '',
  })
  const [items, setItems] = useState([{ item_description: '', quantity: 1, unit_price: 0, tax_percent: 18 }])

  useEffect(() => {
    apiClient.get('/vendors/').then((res) => setVendors(res.data)).catch(() => {})
  }, [])

  const updateItem = (i, field, value) => {
    const copy = [...items]
    copy[i][field] = field === 'item_description' ? value : Number(value)
    setItems(copy)
  }

  const addItem = () => setItems([...items, { item_description: '', quantity: 1, unit_price: 0, tax_percent: 18 }])
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i))

  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0)
  const taxAmount = items.reduce((sum, it) => sum + it.quantity * it.unit_price * (it.tax_percent / 100), 0)
  const total = subtotal + taxAmount

  const handleSubmit = async (e, asDraft) => {
    e.preventDefault()
    try {
      await apiClient.post('/purchase-orders/', {
        ...form,
        vendor_id: Number(form.vendor_id),
        save_as_draft: asDraft,
        items,
      })
      navigate('/procurement')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create purchase order')
    }
  }

  return (
    <Layout title="Create Purchase Order" subtitle="Fill in the details below to create a new purchase order">
      {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-md mb-4">{error}</div>}

      <form onSubmit={(e) => handleSubmit(e, false)} className="grid grid-cols-[1fr_300px] gap-6 items-start">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="font-semibold text-sm mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Order details</div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Order number</label>
              <input required placeholder="PO-2025-0001" value={form.order_number}
                onChange={(e) => setForm({ ...form, order_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Vendor</label>
              <select required value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Select vendor</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Department</label>
              <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Expected delivery</label>
              <input type="date" value={form.expected_delivery_date}
                onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Payment terms</label>
              <input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Shipping address</label>
              <input value={form.shipping_address} onChange={(e) => setForm({ ...form, shipping_address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>

          <div className="font-semibold text-sm mb-3 mt-6" style={{ fontFamily: 'Sora, sans-serif' }}>Order items</div>
          <table className="w-full text-sm mb-3">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-2">Item</th><th className="py-2 w-20">Qty</th><th className="py-2 w-28">Unit Price</th><th className="py-2 w-20">Tax %</th><th className="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-2">
                    <input required value={it.item_description} onChange={(e) => updateItem(i, 'item_description', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm" placeholder="Item description" />
                  </td>
                  <td className="py-2 pr-2">
                    <input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm" />
                  </td>
                  <td className="py-2 pr-2">
                    <input type="number" min="0" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm" />
                  </td>
                  <td className="py-2 pr-2">
                    <input type="number" min="0" value={it.tax_percent} onChange={(e) => updateItem(i, 'tax_percent', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm" />
                  </td>
                  <td className="py-2">
                    <button type="button" onClick={() => removeItem(i)} className="text-red-500 text-xs">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addItem} className="text-sm text-[#14213D] font-semibold border border-gray-200 px-3 py-1.5 rounded-lg">
            + Add item
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-6">
          <div className="font-semibold text-sm mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Order summary</div>
          <div className="flex justify-between text-sm py-2.5 border-b border-gray-100 text-gray-500">
            <span>Subtotal</span><span className="text-[#14213D] font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-sm py-2.5 border-b border-gray-100 text-gray-500">
            <span>Tax</span><span className="text-[#14213D] font-medium">₹{taxAmount.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-sm py-2.5 font-bold text-[#14213D]">
            <span>Total</span><span>₹{total.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex flex-col gap-2.5 mt-5">
            <button type="button" onClick={(e) => handleSubmit(e, true)}
              className="border border-gray-200 text-[#14213D] py-2.5 rounded-lg text-sm font-semibold">
              Save as draft
            </button>
            <button type="submit" className="bg-[#14213D] text-white py-2.5 rounded-lg text-sm font-semibold">
              Submit for approval
            </button>
          </div>
        </div>
      </form>
    </Layout>
  )
}

export default CreatePurchaseOrder