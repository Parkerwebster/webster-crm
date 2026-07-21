import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [upcomingJobs, setUpcomingJobs] = useState([])
  const [unpaid, setUnpaid] = useState({ count: 0, total: 0 })
  const [recentLeads, setRecentLeads] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const today = new Date()
      const in7Days = new Date(today)
      in7Days.setDate(today.getDate() + 7)
      const todayStr = today.toISOString().slice(0, 10)
      const weekStr = in7Days.toISOString().slice(0, 10)

      const [{ data: jobsData }, { data: unpaidData }, { data: leadsData }] = await Promise.all([
        supabase
          .from('jobs')
          .select('*, customers(id, name, address)')
          .gte('scheduled_date', todayStr)
          .lte('scheduled_date', weekStr)
          .order('scheduled_date', { ascending: true }),
        supabase.from('jobs').select('price').in('status', ['completed', 'invoiced']),
        supabase
          .from('leads')
          .select('*')
          .eq('converted', false)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      setUpcomingJobs(jobsData ?? [])
      const total = (unpaidData ?? []).reduce((sum, j) => sum + (Number(j.price) || 0), 0)
      setUnpaid({ count: (unpaidData ?? []).length, total })
      setRecentLeads(leadsData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p>Loading...</p>

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{upcomingJobs.length}</span>
          <span className="stat-label">Jobs this week</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">${unpaid.total.toFixed(2)}</span>
          <span className="stat-label">{unpaid.count} unpaid invoice{unpaid.count === 1 ? '' : 's'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{recentLeads.length}</span>
          <span className="stat-label">Open leads</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <section>
          <h2>This Week's Jobs</h2>
          {upcomingJobs.length === 0 ? (
            <p className="empty-state">Nothing scheduled this week.</p>
          ) : (
            <div className="card-list">
              {upcomingJobs.map((job) => (
                <div className="card" key={job.id}>
                  <div className="card-main">
                    <Link to={`/customers/${job.customers?.id}`} className="strong">
                      {job.customers?.name}
                    </Link>
                    <span>{job.scheduled_date}</span>
                    <span className="muted">{job.customers?.address}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2>Recent Leads</h2>
          {recentLeads.length === 0 ? (
            <p className="empty-state">No open leads.</p>
          ) : (
            <div className="card-list">
              {recentLeads.map((lead) => (
                <div className="card" key={lead.id}>
                  <div className="card-main">
                    <strong>{lead.name}</strong>
                    <span>{lead.phone}</span>
                    <span className="muted">{new Date(lead.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link to="/leads" className="link">View all leads &rarr;</Link>
        </section>
      </div>
    </div>
  )
}
