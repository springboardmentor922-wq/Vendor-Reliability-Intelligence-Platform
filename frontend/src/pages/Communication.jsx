import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import apiClient from '../api/client'

function Communication() {
  const [vendors, setVendors] = useState([])
  const [selectedVendor, setSelectedVendor] = useState('')
  const [notifications, setNotifications] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    apiClient.get('/vendors/').then((res) => {
      setVendors(res.data)
      if (res.data.length > 0) setSelectedVendor(String(res.data[0].id))
    }).catch(() => {})
  }, [])

  const loadThread = () => {
    apiClient.get('/notifications/').then((res) =>
      setNotifications(res.data.filter((n) => n.vendor_id === Number(selectedVendor)))
    ).catch(() => {})
  }

  useEffect(() => { if (selectedVendor) loadThread() }, [selectedVendor])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!message.trim()) return
    try {
      await apiClient.post('/notifications/', {
        vendor_id: Number(selectedVendor),
        type: 'procurement_alert',
        title: 'Message to vendor',
        message,
      })
      setMessage('')
      loadThread()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send message')
    }
  }

  const selectedVendorObj = vendors.find((v) => v.id === Number(selectedVendor))

  return (
    <Layout title="Communication" subtitle="Vendor messaging, procurement discussions, and activity logs">
      {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-md mb-4">{error}</div>}

      <div className="grid grid-cols-[280px_1fr] gap-5">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-xs text-gray-500 px-2.5 py-2">Vendors</div>
          {vendors.map((v) => (
            <div key={v.id} onClick={() => setSelectedVendor(String(v.id))}
              className={`px-2.5 py-3 rounded-md cursor-pointer mb-1 ${
                Number(selectedVendor) === v.id ? 'bg-[#FBF3E3]' : 'hover:bg-gray-50'
              }`}>
              <div className="text-sm font-semibold">{v.company_name}</div>
              <div className="text-xs text-gray-500 capitalize">{v.category.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col h-[460px]">
          <div className="font-semibold text-sm mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>
            {selectedVendorObj?.company_name || 'Select a vendor'}
          </div>
          <div className="flex-1 overflow-y-auto pr-1.5">
            {notifications.map((n) => (
              <div key={n.id} className="mb-4">
                <div className="text-xs text-gray-500 mb-1">{new Date(n.created_at).toLocaleString()}</div>
                <div className="bg-gray-100 px-3.5 py-2.5 rounded-lg text-sm inline-block max-w-[70%]">
                  {n.message}
                </div>
              </div>
            ))}
            {notifications.length === 0 && <div className="text-center text-gray-400 py-8">No messages yet.</div>}
          </div>
          <form onSubmit={handleSend} className="flex gap-2.5 mt-3">
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..."
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            <button type="submit" className="bg-[#14213D] text-white px-4 py-2.5 rounded-lg text-sm font-semibold">
              Send
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}

export default Communication