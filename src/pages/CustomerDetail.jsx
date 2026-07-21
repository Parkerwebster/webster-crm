import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { buildQuoteEmail } from '../lib/quoteEmail'
import QuoteEmailModal from '../components/QuoteEmailModal'

const STATUS_FLOW = ['quoted', 'scheduled', 'completed', 'invoiced', 'paid']

const WINDOW_TYPES = [
  'Window Cleaning (Exterior Only)',
  'Window Cleaning (Interior and Exterior)',
]

const TRACKS_OPTIONS = ['None', 'Tracks & Screens Cleaning']

function nextStatus(status) {
  const idx = STATUS_FLOW.indexOf(status)
  return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null
}

export default function CustomerDetail() {
  const { id } = useParams()
  const [customer, setCustomer] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [quoteEmail, setQuoteEmail] = useState(null)
  const [form, setForm] = useState({
    windowType: WINDOW_TYPES[0],
    windowPrice: '',
    tracksOption: TRACKS_OPTIONS[0],
    tracksPrice: '',
    scheduled_date: '',
    notes: '',
  })

  async function loadData() {
    setLoading(true)
    const [{ data: customerData }, { data: jobsData }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('jobs').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
    ])
    setCustomer(customerData)
    setJobs(jobsData ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [id])

  async function handleAddJob(e) {
    e.preventDefault()

    const hasTracks = form.tracksOption !== 'None'
    const serviceType = hasTracks ? `${form.windowType} + ${form.tracksOption}` : form.windowType
    const total = (form.windowPrice ? Number(form.windowPrice) : 0)
      + (hasTracks && form.tracksPrice ? Number(form.tracksPrice) : 0)

    await supabase.from('jobs').insert([{
      customer_id: id,
      service_type: serviceType,
      price: total > 0 ? total : null,
      scheduled_date: form.scheduled_date || null,
      notes: form.notes,
    }])
    setForm({
      windowType: WINDOW_TYPES[0],
      windowPrice: '',
      tracksOption: TRACKS_OPTIONS[0],
      tracksPrice: '',
      scheduled_date: '',
      notes: '',
    })
    setShowForm(false)
    loadData()
  }

  async function advanceStatus(job) {
    const next = nextStatus(job.status)
    if (!next) return
    await supabase.from('jobs').update({ status: next, updated_at: new Date().toISOString() }).eq('id', job.id)
    loadData()
  }

  async function deleteJob(job) {
    await supabase.from('jobs').delete().eq('id', job.id)
    loadData()
  }

  function sendQuote(job) {
    setQuoteEmail(buildQuoteEmail(customer, job))
  }

  if (loading) return <p>Loading...</p>
  if (!customer) return <p>Customer not found.</p>

  return (
    <div>
      <Link to="/customers" className="back-link">&larr; All Customers</Link>

      <div className="page-header">
        <h1>{customer.name}</h1>
      </div>

      <div className="card customer-info">
        <div><strong>Phone:</strong> {customer.phone || '—'}</div>
        <div><strong>Email:</strong> {customer.email || '—'}</div>
        <div><strong>Address:</strong> {customer.address || '—'}</div>
        <div><strong>Source:</strong> {customer.source || '—'}</div>
        {customer.notes && <div><strong>Notes:</strong> {customer.notes}</div>}
      </div>

      <div className="page-header">
        <h2>Jobs</h2>
        <button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Add Job'}
        </button>
      </div>

      {showForm && (
        <form className="card form-grid" onSubmit={handleAddJob}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
            Window Cleaning
          </label>
          <select value={form.windowType}
            onChange={(e) => setForm({ ...form, windowType: e.target.value })}>
            {WINDOW_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" step="0.01" placeholder="Window Cleaning Price ($)" value={form.windowPrice}
            onChange={(e) => setForm({ ...form, windowPrice: e.target.value })} />

          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
            Tracks &amp; Screens
          </label>
          <select value={form.tracksOption}
            onChange={(e) => setForm({ ...form, tracksOption: e.target.value })}>
            {TRACKS_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {form.tracksOption !== 'None' && (
            <input type="number" step="0.01" placeholder="Tracks & Screens Price ($)" value={form.tracksPrice}
              onChange={(e) => setForm({ ...form, tracksPrice: e.target.value })} />
          )}

          <input type="date" value={form.scheduled_date}
            onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
          <textarea placeholder="Notes" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit">Save Job</button>
        </form>
      )}

      {jobs.length === 0 ? (
        <p className="empty-state">No jobs yet for this customer.</p>
      ) : (
        <div className="card-list">
          {jobs.map((job) => (
            <div className="card" key={job.id}>
              <div className="card-main">
                <strong>{job.service_type}</strong>
                <span className={`status-badge status-${job.status}`}>{job.status}</span>
                {job.price != null && <span>${Number(job.price).toFixed(2)}</span>}
                {job.scheduled_date && <span>{job.scheduled_date}</span>}
                {job.notes && <p className="card-notes">{job.notes}</p>}
              </div>
              <div className="card-actions">
                <button className="btn-secondary" onClick={() => sendQuote(job)}>Send Quote</button>
                {nextStatus(job.status) && (
                  <button onClick={() => advanceStatus(job)}>
                    Mark {nextStatus(job.status)}
                  </button>
                )}
                <button className="btn-secondary" onClick={() => deleteJob(job)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {quoteEmail && (
        <QuoteEmailModal email={quoteEmail} onClose={() => setQuoteEmail(null)} />
      )}
    </div>
  )
}
