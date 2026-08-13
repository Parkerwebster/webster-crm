import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">Webster CRM</div>
          <button
            className="sidebar-menu-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        <div className={menuOpen ? 'sidebar-menu open' : 'sidebar-menu'}>
          <nav className="sidebar-nav" onClick={() => setMenuOpen(false)}>
            <NavLink to="/" end>Dashboard</NavLink>
            <NavLink to="/leads">Leads</NavLink>
            <NavLink to="/customers">Customers</NavLink>
            <NavLink to="/jobs">Jobs</NavLink>
            <NavLink to="/calendar">Calendar</NavLink>
            <NavLink to="/door-knocking">Door Knocking</NavLink>
            <NavLink to="/technicians">Technicians</NavLink>
            <NavLink to="/expenses">Expenses</NavLink>
            <NavLink to="/account">Account</NavLink>
          </nav>
          <div className="sidebar-footer">
            <span className="sidebar-user">{user?.email}</span>
            <button className="btn-link" onClick={() => signOut()}>Sign out</button>
          </div>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
