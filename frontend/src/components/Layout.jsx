import { Link, useLocation, useNavigate } from 'react-router-dom'

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

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="grid grid-cols-[236px_1fr] min-h-screen">
      {/* Sidebar */}
      <div className="bg-[#14213D] text-white p-6 flex flex-col">
        <div className="font-bold text-lg mb-1" style={{ fontFamily: 'Sora, sans-serif' }}>
          VendorIQ
        </div>
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
          <button onClick={handleLogout} className="text-[#C6CCE0] hover:text-white">
            Log out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="p-10 bg-[#F7F8FA]">
        <div className="flex justify-between items-center mb-7">
          <div>
            <h1 className="text-2xl font-bold text-[#14213D]" style={{ fontFamily: 'Sora, sans-serif' }}>
              {title}
            </h1>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

export default Layout