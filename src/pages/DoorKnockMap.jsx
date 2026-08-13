import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabaseClient'
import { useAccount } from '../context/AccountContext'

const STATUS_OPTIONS = [
  { value: 'knocked', label: 'No Answer', color: '#1e88c7' },
  { value: 'not_interested', label: 'Not Interested', color: '#c0392b' },
  { value: 'no_soliciting', label: 'No Soliciting', color: '#e67e22' },
  { value: 'lead', label: 'Interested / Lead', color: '#f2c40f' },
  { value: 'customer', label: 'Became Customer', color: '#1e8e3e' },
]

function statusColor(status) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.color || '#1e88c7'
}

const DENTON_CENTER = [33.2148, -97.1331]
const EMPTY_PIN_FORM = { status: 'knocked', label: '', name: '', phone: '', email: '', notes: '' }

const RANGE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'all', label: 'All Time' },
]

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeek() {
  const d = startOfToday()
  d.setDate(d.getDate() - d.getDay())
  return d
}

function formatRangeLabel(range) {
  if (range === 'today') {
    return startOfToday().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }
  if (range === 'week') {
    const start = startOfWeek()
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
    const year = end.getFullYear()
    return startMonth === endMonth
      ? `${startMonth} ${start.getDate()} – ${end.getDate()}, ${year}`
      : `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${year}`
  }
  return null
}

function computeStats(list) {
  const total = list.length
  const counts = {}
  STATUS_OPTIONS.forEach((s) => { counts[s.value] = 0 })
  list.forEach((k) => { counts[k.status] = (counts[k.status] || 0) + 1 })
  const customers = counts.customer || 0
  const leads = counts.lead || 0
  return {
    total,
    counts,
    customers,
    leads,
    conversionRate: total > 0 ? (customers / total) * 100 : 0,
  }
}

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng)
    },
  })
  return null
}

