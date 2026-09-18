import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import apiClient from '../api/client'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const response = await apiClient.post('/auth/login', { email, password })
      localStorage.setItem('token', response.data.access_token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-[380px]">
        <div className="text-center mb-7">
          <div className="font-bold text-2xl text-[#14213D]" style={{ fontFamily: 'Sora, sans-serif' }}>
            VendorIQ
          </div>
          <div className="text-xs text-gray-500 mt-1">Vendor Reliability Intelligence</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-8">
          <h2 className="font-semibold text-lg text-[#14213D] mb-1" style={{ fontFamily: 'Sora, sans-serif' }}>
            Welcome back
          </h2>
          <p className="text-sm text-gray-500 mb-5">Sign in to your account</p>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-md mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5 text-[#14213D]">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#14213D]"
                required
              />
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium mb-1.5 text-[#14213D]">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#14213D]"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#14213D] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1E2E52]"
            >
              Sign in
            </button>
          </form>

          <div className="text-center text-sm text-gray-500 mt-4">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#14213D] font-semibold">
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login