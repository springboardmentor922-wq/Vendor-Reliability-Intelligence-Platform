import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import apiClient from '../api/client'

function VendorPortal() {
  const [notifications, setNotifications] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    apiClient.get('/notifications/').then((res) => setNotifications(res.data)).catch((err) => setError(err.response?.data?.detail || 'Failed to load messages'))
  }

  useEffect(() => { load() }, [])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!message.trim()) return
    try {
      await apiClient.post('/notifications/vendor-reply', { message })
      setMessage('')
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send message')
    }
  }

  return (
    <Layout title="Vendor Portal" subtitle="Messages and alerts from the procurement team">
      {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-md mb-4">{error}</div>}
      <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col h-[460px]">
        <div className="flex-1 overflow-y-auto pr-1.5">
          {notifications.map((n) => (
            <div key={n.id} className={`mb-4 flex ${n.sender === 'vendor' ? 'justify-end' : 'justify-start'}`}>
              <div>
                <div className={`text-xs text-gray-500 mb-1 ${n.sender === 'vendor' ? 'text-right' : ''}`}>
                  {n.sender === 'vendor' ? 'You' : 'Procurement Team'} · {new Date(n.created_at).toLocaleString()}
                </div>
                <div className={`px-3.5 py-2.5 rounded-lg text-sm inline-block max-w-[70%] ${
                  n.sender === 'vendor' ? 'bg-[#14213D] text-white' : 'bg-gray-100'
                }`}>
                  {n.title && n.sender !== 'vendor' && <div className="font-semibold mb-0.5">{n.title}</div>}
                  {n.message}
                </div>
              </div>
            </div>
          ))}
          {notifications.length === 0 && <div className="text-center text-gray-400 py-8">No messages yet.</div>}
        </div>
        <form onSubmit={handleSend} className="flex gap-2.5 mt-3">
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Reply to procurement..."
            className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
          <button type="submit" className="bg-[#14213D] text-white px-4 py-2.5 rounded-lg text-sm font-semibold">
            Send
          </button>
        </form>
      </div>
    </Layout>
  )
}

export default VendorPortal