function DoorPin({ knock, onSave, onDelete, onConvert }) {
  const [form, setForm] = useState({
    status: knock.status,
    label: knock.address || '',
    name: knock.name || '',
    phone: knock.phone || '',
    email: knock.email || '',
    notes: knock.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [converted, setConverted] = useState(false)

  return (
    <CircleMarker
      center={[knock.lat, knock.lng]}
      radius={10}
      pathOptions={{ color: '#ffffff', weight: 2, fillColor: statusColor(knock.status), fillOpacity: 0.9 }}
    >
      <Popup minWidth={220}>
        <div className="map-popup-form">
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input placeholder="Address / label" value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <input placeholder="Name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input type="tel" placeholder="Phone" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input type="email" placeholder="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <textarea placeholder="Notes" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="map-popup-actions">
            <button
              type="button"
              disabled={saving}
              onClick={async () => { setSaving(true); await onSave(knock, form); setSaving(false) }}
            >
              Save
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={converted}
              onClick={async () => { await onConvert(knock, form); setConverted(true) }}
            >
              {converted ? 'Added' : 'Add as Lead'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => onDelete(knock)}>Delete</button>
          </div>
        </div>
      </Popup>
    </CircleMarker>
  )
}

export default function DoorKnockMap() {
  const { accountId } = useAccount()
  const [knocks, setKnocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newPin, setNewPin] = useState(null)
  const [pinForm, setPinForm] = useState(EMPTY_PIN_FORM)
  const [saving, setSaving] = useState(false)
  const [range, setRange] = useState('today')
  const mapRef = useRef(null)

  const notesList = useMemo(
    () => knocks.filter((k) => k.notes && k.notes.trim()),
    [knocks]
  )

  const statsByRange = useMemo(() => {
    const todayStart = startOfToday()
    const weekStart = startOfWeek()
    const todayKnocks = knocks.filter((k) => new Date(k.created_at) >= todayStart)
    const weekKnocks = knocks.filter((k) => new Date(k.created_at) >= weekStart)
    return {
      today: computeStats(todayKnocks),
      week: computeStats(weekKnocks),
      all: computeStats(knocks),
    }
  }, [knocks])

  const stats = statsByRange[range]

  async function loadKnocks() {
    setLoading(true)
    const { data } = await supabase.from('door_knocks').select('*').order('created_at', { ascending: false })
    setKnocks(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadKnocks()
  }, [])

  function locateMe() {
    mapRef.current?.locate({ setView: true, maxZoom: 19 })
  }

  function handleMapClick(latlng) {
    setNewPin(latlng)
    setPinForm(EMPTY_PIN_FORM)
  }

  async function saveNewPin(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase.from('door_knocks').insert([{
      lat: newPin.lat,
      lng: newPin.lng,
      status: pinForm.status,
      address: pinForm.label || null,
      name: pinForm.name || null,
      phone: pinForm.phone || null,
      email: pinForm.email || null,
      notes: pinForm.notes || null,
      account_id: accountId,
    }]).select().single()
    if (!error && data) {
      setKnocks((prev) => [data, ...prev])
    }
    setSaving(false)
    setNewPin(null)
  }

  async function saveEditPin(knock, form) {
    await supabase.from('door_knocks').update({
      status: form.status,
      address: form.label || null,
      name: form.name || null,
      phone: form.phone || null,
      email: form.email || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', knock.id)
    setKnocks((prev) => prev.map((k) =>
      k.id === knock.id
        ? { ...k, status: form.status, address: form.label || null, name: form.name || null, phone: form.phone || null, email: form.email || null, notes: form.notes || null }
        : k
    ))
  }

  async function deletePin(knock) {
    if (!window.confirm('Delete this door pin?')) return
    await supabase.from('door_knocks').delete().eq('id', knock.id)
    setKnocks((prev) => prev.filter((k) => k.id !== knock.id))
  }

  async function convertPinToLead(knock, form) {
    await supabase.from('leads').insert([{
      name: form.name || form.label || 'Door Knock Lead',
      phone: form.phone || null,
      email: form.email || null,
      address: form.label || null,
      source: 'Door Knocking',
      message: form.notes || null,
      account_id: accountId,
    }])
  }

  return (
    <div>
      <div className="page-header">
        <h1>Door Knocking Map</h1>
      </div>

      <div className="map-range-tabs">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r.key}
            type="button"
            className={range === r.key ? 'map-range-tab active' : 'map-range-tab'}
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {formatRangeLabel(range) && (
        <p className="map-range-date">{formatRangeLabel(range)}</p>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Doors Knocked</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.leads}</span>
          <span className="stat-label">Interested / Leads</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.customers}</span>
          <span className="stat-label">Became Customers</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.conversionRate.toFixed(1)}%</span>
          <span className="stat-label">Conversion Rate</span>
        </div>
      </div>

      <div className="card map-breakdown">
        <h2 style={{ marginTop: 0 }}>Breakdown &mdash; {RANGE_OPTIONS.find((r) => r.key === range)?.label}</h2>
        {stats.total === 0 ? (
          <p className="empty-state">
            {range === 'all' ? 'No pins yet. Drop your first pin on the map below.' : `No doors knocked yet for this ${range === 'today' ? 'day' : 'week'}.`}
          </p>
        ) : (
          STATUS_OPTIONS.map((s) => {
            const count = stats.counts[s.value] || 0
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
            return (
              <div className="map-breakdown-row" key={s.value}>
                <span className="map-breakdown-label">
                  <span className="map-legend-dot" style={{ background: s.color }} />
                  {s.label}
                </span>
                <div className="map-breakdown-bar">
                  <div className="map-breakdown-bar-fill" style={{ width: `${pct}%`, background: s.color }} />
                </div>
                <span className="map-breakdown-count">{count} ({pct.toFixed(0)}%)</span>
              </div>
            )
          })
        )}
      </div>

      <div className="map-legend">
        {STATUS_OPTIONS.map((s) => (
          <span className="map-legend-item" key={s.value}>
            <span className="map-legend-dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <p className="map-hint">
        {loading ? 'Loading your pins...' : 'Tap anywhere on the map to drop a pin for the house you\'re at. Tap an existing pin to update or delete it.'}
      </p>

      <div className="map-controls">
        <button className="btn-secondary" onClick={locateMe}>Locate Me</button>
      </div>

      <div className="map-wrap">
        <MapContainer
          center={DENTON_CENTER}
          zoom={17}
          ref={mapRef}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
            maxZoom={20}
          />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={20}
          />
          <ClickHandler onMapClick={handleMapClick} />

          {knocks.map((knock) => (
            <DoorPin
              key={knock.id}
              knock={knock}
              onSave={saveEditPin}
              onDelete={deletePin}
              onConvert={convertPinToLead}
            />
          ))}
        </MapContainer>
      </div>

      <div className="card map-notes">
        <h2 style={{ marginTop: 0 }}>Notes ({notesList.length})</h2>
        {notesList.length === 0 ? (
          <p className="empty-state">No notes yet. Add notes to a pin to see them here.</p>
        ) : (
          <div className="card-list">
            {notesList.map((k) => (
              <div className="card" key={k.id}>
                <div className="card-main">
                  <span className="map-legend-item">
                    <span className="map-legend-dot" style={{ background: statusColor(k.status) }} />
                    {STATUS_OPTIONS.find((s) => s.value === k.status)?.label}
                  </span>
                  {k.name && <strong>{k.name}</strong>}
                  {k.address && <span className="muted">{k.address}</span>}
                  <p className="card-notes">{k.notes}</p>
                  <span className="card-date">{new Date(k.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {newPin && (
        <div className="modal-overlay" onClick={() => setNewPin(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="page-header">
              <h2 style={{ margin: 0 }}>New Door Pin</h2>
              <button className="btn-secondary" onClick={() => setNewPin(null)}>Close</button>
            </div>
            <form className="form-grid" onSubmit={saveNewPin}>
              <select value={pinForm.status} onChange={(e) => setPinForm({ ...pinForm, status: e.target.value })}>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <input placeholder="Address / label (optional)" value={pinForm.label}
                onChange={(e) => setPinForm({ ...pinForm, label: e.target.value })} />
              <input placeholder="Name" value={pinForm.name}
                onChange={(e) => setPinForm({ ...pinForm, name: e.target.value })} />
              <input type="tel" placeholder="Phone" value={pinForm.phone}
                onChange={(e) => setPinForm({ ...pinForm, phone: e.target.value })} />
              <input type="email" placeholder="Email" value={pinForm.email}
                onChange={(e) => setPinForm({ ...pinForm, email: e.target.value })} />
              <textarea placeholder="Notes" value={pinForm.notes}
                onChange={(e) => setPinForm({ ...pinForm, notes: e.target.value })} />
              <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Pin'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
