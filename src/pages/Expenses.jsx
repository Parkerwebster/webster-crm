import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAccount } from '../context/AccountContext'
import { exportToCsv } from '../lib/csv'

const CATEGORY_OPTIONS = [
  'Supplies',
  'Equipment',
  'Fuel',
  'Vehicle Maintenance',
  'Insurance',
  'Marketing',
  'Software',
  'Other',
]

function emptyForm() {
  return {
    description: '',
    category: CATEGORY_OPTIONS[0],
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    notes: '',
  }
}

const EXPENSE_CSV_COLUMNS = [
  { label: 'Date', value: (e) => e.expense_date },
  { label: 'Description', value: (e) => e.description },
  { label: 'Category', value: (e) => e.category },
  { label: 'Amount', value: (e) => e.amount },
  { label: 'Notes', value: (e) => e.notes },
]

export default function Expenses() {
  const { accountId } = useAccount()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [busyId, setBusyId] = useState(null)

  async function loadExpenses() {
    setLoading(true)
    const { data } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false })
    setExpenses(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadExpenses()
  }, [])

  async function handleAddExpense(e) {
    e.preventDefault()
    await supabase.from('expenses').insert([{
      description: form.description,
      category: form.category,
      amount: Number(form.amount) || 0,
      expense_date: form.expense_date,
      notes: form.notes || null,
      account_id: accountId,
    }])
    setForm(emptyForm())
    setShowForm(false)
    loadExpenses()
  }

  async function deleteExpense(expense) {
    if (!window.confirm(`Delete this expense ("${expense.description}")? This can't be undone.`)) return
    setBusyId(expense.id)
    await supabase.from('expenses').delete().eq('id', expense.id)
    setBusyId(null)
    loadExpenses()
  }

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const totals = expenses.reduce(
    (acc, exp) => {
      const amount = Number(exp.amount) || 0
      acc.allTime += amount
      if (new Date(exp.expense_date + 'T00:00:00') >= monthStart) acc.month += amount
      return acc
    },
    { month: 0, allTime: 0 }
  )

  return (
    <div>
      <div className="page-header">
        <h1>Expenses</h1>
        <div className="card-actions">
          <button
            className="btn-secondary"
            onClick={() => exportToCsv(`expenses-${new Date().toISOString().slice(0, 10)}.csv`, expenses, EXPENSE_CSV_COLUMNS)}
          >
            Export CSV
          </button>
          <button onClick={() => { setShowForm((v) => !v); setForm(emptyForm()) }}>
            {showForm ? 'Cancel' : '+ Add Expense'}
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">${totals.month.toFixed(2)}</span>
          <span className="stat-label">This Month</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">${totals.allTime.toFixed(2)}</span>
          <span className="stat-label">All Time</span>
        </div>
      </div>

      {showForm && (
        <form className="card form-grid" onSubmit={handleAddExpense}>
          <input placeholder="Description" required value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
            Category
          </label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <input type="number" step="0.01" placeholder="Amount ($)" required value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })} />

          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
            Date
          </label>
          <input type="date" required value={form.expense_date}
            onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />

          <textarea placeholder="Notes" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          <button type="submit">Save Expense</button>
        </form>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : expenses.length === 0 ? (
        <p className="empty-state">No expenses logged yet.</p>
      ) : (
        <div className="card-list">
          {expenses.map((exp) => (
            <div className="card" key={exp.id}>
              <div className="card-main">
                <strong>{exp.description}</strong>
                <span className="muted">{exp.category}</span>
                <span>${Number(exp.amount).toFixed(2)}</span>
                <span className="card-date">{new Date(exp.expense_date + 'T00:00:00').toLocaleDateString()}</span>
                {exp.notes && <p className="card-notes">{exp.notes}</p>}
              </div>
              <div className="card-actions">
                <button className="btn-secondary" disabled={busyId === exp.id} onClick={() => deleteExpense(exp)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
