import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const FILTERS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'all', label: 'All' },
]

const STATUS_FLOW = ['quoted', 'scheduled', 'completed', 'invoiced', 'paid']

function nextStatus(status) {
  const idx = STATUS_FLOW.indexOf(status)
  return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null
}

export default function Jobs() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('upcoming')

  async function loadJobs() {
    setLoading(true)
    const { data } = await supabase
      .from('jobs')
      .select('*, customers(id, name, address, phone)')
      .order('scheduled_date', { ascending: true, nullsFirst: false })
    setJobs(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadJobs()
  }, [])

  async function advanceStatus(job) {
    const next = nextStatus(job.status)
    if (!next) return
    await supabase.from('jobs').update({ status: next, updated_at: new Date().toISOString() }).eq('id', job.id)
    loadJobs()
  }

  const today = new Date().toISOString().slice(0, 10)

  const filtered = jobs.filter((job) => {
    if (filter === 'upcoming') return job.scheduled_date && job.scheduled_date >= today && job.status !== 'paid'
    if (filter === 'unpaid') return ['completed', 'invoiced'].includes(job.status)
    return true
  })

  return (
    <div>
      <div className="page-header">
        <h1>Jobs</h1>
      </div>

      <div className="tab-bar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? 'tab active' : 'tab'}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">Nothing here.</p>
      ) : (
        <div className="card-list">
          {filtered.map((job) => (
            <div className="card" key={job.id}>
              <div className="card-main">
                <Link to={`/customers/${job.customers?.id}`} className="strong">
                  {job.customers?.name ?? 'Unknown customer'}
                </Link>
                <span className={`status-badge status-${job.status}`}>{job.status}</span>
                <span>{job.service_type}</span>
                {job.price != null && <span>${Number(job.price).toFixed(2)}</span>}
                {job.scheduled_date && <span>{job.scheduled_date}</span>}
                {job.customers?.address && <span className="muted">{job.customers.address}</span>}
              </div>
              <div className="card-actions">
                {nextStatus(job.status) && (
                  <button onClick={() => advanceStatus(job)}>
                    Mark {nextStatus(job.status)}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
