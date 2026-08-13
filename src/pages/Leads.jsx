import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { buildQuoteEmail } from '../lib/quoteEmail'
import QuoteEmailModal from '../components/QuoteEmailModal'
import { useAccount } from '../context/AccountContext'
import { RECURRING_OPTIONS } from '../lib/jobLifecycle'
import { TIME_OPTIONS } from '../lib/format'
import { exportToCsv } from '../lib/csv'
import { emptyServiceLine, combineServiceLines } from '../lib/services'
import ServiceLineItems from '../components/ServiceLineItems'

const LEAD_CSV_COLUMNS = [
  { label: 'Name', value: (l) => l.name },
  { label: 'Phone', value: (l) => l.phone },
  { label: 'Email', value: (l) => l.email },
  { label: 'Address', value: (l) => l.address },
  { label: 'Source', value: (l) => l.source },
  { label: 'Referral Name', value: (l) => l.referral_name },
  { label: 'Message', value: (l) => l.message },
  { label: 'Follow Up Date', value: (l) => l.follow_up_date },
  { label: 'Added', value: (l) => l.created_at ? new Date(l.created_at).toLocaleDateString() : '' },
]

const SOURCE_OPTIONS = ['Website', 'Door Knocking', 'Referral']

const EMPTY_QUOTE = {
  serviceLines: [emptyServiceLine()],
  scheduled_date: '',
  startTime: '',
  endTime: '',
  notes: '',
  technicianId: '',
  recurringInterval: 'none',
}

const EMPTY_LEAD_FORM = { name: '', phone: '', email: '', address: '', source: '', referral_name: '', message: '', follow_up_date: '' }

function leadToEditForm(lead) {
  return {
    name: lead.name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    address: lead.address || '',
    source: lead.source || '',
    referral_name: lead.referral_name || '',
    message: lead.message || '',
    follow_up_date: lead.follow_up_date || '',
  }
}

