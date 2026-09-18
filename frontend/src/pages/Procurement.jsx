import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import apiClient from '../api/client'

function NewRequest() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ request_number: '', title: '', department: 'Information Technology', description: '' })
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await apiClient.post('/procurement-requests/', form)
      navigate('/procurement')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create request')
    }
  }

  return (
    <Layout title="New Procurement Request" subtitle="Describe what's needed — this gets routed for approval">
      {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-md mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Request number</label>
            <input required placeholder="PR-2025-0125" value={form.request_number}
              onChange={(e) => setForm({ ...form, request_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Department</label>
            <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option>Information Technology</option>
              <option>Operations</option>
              <option>Finance</option>
              <option>Human Resources</option>
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1.5">Title</label>
          <input required placeholder="e.g. Laptops for IT Team" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1.5">Description / Justification</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm min-h-[90px]" />
        </div>
        <button type="submit" className="bg-[#14213D] text-white px-5 py-2.5 rounded-lg text-sm font-semibold">
          Submit request
        </button>
      </form>
    </Layout>
  )
}

export default NewRequest