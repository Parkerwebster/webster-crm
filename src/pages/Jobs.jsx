import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { buildQuoteEmail } from '../lib/quoteEmail'
import { formatTimeRange } from '../lib/format'
import QuoteEmailModal from '../components/QuoteEmailModal'

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
  const [quoteEmail, setQuoteEmail] = useState(null)
  const [sendingInvoiceId, setSendingInvoiceId] = useState(null)

  async function loadJobs() {
    setLoading(true)
    const { data } = await supabase
      .from('jobs')
      .select('*, customers(id, name, address, phone, email), technicians(id, name, color)')
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

  function sendQuote(job) {
    setQuoteEmail(buildQuoteEmail(job.customers ?? {}, job))
  }

  async function sendInvoice(job) {
    const customer = job.customers ?? {}
    if (!customer.email) {
      alert('This customer has no email on file. Add one before sending an invoice.')
      return
    }
    if (!job.price) {
      alert('This job has no price set. Add a price before sending an invoice.')
      return
    }
    setSendingInvoiceId(job.id)
    const { data, error } = await supabase.functions.invoke('send-invoice', {
      body: {
        job_id: job.id,
        customer_name: customer.name,
        customer_email: customer.email,
        service_type: job.service_type,
        price: job.price,
        existing_payment_link_url: job.stripe_payment_link_url,
        existing_payment_link_id: job.stripe_payment_link_id,
      },
    })
    setSendingInvoiceId(null)
    if (error || !data?.ok) {
      alert('Failed to send invoice. Check that the job has a price and the customer has an email, then try again.')
      return
    }
    await supabase.from('jobs').update({
      stripe_payment_link_id: data.payment_link_id,
      stripe_payment_link_url: data.payment_link_url,
    }).eq('id', job.id)
    loadJobs()
  }

  function copyPaymentLink(job) {
    navigator.clipboard.writeText(job.stripe_payment_link_url)
    alert('Payment link copied!')
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
                {job.scheduled_date && (
                  <span>
                    Scheduled: {job.scheduled_date}
                    {job.start_time && ` · ${formatTimeRange(job.start_time, job.end_time)}`}
                  </span>
                )}
                <span className="muted">
                  Quoted {new Date(job.created_at).toLocaleDateString()}
                </span>
                {job.technicians && (
                  <span className="tech-badge">
                    <span className="tech-dot" style={{ background: job.technicians.color }} />
                    {job.technicians.name}
                  </span>
                )}
                {job.customers?.address && <span className="muted">{job.customers.address}</span>}
              </div>
              <div className="card-actions">
                <button className="btn-secondary" onClick={() => sendQuote(job)}>Send Quote</button>
                {job.price != null && (
                  job.stripe_payment_link_url ? (
                    <>
                      <button className="btn-secondary" disabled={sendingInvoiceId === job.id} onClick={() => sendInvoice(job)}>
                        {sendingInvoiceId === job.id ? 'Sending...' : 'Resend Invoice'}
                      </button>
                      <button className="btn-secondary" onClick={() => copyPaymentLink(job)}>Copy Payment Link</button>
                    </>
                  ) : (
                    <button disabled={sendingInvoiceId === job.id} onClick={() => sendInvoice(job)}>
                      {sendingInvoiceId === job.id ? 'Sending...' : 'Send Invoice'}
                    </button>
                  )
                )}
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

      {quoteEmail && (
        <QuoteEmailModal email={quoteEmail} onClose={() => setQuoteEmail(null)} />
      )}
    </div>
  )
}
