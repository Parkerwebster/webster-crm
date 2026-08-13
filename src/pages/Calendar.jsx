import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { formatTime, formatTimeRange, TIME_OPTIONS } from '../lib/format'
import { useAccount } from '../context/AccountContext'
import { RECURRING_OPTIONS } from '../lib/jobLifecycle'
import { emptyServiceLine, combineServiceLines } from '../lib/services'
import ServiceLineItems from '../components/ServiceLineItems'

const EMPTY_SCHEDULE_FORM = {
  mode: 'customer',
  customerId: '',
  leadId: '',
  serviceLines: [emptyServiceLine()],
  startTime: '',
  endTime: '',
  notes: '',
  technicianId: '',
  recurringInterval: 'none',
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toDateKey(date) {
  return date.toLocaleDateString('en-CA') // YYYY-MM-DD, local time
}

function mapsUrl(address) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

function timeToMinutes(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const HOURS = Array.from({ length: 24 }, (_, h) => ({
  h,
  label: formatTime(`${String(h).padStart(2, '0')}:00`),
}))

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
  const { accountId } = useAccount()
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
  const [selectedDate, setSelectedDate] = useState(today)
  const dayScrollRef = useRef(null)

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

  const selectedDayJobs = jobsByDate[toDateKey(selectedDate)] ?? []
  const timedJobs = selectedDayJobs.filter((j) => j.start_time)
  const untimedJobs = selectedDayJobs.filter((j) => !j.start_time)

  useEffect(() => {
    if (dayScrollRef.current) {
      dayScrollRef.current.scrollTop = 7 * 60 - 20
    }
  }, [selectedDate, loading])

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
          account_id: accountId,
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

    const { serviceType, total } = combineServiceLines(form.serviceLines)

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
      recurring_interval: form.recurringInterval || 'none',
      account_id: accountId,
    }])

    setSubmitting(false)
    setScheduleDate(null)
    loadData()
  }

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayKey = toDateKey(today)

  return (
    <div className="calendar-page">
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
                className={`calendar-day${inMonth ? '' : ' calendar-day-muted'}${key === todayKey ? ' calendar-day-today' : ''}${key === toDateKey(selectedDate) ? ' calendar-day-selected' : ''}`}
                key={key}
                onClick={() => setSelectedDate(date)}
              >
                <div className="calendar-day-top">
                  <span>{date.getDate()}</span>
                  <button className="calendar-add-btn" onClick={(e) => { e.stopPropagation(); openSchedule(date) }}>+</button>
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

      {!loading && (
        <div className="card day-schedule">
          <div className="page-header">
            <h2 style={{ margin: 0 }}>
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h2>
            <button className="btn-secondary" onClick={() => openSchedule(selectedDate)}>+ Schedule Job</button>
          </div>

          {untimedJobs.length > 0 && (
            <div className="day-schedule-untimed">
              {untimedJobs.map((job) => (
                <Link
                  to={`/customers/${job.customers?.id}`}
                  key={job.id}
                  className={`calendar-job-chip status-${job.status}`}
                >
                  {job.customers?.name ?? 'Unknown'} — {job.service_type}
                </Link>
              ))}
            </div>
          )}

          <div className="day-schedule-scroll" ref={dayScrollRef}>
            <div className="day-schedule-row">
              <div className="day-schedule-hours">
                {HOURS.map((hour) => (
                  <div className="day-schedule-hour-label" key={hour.h} style={{ top: hour.h * 60 }}>
                    {hour.label}
                  </div>
                ))}
              </div>
              <div className="day-schedule-slots">
                {HOURS.map((hour) => (
                  <div className="day-schedule-hour-line" key={hour.h} style={{ top: hour.h * 60 }} />
                ))}
                {timedJobs.map((job) => {
                  const startMin = timeToMinutes(job.start_time)
                  const endMin = job.end_time ? timeToMinutes(job.end_time) : startMin + 30
                  const height = Math.max(endMin - startMin, 20)
                  return (
                    <div
                      key={job.id}
                      className={`day-schedule-job status-${job.status}`}
                      style={{ top: startMin, height }}
                    >
                      <Link
                        to={`/customers/${job.customers?.id}`}
                        className="day-schedule-job-main"
                        title={`${job.customers?.name ?? 'Unknown'} — ${job.service_type}${job.technicians ? ` — ${job.technicians.name}` : ''}`}
                      >
                        {job.technicians && (
                          <span className="calendar-job-chip-tech" style={{ background: job.technicians.color }} />
                        )}
                        <strong>{formatTimeRange(job.start_time, job.end_time)}</strong>
                        {' '}{job.customers?.name ?? 'Unknown'}
                      </Link>
                      {job.customers?.address && (
                        <a
                          href={mapsUrl(job.customers.address)}
                          target="_blank"
                          rel="noreferrer"
                          className="day-schedule-job-address"
                          title={`Get directions to ${job.customers.address}`}
                        >
                          {job.customers.address}
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
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
                Services
              </label>
              <ServiceLineItems lines={form.serviceLines}
                onChange={(lines) => setForm({ ...form, serviceLines: lines })} />

              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                Time (optional)
              </label>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="cal-start-time">Start</label>
                  <select id="cal-start-time" value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}>
                    <option value="">--:-- --</option>
                    {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="cal-end-time">End</label>
                  <select id="cal-end-time" value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}>
                    <option value="">--:-- --</option>
                    {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
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

              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                Repeat
              </label>
              <select value={form.recurringInterval}
                onChange={(e) => setForm({ ...form, recurringInterval: e.target.value })}>
                {RECURRING_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
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
