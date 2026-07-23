import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const SOURCE_OPTIONS = ['Website', 'Door Knocking', 'Referral']

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', notes: '', source: '', referral_name: '' }

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  async function loadCustomers() {
    setLoading(true)
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    setCustomers(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  async function handleAddCustomer(e) {
    e.preventDefault()
    const payload = { ...form, referral_name: form.source === 'Referral' ? form.referral_name : null }
    await supabase.from('customers').insert([payload])
    setForm(EMPTY_FORM)
    setShowForm(false)
    loadCustomers()
  }

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.address ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <h1>Customers</h1>
        <button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Add Customer'}
        </button>
      </div>

      {showForm && (
        <form className="card form-grid" onSubmit={handleAddCustomer}>
          <input placeholder="Name" required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Phone" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Address" value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
            How did you get this customer?
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
          <textarea placeholder="Notes" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit">Save Customer</button>
        </form>
      )}

      <input
        className="search-input"
        placeholder="Search by name or address..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p>Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No customers yet.</p>
      ) : (
        <div className="table-list">
          {filtered.map((c) => (
            <Link className="table-row" to={`/customers/${c.id}`} key={c.id}>
              <span className="table-cell strong">{c.name}</span>
              <span className="table-cell">{c.phone}</span>
              <span className="table-cell">{c.address}</span>
              <span className="table-cell muted">{c.source}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
