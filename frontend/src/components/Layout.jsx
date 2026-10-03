import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import apiClient from '../api/client'

const navItems = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/vendors', label: 'Vendors' },
  { path: '/procurement', label: 'Procurement' },
  { path: '/new-request', label: 'New Request' },
  { path: '/purchase-orders/new', label: 'Create Purchase Order' },
  { path: '/performance', label: 'Vendor Performance' },
  { path: '/contracts', label: 'Contracts' },
  { path: '/communication', label: 'Communication' },
  { path: '/reports', label: 'Reports & Export' },
  { path: '/notifications', label: 'Notifications' },
]

function Layout({ children, title, subtitle }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  const handleSearch = async (e) => {
    const val = e.target.value
    setQuery(val)
    if (val.length < 2) { setResults(null); return }
    try {
      const res = await apiClient.get(`/search?q=${encodeURIComponent(val)}`)
      setResults(res.data)
    } catch { setResults(null) }
  }

  const goTo = (type, id) => {
    setQuery('')
    setResults(null)
    if (type === 'vendor') navigate(`/vendors/${id}`)
    else if (type === 'purchase_order') navigate('/procurement')
    else if (type === 'contract') navigate('/contracts')
  }

  return (
    <div className="grid grid-cols-[236px_1fr] min-h-screen">
      <div className="bg-[#14213D] text-white p-6 flex flex-col">
        <div className="font-bold text-lg mb-1" style={{ fontFamily: 'Sora, sans-serif' }}>VendorIQ</div>
        <div className="text-xs text-[#8B95B3] mb-8">Vendor Reliability Intelligence</div>

        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium mb-0.5 ${
              location.pathname === item.path
                ? 'bg-[#C9962C] text-[#14213D] font-semibold'
                : 'text-[#C6CCE0] hover:bg-[#1E2E52] hover:text-white'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
            {item.label}
          </Link>
        ))}

        <div className="mt-auto pt-4 border-t border-[#1E2E52] text-xs text-[#8B95B3]">
          <button onClick={handleLogout} className="text-[#C6CCE0] hover:text-white">Log out</button>
        </div>
      </div>

      <div className="p-10 bg-[#F7F8FA]">
        <div className="flex justify-between items-start mb-7 gap-6">
          <div>
            <h1 className="text-2xl font-bold text-[#14213D]" style={{ fontFamily: 'Sora, sans-serif' }}>{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <div className="relative w-72">
            <input
              value={query}
              onChange={handleSearch}
              placeholder="Search vendors, POs, contracts..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            />
            {results && (
              <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-72 overflow-y-auto">
                {results.vendors.map((r) => (
                  <div key={`v-${r.id}`} onClick={() => goTo('vendor', r.id)} className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                    <span className="text-xs text-gray-400 mr-2">Vendor</span>{r.name}
                  </div>
                ))}
                {results.purchase_orders.map((r) => (
                  <div key={`po-${r.id}`} onClick={() => goTo('purchase_order', r.id)} className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                    <span className="text-xs text-gray-400 mr-2">PO</span>{r.name}
                  </div>
                ))}
                {results.contracts.map((r) => (
                  <div key={`c-${r.id}`} onClick={() => goTo('contract', r.id)} className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                    <span className="text-xs text-gray-400 mr-2">Contract</span>{r.name}
                  </div>
                ))}
                {results.vendors.length + results.purchase_orders.length + results.contracts.length === 0 && (
                  <div className="px-3 py-3 text-sm text-gray-400">No matches</div>
                )}
              </div>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

export default Layout