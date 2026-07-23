import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { buildQuoteEmail } from '../lib/quoteEmail'
import { formatTimeRange } from '../lib/format'
import QuoteEmailModal from '../components/QuoteEmailModal'

const STATUS_FLOW = ['quoted', 'scheduled', 'completed', 'invoiced', 'paid']

const WINDOW_TYPES = [
  'Window Cleaning (Exterior Only)',
  'Window Cleaning (Interior and Exterior)',
]

const TRACKS_OPTIONS = ['None', 'Screen Cleaning', 'Screen Cleaning and Deep Track Cleaning']

const SOURCE_OPTIONS = ['Website', 'Door Knocking', 'Referral']

const EMPTY_JOB_FORM = {
  windowType: WINDOW_TYPES[0],
  windowPrice: '',
  tracksOption: TRACKS_OPTIONS[0],
  tracksPrice: '',
  scheduled_date: '',
  startTime: '',
  endTime: '',
  notes: '',
}

function nextStatus(status) {
  const idx = STATUS_FLOW.indexOf(status)
  return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null
}

function parseServiceType(serviceType) {
  const windowType = WINDOW_TYPES.find((t) => serviceType?.startsWith(t)) || WINDOW_TYPES[0]
  const tracksOption = TRACKS_OPTIONS.find((t) => t !== 'None' && serviceType?.includes(t)) || 'None'
  return { windowType, tracksOption }
}

function customerToInfoForm(customer) {
  return {
    phone: customer.phone || '',
    email: customer.email || '',
    address: customer.address || '',
    source: customer.source || '',
    referral_name: customer.referral_name || '',
    notes: customer.notes || '',
  }
}

