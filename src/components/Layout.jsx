import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Webster CRM</div>
        <nav className="sidebar-nav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/leads">Leads</NavLink>
          <NavLink to="/customers">Customers</NavLink>
          <NavLink to="/jobs">Jobs</NavLink>
          <NavLink to="/calendar">Calendar</NavLink>
          <NavLink to="/door-knocking">Door Knocking</NavLink>
          <NavLink to="/account">Account</NavLink>
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-user">{user?.email}</span>
          <button className="btn-link" onClick={() => signOut()}>Sign out</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
