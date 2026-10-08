import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import apiClient from '../api/client'

function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [error, setError] = useState('')

  const load = () => {
    apiClient.get('/notifications/').then((res) => setNotifications(res.data)).catch((err) => setError(err.response?.data?.detail || 'Failed to load notifications'))
  }

  useEffect(() => { load() }, [])

  const markRead = async (id) => {
    try {
      await apiClient.put(`/notifications/${id}/read`)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update')
    }
  }

  return (
    <Layout title="Notifications" subtitle="Alerts across procurement, vendors, and compliance">
      {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-md mb-4">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {notifications.map((n) => (
          <div key={n.id} className="flex gap-3.5 py-4 border-b border-gray-100 last:border-0">
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.is_read ? 'bg-gray-200' : 'bg-[#C9962C]'}`} />
            <div className="flex-1">
              <div className="text-sm font-semibold mb-0.5">{n.title}</div>
              <div className="text-sm text-gray-500">{n.message}</div>
            </div>
            <div className="text-xs text-gray-400 whitespace-nowrap">
              {new Date(n.created_at).toLocaleDateString()}
              {!n.is_read && (
                <button onClick={() => markRead(n.id)} className="block text-[#14213D] font-semibold mt-1">
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
        {notifications.length === 0 && <div className="text-center text-gray-400 py-8">No notifications.</div>}
      </div>
    </Layout>
  )
}

export default Notifications