function jobToEditForm(job) {
  const { windowType, tracksOption } = parseServiceType(job.service_type)
  return {
    windowType,
    tracksOption,
    price: job.price != null ? String(job.price) : '',
    scheduled_date: job.scheduled_date || '',
    startTime: job.start_time ? job.start_time.slice(0, 5) : '',
    endTime: job.end_time ? job.end_time.slice(0, 5) : '',
    notes: job.notes || '',
  }
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [quoteEmail, setQuoteEmail] = useState(null)
  const [form, setForm] = useState(EMPTY_JOB_FORM)
  const [editingJobId, setEditingJobId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editingInfo, setEditingInfo] = useState(false)
  const [infoForm, setInfoForm] = useState(null)
  const [sendingInvoiceId, setSendingInvoiceId] = useState(null)

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
      start_time: form.startTime || null,
      end_time: form.endTime || null,
      notes: form.notes,
    }])
    setForm(EMPTY_JOB_FORM)
    setShowForm(false)
    loadData()
  }

  function startEditInfo() {
    setInfoForm(customerToInfoForm(customer))
    setEditingInfo(true)
  }

  async function handleUpdateInfo(e) {
    e.preventDefault()
    await supabase.from('customers').update({
      phone: infoForm.phone,
      email: infoForm.email,
      address: infoForm.address,
      source: infoForm.source,
      referral_name: infoForm.source === 'Referral' ? infoForm.referral_name : null,
      notes: infoForm.notes,
    }).eq('id', id)
    setEditingInfo(false)
    setInfoForm(null)
    loadData()
  }

  function startEdit(job) {
    setEditingJobId(job.id)
    setEditForm(jobToEditForm(job))
  }

  async function handleUpdateJob(e, job) {
    e.preventDefault()

    const hasTracks = editForm.tracksOption !== 'None'
    const serviceType = hasTracks ? `${editForm.windowType} + ${editForm.tracksOption}` : editForm.windowType

    await supabase.from('jobs').update({
      service_type: serviceType,
      price: editForm.price ? Number(editForm.price) : null,
      scheduled_date: editForm.scheduled_date || null,
      start_time: editForm.startTime || null,
      end_time: editForm.endTime || null,
      notes: editForm.notes,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id)

    setEditingJobId(null)
    setEditForm(null)
    loadData()
  }

  async function advanceStatus(job) {
    const next = nextStatus(job.status)
    if (!next) return
    await supabase.from('jobs').update({ status: next, updated_at: new Date().toISOString() }).eq('id', job.id)
    loadData()
  }

  async function deleteJob(job) {
    if (!window.confirm('Delete this quote/job? This can\'t be undone.')) return
    await supabase.from('jobs').delete().eq('id', job.id)
    loadData()
  }

  function sendQuote(job) {
    setQuoteEmail(buildQuoteEmail(customer, job))
  }

  async function sendInvoice(job) {
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
    loadData()
  }

  function copyPaymentLink(job) {
    navigator.clipboard.writeText(job.stripe_payment_link_url)
    alert('Payment link copied!')
  }

  async function deleteCustomer() {
    if (!window.confirm(`Delete "${customer.name}" and all their jobs/quotes? This can't be undone.`)) return
    await supabase.from('customers').delete().eq('id', id)
    navigate('/customers')
  }

  async function convertToLead() {
    if (!window.confirm(`Move "${customer.name}" back to Leads? This deletes their customer record and job/quote history.`)) return
    await supabase.from('leads').insert([{
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      message: customer.notes,
      source: customer.source,
      referral_name: customer.referral_name,
    }])
    await supabase.from('customers').delete().eq('id', id)
    navigate('/leads')
  }

  if (loading) return <p>Loading...</p>
  if (!customer) return <p>Customer not found.</p>

  return (
    <div>
      <Link to="/customers" className="back-link">&larr; All Customers</Link>

      <div className="page-header">
        <h1>{customer.name}</h1>
        <div className="card-actions">
          <button onClick={startEditInfo}>Edit Customer Details</button>
          <button className="btn-secondary" onClick={convertToLead}>Convert to Lead</button>
          <button className="btn-secondary" onClick={deleteCustomer}>Delete Customer</button>
        </div>
      </div>

      {editingInfo ? (
        <form className="card form-grid" onSubmit={handleUpdateInfo}>
          <input placeholder="Phone" value={infoForm.phone}
            onChange={(e) => setInfoForm({ ...infoForm, phone: e.target.value })} />
          <input placeholder="Email" value={infoForm.email}
            onChange={(e) => setInfoForm({ ...infoForm, email: e.target.value })} />
          <input placeholder="Address" value={infoForm.address}
            onChange={(e) => setInfoForm({ ...infoForm, address: e.target.value })} />

          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
            How did you get this customer?
          </label>
          <select value={infoForm.source}
            onChange={(e) => setInfoForm({ ...infoForm, source: e.target.value })}>
            <option value="">Select...</option>
            {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {infoForm.source === 'Referral' && (
            <input placeholder="Referred by..." value={infoForm.referral_name}
              onChange={(e) => setInfoForm({ ...infoForm, referral_name: e.target.value })} />
          )}

          <textarea placeholder="Notes" value={infoForm.notes}
            onChange={(e) => setInfoForm({ ...infoForm, notes: e.target.value })} />

          <div className="card-actions">
            <button type="submit">Save Changes</button>
            <button type="button" className="btn-secondary" onClick={() => setEditingInfo(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="card customer-info-grid">
          <div className="customer-info-item">
            <span className="customer-info-label">Phone</span>
            <span>{customer.phone || '—'}</span>
          </div>
          <div className="customer-info-item">
            <span className="customer-info-label">Email</span>
            <span>{customer.email || '—'}</span>
          </div>
          <div className="customer-info-item">
            <span className="customer-info-label">Address</span>
            <span>{customer.address || '—'}</span>
          </div>
          <div className="customer-info-item">
            <span className="customer-info-label">Source</span>
            <span>
              {customer.source || '—'}
              {customer.source === 'Referral' && customer.referral_name ? ` — ${customer.referral_name}` : ''}
            </span>
          </div>
          {customer.notes && (
            <div className="customer-info-item customer-info-notes">
              <span className="customer-info-label">Notes</span>
              <span>{customer.notes}</span>
            </div>
          )}
        </div>
      )}

      <div className="page-header">
        <h2>Jobs</h2>
        <button onClick={() => { setShowForm((v) => !v); setForm(EMPTY_JOB_FORM) }}>
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

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="job-start-time">Start Time</label>
              <input id="job-start-time" type="time" value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div className="form-field">
              <label htmlFor="job-end-time">End Time</label>
              <input id="job-end-time" type="time" value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </div>
          </div>

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
              {editingJobId === job.id ? (
                <form className="form-grid" style={{ marginBottom: 0 }} onSubmit={(e) => handleUpdateJob(e, job)}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                    Window Cleaning
                  </label>
                  <select value={editForm.windowType}
                    onChange={(e) => setEditForm({ ...editForm, windowType: e.target.value })}>
                    {WINDOW_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>

                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                    Tracks &amp; Screens
                  </label>
                  <select value={editForm.tracksOption}
                    onChange={(e) => setEditForm({ ...editForm, tracksOption: e.target.value })}>
                    {TRACKS_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>

                  <label htmlFor={`price-${job.id}`} style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                    Total Price ($)
                  </label>
                  <input id={`price-${job.id}`} type="number" step="0.01" placeholder="Total Price ($)" value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />

                  <input type="date" value={editForm.scheduled_date}
                    onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })} />

                  <div className="form-row">
                    <div className="form-field">
                      <label htmlFor={`edit-start-${job.id}`}>Start Time</label>
                      <input id={`edit-start-${job.id}`} type="time" value={editForm.startTime}
                        onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label htmlFor={`edit-end-${job.id}`}>End Time</label>
                      <input id={`edit-end-${job.id}`} type="time" value={editForm.endTime}
                        onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} />
                    </div>
                  </div>

                  <textarea placeholder="Notes" value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />

                  <div className="card-actions">
                    <button type="submit">Save Changes</button>
                    <button type="button" className="btn-secondary" onClick={() => setEditingJobId(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="card-main">
                    <strong>{job.service_type}</strong>
                    <span className={`status-badge status-${job.status}`}>{job.status}</span>
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
                    {job.notes && <p className="card-notes">{job.notes}</p>}
                  </div>
                  <div className="card-actions">
                    <button className="btn-secondary" onClick={() => startEdit(job)}>Edit</button>
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
                    <button className="btn-secondary" onClick={() => deleteJob(job)}>Delete</button>
                  </div>
                </>
              )}
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
