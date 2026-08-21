import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { formatTimeRange, localDateStr } from '../lib/format'
import { useAccount } from '../context/AccountContext'

function buildRouteUrl(jobs) {
  const stops = jobs
    .filter((j) => j.customers?.address)
    .map((j) => j.customers.address)
  if (stops.length === 0) return null
  return `https://www.google.com/maps/dir/${stops.map(encodeURIComponent).join('/')}`
}

export default function Dashboard() {
  const { accountId } = useAccount()
  const [loading, setLoading] = useState(true)
  const [todayJobs, setTodayJobs] = useState([])
  const [upcomingJobs, setUpcomingJobs] = useState([])
  const [unpaid, setUnpaid] = useState({ count: 0, total: 0 })
  const [recentLeads, setRecentLeads] = useState([])
  const [dueForService, setDueForService] = useState([])
  const [overdueInvoices, setOverdueInvoices] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [remindingId, setRemindingId] = useState(null)
  const [revenue, setRevenue] = useState({ today: 0, month: 0, allTime: 0 })

  async function load() {
    setLoading(true)
    const today = new Date()
    const in7Days = new Date(today)
    in7Days.setDate(today.getDate() + 7)
    const in14Days = new Date(today)
    in14Days.setDate(today.getDate() + 14)
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const todayStr = localDateStr(today)
    const weekStr = localDateStr(in7Days)
    const dueStr = localDateStr(in14Days)

    const [
      { data: jobsData },
      { data: unpaidData },
      { data: leadsData },
      { data: dueData },
      { data: overdueData },
      { data: followUpData },
      { data: paidData },
    ] = await Promise.all([
      supabase
        .from('jobs')
        .select('*, customers(id, name, address), technicians(id, name, color)')
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
      supabase
        .from('customers')
        .select('id, name, address, next_service_date')
        .not('next_service_date', 'is', null)
        .lte('next_service_date', dueStr)
        .order('next_service_date', { ascending: true }),
      supabase
        .from('jobs')
        .select('*, customers(id, name, email, address)')
        .eq('status', 'invoiced')
        .not('invoice_sent_at', 'is', null)
        .lte('invoice_sent_at', sevenDaysAgo.toISOString())
        .order('invoice_sent_at', { ascending: true }),
      supabase
        .from('leads')
        .select('*')
        .eq('converted', false)
        .not('follow_up_date', 'is', null)
        .lte('follow_up_date', todayStr)
        .order('follow_up_date', { ascending: true }),
      supabase.from('jobs').select('price, paid_at').eq('status', 'paid'),
    ])

    setUpcomingJobs(jobsData ?? [])
    setTodayJobs((jobsData ?? []).filter((j) => j.scheduled_date === todayStr))
    const total = (unpaidData ?? []).reduce((sum, j) => sum + (Number(j.price) || 0), 0)
    setUnpaid({ count: (unpaidData ?? []).length, total })
    setRecentLeads(leadsData ?? [])
    setDueForService(dueData ?? [])
    setOverdueInvoices(overdueData ?? [])
    setFollowUps(followUpData ?? [])

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const revenueTotals = (paidData ?? []).reduce(
      (acc, job) => {
        const amount = Number(job.price) || 0
        acc.allTime += amount
        if (job.paid_at) {
          const paidDate = new Date(job.paid_at)
          if (paidDate >= monthStart) acc.month += amount
          if (paidDate >= todayStart) acc.today += amount
        }
        return acc
      },
      { today: 0, month: 0, allTime: 0 }
    )
    setRevenue(revenueTotals)

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function sendReminder(job) {
    const customer = job.customers ?? {}
    if (!customer.email || !job.price) return
    setRemindingId(job.id)
    const { data, error } = await supabase.functions.invoke('send-invoice', {
      body: {
        job_id: job.id,
        account_id: accountId,
        customer_name: customer.name,
        customer_email: customer.email,
        service_type: job.service_type,
        price: job.price,
        existing_payment_link_url: job.stripe_payment_link_url,
        existing_payment_link_id: job.stripe_payment_link_id,
      },
    })
    if (!error && data?.ok) {
      await supabase.from('jobs').update({ invoice_sent_at: new Date().toISOString() }).eq('id', job.id)
      load()
    }
    setRemindingId(null)
  }

  if (loading) return <p>Loading...</p>

  const routeUrl = buildRouteUrl(todayJobs)

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <h2 style={{ marginTop: 0 }}>Revenue</h2>
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">${revenue.today.toFixed(2)}</span>
          <span className="stat-label">Today</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">${revenue.month.toFixed(2)}</span>
          <span className="stat-label">This Month</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">${revenue.allTime.toFixed(2)}</span>
          <span className="stat-label">All Time</span>
        </div>
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

      <section>
        <div className="page-header">
          <h2 style={{ margin: 0 }}>Today's Jobs</h2>
          {routeUrl && (
            <a className="btn-secondary" href={routeUrl} target="_blank" rel="noreferrer">
              Open Route in Maps
            </a>
          )}
        </div>
        {todayJobs.length === 0 ? (
          <p className="empty-state">Nothing scheduled today.</p>
        ) : (
          <div className="card-list">
            {todayJobs.map((job) => (
              <div className="card" key={job.id}>
                <div className="card-main">
                  <Link to={`/customers/${job.customers?.id}`} className="strong">
                    {job.customers?.name}
                  </Link>
                  {job.start_time && <span>{formatTimeRange(job.start_time, job.end_time)}</span>}
                  <span>{job.service_type}</span>
                  {job.price != null && <span>${Number(job.price).toFixed(2)}</span>}
                  <span className="muted">{job.customers?.address}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {(dueForService.length > 0 || overdueInvoices.length > 0 || followUps.length > 0) && (
        <div className="dashboard-grid">
          {dueForService.length > 0 && (
            <section>
              <h2>Due for Service</h2>
              <div className="card-list">
                {dueForService.map((c) => (
                  <div className="card" key={c.id}>
                    <div className="card-main">
                      <Link to={`/customers/${c.id}`} className="strong">{c.name}</Link>
                      <span className="muted">{c.address}</span>
                      <span>Due {new Date(c.next_service_date + 'T00:00:00').toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {overdueInvoices.length > 0 && (
            <section>
              <h2>Overdue Invoices</h2>
              <div className="card-list">
                {overdueInvoices.map((job) => (
                  <div className="card" key={job.id}>
                    <div className="card-main">
                      <Link to={`/customers/${job.customers?.id}`} className="strong">{job.customers?.name}</Link>
                      <span>${Number(job.price).toFixed(2)}</span>
                      <span className="muted">Sent {new Date(job.invoice_sent_at).toLocaleDateString()}</span>
                    </div>
                    <div className="card-actions">
                      <button disabled={remindingId === job.id} onClick={() => sendReminder(job)}>
                        {remindingId === job.id ? 'Sending...' : 'Send Reminder'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {followUps.length > 0 && (
            <section>
              <h2>Follow-ups Due</h2>
              <div className="card-list">
                {followUps.map((lead) => (
                  <div className="card" key={lead.id}>
                    <div className="card-main">
                      <strong>{lead.name}</strong>
                      <span>{lead.phone}</span>
                      <span className="muted">Due {new Date(lead.follow_up_date + 'T00:00:00').toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/leads" className="link">View all leads &rarr;</Link>
            </section>
          )}
        </div>
      )}

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
                    <span>{job.scheduled_date}{job.start_time && ` · ${formatTimeRange(job.start_time, job.end_time)}`}</span>
                    <span>{job.service_type}</span>
                    {job.price != null && <span>${Number(job.price).toFixed(2)}</span>}
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
