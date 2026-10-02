import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Vendors from './pages/Vendors'
import VendorDetail from './pages/VendorDetail'
import Procurement from './pages/Procurement'
import NewRequest from './pages/NewRequest'
import CreatePurchaseOrder from './pages/CreatePurchaseOrder'
import Performance from './pages/Performance'
import Contracts from './pages/Contracts'
import Communication from './pages/Communication'
import Notifications from './pages/Notifications'
import Reports from './pages/Reports'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
      <Route path="/vendors/:id" element={<ProtectedRoute><VendorDetail /></ProtectedRoute>} />
      <Route path="/procurement" element={<ProtectedRoute><Procurement /></ProtectedRoute>} />
      <Route path="/new-request" element={<ProtectedRoute><NewRequest /></ProtectedRoute>} />
      <Route path="/purchase-orders/new" element={<ProtectedRoute><CreatePurchaseOrder /></ProtectedRoute>} />
      <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
      <Route path="/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
      <Route path="/communication" element={<ProtectedRoute><Communication /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />

      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App