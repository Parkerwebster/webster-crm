import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabaseClient'

const STATUS_OPTIONS = [
  { value: 'knocked', label: 'Knocked', color: '#1e88c7' },
  { value: 'no_answer', label: 'No Answer', color: '#8e44ad' },
  { value: 'not_interested', label: 'Not Interested', color: '#c0392b' },
  { value: 'no_soliciting', label: 'No Soliciting', color: '#e67e22' },
  { value: 'lead', label: 'Interested / Lead', color: '#f2c40f' },
  { value: 'customer', label: 'Became Customer', color: '#1e8e3e' },
]

function statusColor(status) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.color || '#1e88c7'
}

const DENTON_CENTER = [33.2148, -97.1331]
const EMPTY_PIN_FORM = { status: 'knocked', label: '', notes: '' }

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng)
    },
  })
  return null
}

function DoorPin({ knock, onSave, onDelete, onConvert }) {
  const [form, setForm] = useState({ status: knock.status, label: knock.address || '', notes: knock.notes || '' })
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
  const [knocks, setKnocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newPin, setNewPin] = useState(null)
  const [pinForm, setPinForm] = useState(EMPTY_PIN_FORM)
  const [saving, setSaving] = useState(false)
  const mapRef = useRef(null)

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
      notes: pinForm.notes || null,
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
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', knock.id)
    setKnocks((prev) => prev.map((k) =>
      k.id === knock.id ? { ...k, status: form.status, address: form.label || null, notes: form.notes || null } : k
    ))
  }

  async function deletePin(knock) {
    if (!window.confirm('Delete this door pin?')) return
    await supabase.from('door_knocks').delete().eq('id', knock.id)
    setKnocks((prev) => prev.filter((k) => k.id !== knock.id))
  }

  async function convertPinToLead(knock, form) {
    await supabase.from('leads').insert([{
      name: form.label || 'Door Knock Lead',
      address: form.label || null,
      source: 'Door Knocking',
      message: form.notes || null,
    }])
  }

  return (
    <div>
      <div className="page-header">
        <h1>Door Knocking Map</h1>
        <button className="btn-secondary" onClick={locateMe}>Locate Me</button>
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
