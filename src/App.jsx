import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Jobs from './pages/Jobs'
import Calendar from './pages/Calendar'
import DoorKnockMap from './pages/DoorKnockMap'
import Account from './pages/Account'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="door-knocking" element={<DoorKnockMap />} />
        <Route path="account" element={<Account />} />
      </Route>
    </Routes>
  )
}