export default function Leads() {
  const { accountId } = useAccount()
  const [leads, setLeads] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_LEAD_FORM)
  const [busyId, setBusyId] = useState(null)
  const [quoteLeadId, setQuoteLeadId] = useState(null)
  const [quoteForm, setQuoteForm] = useState(EMPTY_QUOTE)
  const [quoteEmail, setQuoteEmail] = useState(null)
  const [editingLeadId, setEditingLeadId] = useState(null)
  const [editForm, setEditForm] = useState(null)
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

  async function loadTechnicians() {
    const { data } = await supabase.from('technicians').select('*').eq('active', true).order('name')
    setTechnicians(data ?? [])
  }

  useEffect(() => {
    loadLeads()
    loadTechnicians()
  }, [])

  async function handleAddLead(e) {
    e.preventDefault()
    await supabase.from('leads').insert([{ ...form, follow_up_date: form.follow_up_date || null, account_id: accountId }])
    setForm(EMPTY_LEAD_FORM)
    setShowForm(false)
    loadLeads()
  }

  function startEditLead(lead) {
    setEditingLeadId(lead.id)
    setEditForm(leadToEditForm(lead))
  }

  async function handleUpdateLead(e, lead) {
    e.preventDefault()
    await supabase.from('leads').update({
      name: editForm.name,
      phone: editForm.phone,
      email: editForm.email,
      address: editForm.address,
      source: editForm.source,
      referral_name: editForm.source === 'Referral' ? editForm.referral_name : null,
      message: editForm.message,
      follow_up_date: editForm.follow_up_date || null,
    }).eq('id', lead.id)
    setEditingLeadId(null)
    setEditForm(null)
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
        source: lead.source || 'Website',
        referral_name: lead.referral_name,
        account_id: accountId,
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

    const { serviceType, total } = combineServiceLines(quoteForm.serviceLines)

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert([{
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        notes: lead.message,
        source: lead.source || 'Website',
        referral_name: lead.referral_name,
        account_id: accountId,
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
        technician_id: quoteForm.technicianId || null,
        recurring_interval: quoteForm.recurringInterval || 'none',
        account_id: accountId,
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
        <div className="card-actions">
          <button className="btn-secondary" onClick={() => exportToCsv(`leads-${new Date().toISOString().slice(0, 10)}.csv`, leads, LEAD_CSV_COLUMNS)}>
            Export CSV
          </button>
          <button onClick={() => { setShowForm((v) => !v); setForm(EMPTY_LEAD_FORM) }}>
            {showForm ? 'Cancel' : '+ Add Lead'}
          </button>
        </div>
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

          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
            How did you get this lead?
          </label>
          <select value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}>
            <option value="">Select...</option>
            {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {form.source === 'Referral' && (
            <input placeholder="Referred by..." value={form.referral_name}
              onChange={(e) => setForm({ ...form, referral_name: e.target.value })} />
          )}

          <label htmlFor="add-follow-up" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
            Follow up on
          </label>
          <input id="add-follow-up" type="date" value={form.follow_up_date}
            onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />

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
              {editingLeadId === lead.id ? (
                <form className="form-grid" style={{ marginBottom: 0 }} onSubmit={(e) => handleUpdateLead(e, lead)}>
                  <input placeholder="Name" required value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  <input placeholder="Phone" value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                  <input placeholder="Email" value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                  <input placeholder="Address" value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />

                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                    How did you get this lead?
                  </label>
                  <select value={editForm.source}
                    onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}>
                    <option value="">Select...</option>
                    {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {editForm.source === 'Referral' && (
                    <input placeholder="Referred by..." value={editForm.referral_name}
                      onChange={(e) => setEditForm({ ...editForm, referral_name: e.target.value })} />
                  )}

                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                    Follow up on
                  </label>
                  <input type="date" value={editForm.follow_up_date}
                    onChange={(e) => setEditForm({ ...editForm, follow_up_date: e.target.value })} />

                  <textarea placeholder="Notes" value={editForm.message}
                    onChange={(e) => setEditForm({ ...editForm, message: e.target.value })} />

                  <div className="card-actions">
                    <button type="submit">Save Changes</button>
                    <button type="button" className="btn-secondary" onClick={() => setEditingLeadId(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="card-main">
                    <strong>{lead.name}</strong>
                    <span>{lead.phone}</span>
                    <span>{lead.email}</span>
                    <span>{lead.address}</span>
                    {lead.source && (
                      <span className="muted">
                        {lead.source}{lead.source === 'Referral' && lead.referral_name ? ` — ${lead.referral_name}` : ''}
                      </span>
                    )}
                    {lead.message && <p className="card-notes">{lead.message}</p>}
                    {lead.follow_up_date && (
                      <span className="muted">Follow up {new Date(lead.follow_up_date + 'T00:00:00').toLocaleDateString()}</span>
                    )}
                    <span className="card-date">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="card-actions">
                    <button disabled={busyId === lead.id} onClick={() => openQuoteForm(lead)}>
                      Create Quote
                    </button>
                    <button className="btn-secondary" disabled={busyId === lead.id} onClick={() => startEditLead(lead)}>
                      Edit
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
                </>
              )}

              {quoteLeadId === lead.id && (
                <form className="form-grid" style={{ marginTop: 16 }} onSubmit={(e) => handleCreateQuote(e, lead)}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                    Services
                  </label>
                  <ServiceLineItems lines={quoteForm.serviceLines}
                    onChange={(lines) => setQuoteForm({ ...quoteForm, serviceLines: lines })} />

                  <input type="date" value={quoteForm.scheduled_date}
                    onChange={(e) => setQuoteForm({ ...quoteForm, scheduled_date: e.target.value })} />

                  <div className="form-row">
                    <div className="form-field">
                      <label htmlFor={`start-${lead.id}`}>Start Time</label>
                      <select id={`start-${lead.id}`} value={quoteForm.startTime}
                        onChange={(e) => setQuoteForm({ ...quoteForm, startTime: e.target.value })}>
                        <option value="">--:-- --</option>
                        {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="form-field">
                      <label htmlFor={`end-${lead.id}`}>End Time</label>
                      <select id={`end-${lead.id}`} value={quoteForm.endTime}
                        onChange={(e) => setQuoteForm({ ...quoteForm, endTime: e.target.value })}>
                        <option value="">--:-- --</option>
                        {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <label htmlFor={`tech-${lead.id}`} style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                    Technician
                  </label>
                  <select id={`tech-${lead.id}`} value={quoteForm.technicianId}
                    onChange={(e) => setQuoteForm({ ...quoteForm, technicianId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  <label htmlFor={`repeat-${lead.id}`} style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                    Repeat
                  </label>
                  <select id={`repeat-${lead.id}`} value={quoteForm.recurringInterval}
                    onChange={(e) => setQuoteForm({ ...quoteForm, recurringInterval: e.target.value })}>
                    {RECURRING_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>

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
