import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { buildQuoteEmail } from '../lib/quoteEmail'
import QuoteEmailModal from '../components/QuoteEmailModal'

const WINDOW_TYPES = [
  'Window Cleaning (Exterior Only)',
  'Window Cleaning (Interior and Exterior)',
]

const TRACKS_OPTIONS = ['None', 'Screen Cleaning', 'Screen Cleaning and Deep Track Cleaning']

const EMPTY_QUOTE = {
  windowType: WINDOW_TYPES[0],
  windowPrice: '',
  tracksOption: TRACKS_OPTIONS[0],
  tracksPrice: '',
  scheduled_date: '',
  startTime: '',
  endTime: '',
  notes: '',
}

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', message: '' })
  const [busyId, setBusyId] = useState(null)
  const [quoteLeadId, setQuoteLeadId] = useState(null)
  const [quoteForm, setQuoteForm] = useState(EMPTY_QUOTE)
  const [quoteEmail, setQuoteEmail] = useState(null)
  const navigate = useNavigate()

  async function loadLeads() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('converted', false)
      .order('created_at', { ascending: false })
    setLeads(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadLeads()
  }, [])

  async function handleAddLead(e) {
    e.preventDefault()
    await supabase.from('leads').insert([form])
    setForm({ name: '', phone: '', email: '', address: '', message: '' })
    setShowForm(false)
    loadLeads()
  }

  async function convertToCustomer(lead) {
    setBusyId(lead.id)
    const { data: customer, error } = await supabase
      .from('customers')
      .insert([{
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        notes: lead.message,
        source: 'Website / Lead',
      }])
      .select()
      .single()

    if (!error && customer) {
      await supabase.from('leads').update({ converted: true }).eq('id', lead.id)
      navigate(`/customers/${customer.id}`)
    }
    setBusyId(null)
  }

  async function dismissLead(lead) {
    setBusyId(lead.id)
    await supabase.from('leads').update({ converted: true }).eq('id', lead.id)
    setBusyId(null)
    loadLeads()
  }

  async function deleteLead(lead) {
    if (!window.confirm(`Delete the lead "${lead.name}"? This can't be undone.`)) return
    setBusyId(lead.id)
    await supabase.from('leads').delete().eq('id', lead.id)
    setBusyId(null)
    loadLeads()
  }

  function openQuoteForm(lead) {
    setQuoteLeadId(lead.id)
    setQuoteForm(EMPTY_QUOTE)
  }

  async function handleCreateQuote(e, lead) {
    e.preventDefault()
    setBusyId(lead.id)

    const hasTracks = quoteForm.tracksOption !== 'None'
    const serviceType = hasTracks ? `${quoteForm.windowType} + ${quoteForm.tracksOption}` : quoteForm.windowType
    const total = (quoteForm.windowPrice ? Number(quoteForm.windowPrice) : 0)
      + (hasTracks && quoteForm.tracksPrice ? Number(quoteForm.tracksPrice) : 0)

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert([{
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        notes: lead.message,
        source: 'Website / Lead',
      }])
      .select()
      .single()

    if (customerError || !customer) {
      setBusyId(null)
      return
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert([{
        customer_id: customer.id,
        service_type: serviceType,
        price: total > 0 ? total : null,
        scheduled_date: quoteForm.scheduled_date || null,
        start_time: quoteForm.startTime || null,
        end_time: quoteForm.endTime || null,
        notes: quoteForm.notes,
      }])
      .select()
      .single()

    await supabase.from('leads').update({ converted: true }).eq('id', lead.id)

    setBusyId(null)
    setQuoteLeadId(null)

    if (!jobError && job) {
      setQuoteEmail(buildQuoteEmail(customer, job))
    }

    loadLeads()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Leads</h1>
        <button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Add Lead'}
        </button>
      </div>

      {showForm && (
        <form className="card form-grid" onSubmit={handleAddLead}>
          <input placeholder="Name" required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Phone" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Address" value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <textarea placeholder="Notes" value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <button type="submit">Save Lead</button>
        </form>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : leads.length === 0 ? (
        <p className="empty-state">No open leads right now.</p>
      ) : (
        <div className="card-list">
          {leads.map((lead) => (
            <div className="card" key={lead.id}>
              <div className="card-main">
                <strong>{lead.name}</strong>
                <span>{lead.phone}</span>
                <span>{lead.email}</span>
                <span>{lead.address}</span>
                {lead.message && <p className="card-notes">{lead.message}</p>}
                <span className="card-date">
                  {new Date(lead.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="card-actions">
                <button disabled={busyId === lead.id} onClick={() => openQuoteForm(lead)}>
                  Create Quote
                </button>
                <button className="btn-secondary" disabled={busyId === lead.id} onClick={() => convertToCustomer(lead)}>
                  Convert to Customer
                </button>
                <button className="btn-secondary" disabled={busyId === lead.id} onClick={() => dismissLead(lead)}>
                  Dismiss
                </button>
                <button className="btn-secondary" disabled={busyId === lead.id} onClick={() => deleteLead(lead)}>
                  Delete
                </button>
              </div>

              {quoteLeadId === lead.id && (
                <form className="form-grid" style={{ marginTop: 16 }} onSubmit={(e) => handleCreateQuote(e, lead)}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                    Window Cleaning
                  </label>
                  <select value={quoteForm.windowType}
                    onChange={(e) => setQuoteForm({ ...quoteForm, windowType: e.target.value })}>
                    {WINDOW_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input type="number" step="0.01" placeholder="Window Cleaning Price ($)" value={quoteForm.windowPrice}
                    onChange={(e) => setQuoteForm({ ...quoteForm, windowPrice: e.target.value })} />

                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                    Tracks &amp; Screens
                  </label>
                  <select value={quoteForm.tracksOption}
                    onChange={(e) => setQuoteForm({ ...quoteForm, tracksOption: e.target.value })}>
                    {TRACKS_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {quoteForm.tracksOption !== 'None' && (
                    <input type="number" step="0.01" placeholder="Tracks & Screens Price ($)" value={quoteForm.tracksPrice}
                      onChange={(e) => setQuoteForm({ ...quoteForm, tracksPrice: e.target.value })} />
                  )}

                  <input type="date" value={quoteForm.scheduled_date}
                    onChange={(e) => setQuoteForm({ ...quoteForm, scheduled_date: e.target.value })} />

                  <div className="form-row">
                    <div className="form-field">
                      <label htmlFor={`start-${lead.id}`}>Start Time</label>
                      <input id={`start-${lead.id}`} type="time" value={quoteForm.startTime}
                        onChange={(e) => setQuoteForm({ ...quoteForm, startTime: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label htmlFor={`end-${lead.id}`}>End Time</label>
                      <input id={`end-${lead.id}`} type="time" value={quoteForm.endTime}
                        onChange={(e) => setQuoteForm({ ...quoteForm, endTime: e.target.value })} />
                    </div>
                  </div>

                  <textarea placeholder="Notes" value={quoteForm.notes}
                    onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })} />

                  <div className="card-actions">
                    <button type="submit" disabled={busyId === lead.id}>Create &amp; Send Quote</button>
                    <button type="button" className="btn-secondary" onClick={() => setQuoteLeadId(null)}>Cancel</button>
                  </div>
                </form>
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
