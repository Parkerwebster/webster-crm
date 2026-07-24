import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { formatTime, formatTimeRange } from '../lib/format'

const WINDOW_TYPES = [
  'Window Cleaning (Exterior Only)',
  'Window Cleaning (Interior and Exterior)',
]

const TRACKS_OPTIONS = ['None', 'Screen Cleaning', 'Screen Cleaning and Deep Track Cleaning']

const EMPTY_SCHEDULE_FORM = {
  mode: 'customer',
  customerId: '',
  leadId: '',
  windowType: WINDOW_TYPES[0],
  windowPrice: '',
  tracksOption: TRACKS_OPTIONS[0],
  tracksPrice: '',
  startTime: '',
  endTime: '',
  notes: '',
  technicianId: '',
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toDateKey(date) {
  return date.toLocaleDateString('en-CA') // YYYY-MM-DD, local time
}

function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = firstOfMonth.getDay()
  const gridStart = new Date(year, month, 1 - startOffset)

  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    days.push(d)
  }
  return days
}

export default function Calendar() {
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [jobs, setJobs] = useState([])
  const [leads, setLeads] = useState([])
  const [customers, setCustomers] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [scheduleDate, setScheduleDate] = useState(null)
  const [form, setForm] = useState(EMPTY_SCHEDULE_FORM)
  const [submitting, setSubmitting] = useState(false)

  async function loadData() {
    setLoading(true)
    const [{ data: jobsData }, { data: leadsData }, { data: customersData }, { data: techData }] = await Promise.all([
      supabase.from('jobs').select('*, customers(id, name, address, phone), technicians(id, name, color)').not('scheduled_date', 'is', null),
      supabase.from('leads').select('*').eq('converted', false).order('name'),
      supabase.from('customers').select('id, name').order('name'),
      supabase.from('technicians').select('*').eq('active', true).order('name'),
    ])
    setJobs(jobsData ?? [])
    setLeads(leadsData ?? [])
    setCustomers(customersData ?? [])
    setTechnicians(techData ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const jobsByDate = useMemo(() => {
    const map = {}
    for (const job of jobs) {
      const key = job.scheduled_date
      if (!map[key]) map[key] = []
      map[key].push(job)
    }
    return map
  }, [jobs])

  const days = useMemo(
    () => buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  )

  function changeMonth(delta) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  function openSchedule(date) {
    setScheduleDate(date)
    setForm(EMPTY_SCHEDULE_FORM)
  }

  async function handleSchedule(e) {
    e.preventDefault()
    setSubmitting(true)

    let customerId = form.customerId

    if (form.mode === 'lead') {
      const lead = leads.find((l) => l.id === form.leadId)
      if (!lead) {
        setSubmitting(false)
        return
      }
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
      if (error || !customer) {
        setSubmitting(false)
        return
      }
      await supabase.from('leads').update({ converted: true }).eq('id', lead.id)
      customerId = customer.id
    }

    if (!customerId) {
      setSubmitting(false)
      return
    }

    const hasTracks = form.tracksOption !== 'None'
    const serviceType = hasTracks ? `${form.windowType} + ${form.tracksOption}` : form.windowType
    const total = (form.windowPrice ? Number(form.windowPrice) : 0)
      + (hasTracks && form.tracksPrice ? Number(form.tracksPrice) : 0)

    await supabase.from('jobs').insert([{
      customer_id: customerId,
      service_type: serviceType,
      price: total > 0 ? total : null,
      scheduled_date: toDateKey(scheduleDate),
      start_time: form.startTime || null,
      end_time: form.endTime || null,
      notes: form.notes,
      status: 'scheduled',
      technician_id: form.technicianId || null,
    }])

    setSubmitting(false)
    setScheduleDate(null)
    loadData()
  }

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayKey = toDateKey(today)

  return (
    <div>
      <div className="page-header">
        <h1>Calendar</h1>
        <div className="card-actions">
          <button className="btn-secondary" onClick={() => changeMonth(-1)}>&larr; Prev</button>
          <button className="btn-secondary" onClick={() => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button>
          <button className="btn-secondary" onClick={() => changeMonth(1)}>Next &rarr;</button>
        </div>
      </div>

      <h2 style={{ marginTop: 0 }}>{monthLabel}</h2>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="calendar-grid">
          {DAY_LABELS.map((d) => (
            <div className="calendar-day-label" key={d}>{d}</div>
          ))}
          {days.map((date) => {
            const key = toDateKey(date)
            const inMonth = date.getMonth() === viewDate.getMonth()
            const dayJobs = jobsByDate[key] ?? []
            return (
              <div
                className={`calendar-day${inMonth ? '' : ' calendar-day-muted'}${key === todayKey ? ' calendar-day-today' : ''}`}
                key={key}
              >
                <div className="calendar-day-top">
                  <span>{date.getDate()}</span>
                  <button className="calendar-add-btn" onClick={() => openSchedule(date)}>+</button>
                </div>
                <div className="calendar-day-jobs">
                  {dayJobs.map((job) => (
                    <Link
                      to={`/customers/${job.customers?.id}`}
                      key={job.id}
                      className={`calendar-job-chip status-${job.status}`}
                      title={`${job.customers?.name ?? 'Unknown'} — ${job.service_type}${job.start_time ? ` — ${formatTimeRange(job.start_time, job.end_time)}` : ''}${job.technicians ? ` — ${job.technicians.name}` : ''}`}
                    >
                      {job.technicians && (
                        <span className="calendar-job-chip-tech" style={{ background: job.technicians.color }} />
                      )}
                      {job.start_time && <span className="calendar-job-chip-time">{formatTime(job.start_time)}</span>}
                      {' '}{job.customers?.name ?? 'Unknown'}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {scheduleDate && (
        <div className="modal-overlay" onClick={() => setScheduleDate(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="page-header">
              <h2 style={{ margin: 0 }}>
                Schedule for {scheduleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </h2>
              <button className="btn-secondary" onClick={() => setScheduleDate(null)}>Close</button>
            </div>

            <form className="form-grid" onSubmit={handleSchedule}>
              <div className="tab-bar">
                <button
                  type="button"
                  className={form.mode === 'customer' ? 'tab active' : 'tab'}
                  onClick={() => setForm({ ...form, mode: 'customer' })}
                >
                  Existing Customer
                </button>
                <button
                  type="button"
                  className={form.mode === 'lead' ? 'tab active' : 'tab'}
                  onClick={() => setForm({ ...form, mode: 'lead' })}
                >
                  From a Lead
                </button>
              </div>

              {form.mode === 'customer' ? (
                <select
                  required
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                >
                  <option value="">Select a customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <select
                  required
                  value={form.leadId}
                  onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                >
                  <option value="">Select a lead...</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              )}

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

              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                Time (optional)
              </label>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="cal-start-time">Start</label>
                  <input id="cal-start-time" type="time" value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                </div>
                <div className="form-field">
                  <label htmlFor="cal-end-time">End</label>
                  <input id="cal-end-time" type="time" value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                </div>
              </div>

              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                Technician
              </label>
              <select value={form.technicianId}
                onChange={(e) => setForm({ ...form, technicianId: e.target.value })}>
                <option value="">Unassigned</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              <textarea placeholder="Notes" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />

              <button type="submit" disabled={submitting}>
                {submitting ? 'Scheduling...' : 'Schedule Job'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
