import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const COLOR_PALETTE = ['#1565a3', '#1e8e3e', '#c0392b', '#b7791f', '#8e44ad', '#e67e22', '#16a085', '#d63384']

const EMPTY_FORM = { name: '', phone: '' }

export default function Technicians() {
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  async function loadTechnicians() {
    setLoading(true)
    const { data } = await supabase.from('technicians').select('*').order('created_at', { ascending: true })
    setTechnicians(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadTechnicians()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    const color = COLOR_PALETTE[technicians.length % COLOR_PALETTE.length]
    await supabase.from('technicians').insert([{ name: form.name, phone: form.phone, color }])
    setForm(EMPTY_FORM)
    setShowForm(false)
    loadTechnicians()
  }

  async function toggleActive(tech) {
    await supabase.from('technicians').update({ active: !tech.active }).eq('id', tech.id)
    loadTechnicians()
  }

  async function deleteTechnician(tech) {
    if (!window.confirm(`Delete ${tech.name}? Jobs already assigned to them will just show unassigned.`)) return
    await supabase.from('technicians').delete().eq('id', tech.id)
    loadTechnicians()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Technicians</h1>
        <button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Add Technician'}
        </button>
      </div>

      {showForm && (
        <form className="card form-grid" onSubmit={handleAdd}>
          <input placeholder="Name" required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Phone" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <button type="submit">Save Technician</button>
        </form>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : technicians.length === 0 ? (
        <p className="empty-state">No technicians yet.</p>
      ) : (
        <div className="card-list">
          {technicians.map((t) => (
            <div className="card" key={t.id}>
              <div className="card-main">
                <span className="tech-dot" style={{ background: t.color }} />
                <strong>{t.name}</strong>
                {t.phone && <span className="muted">{t.phone}</span>}
                {!t.active && <span className="status-badge">Inactive</span>}
              </div>
              <div className="card-actions">
                <button className="btn-secondary" onClick={() => toggleActive(t)}>
                  {t.active ? 'Mark Inactive' : 'Mark Active'}
                </button>
                <button className="btn-secondary" onClick={() => deleteTechnician(t)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
