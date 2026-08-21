import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAccount } from '../context/AccountContext'
import { exportToCsv } from '../lib/csv'
import { formatTimestamp, localDateStr } from '../lib/format'

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

const RECURRENCE_OPTIONS = [
  { value: 'one_time', label: 'One-time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1)

function emptyForm() {
  return {
    description: '',
    category: CATEGORY_OPTIONS[0],
    amount: '',
    expense_date: localDateStr(),
    notes: '',
    recurrence: 'one_time',
    recurrence_day: 1,
    recurrence_month: 1,
  }
}

function expenseToEditForm(exp) {
  return {
    description: exp.description || '',
    category: exp.category || CATEGORY_OPTIONS[0],
    amount: exp.amount != null ? String(exp.amount) : '',
    expense_date: exp.expense_date || localDateStr(),
    notes: exp.notes || '',
    recurrence: exp.recurrence || 'one_time',
    recurrence_day: exp.recurrence_day || 1,
    recurrence_month: exp.recurrence_month || 1,
  }
}

function formatRecurrence(exp) {
  if (exp.recurrence === 'monthly') return `Monthly · Day ${exp.recurrence_day}`
  if (exp.recurrence === 'yearly') {
    const monthLabel = MONTH_OPTIONS.find((m) => m.value === exp.recurrence_month)?.label ?? ''
    return `Yearly · ${monthLabel} ${exp.recurrence_day}`
  }
  return null
}

function receiptUrl(path) {
  return supabase.storage.from('expense-receipts').getPublicUrl(path).data.publicUrl
}

function emptyMileageForm() {
  return {
    vehicle: '',
    log_date: localDateStr(),
    miles: '',
    purpose: '',
    notes: '',
  }
}

function mileageToEditForm(log) {
  return {
    vehicle: log.vehicle || '',
    log_date: log.log_date || localDateStr(),
    miles: log.miles != null ? String(log.miles) : '',
    purpose: log.purpose || '',
    notes: log.notes || '',
  }
}

const MILEAGE_CSV_COLUMNS = [
  { label: 'Date', value: (m) => m.log_date },
  { label: 'Vehicle', value: (m) => m.vehicle },
  { label: 'Miles', value: (m) => m.miles },
  { label: 'Purpose', value: (m) => m.purpose },
  { label: 'Notes', value: (m) => m.notes },
]

const EXPENSE_CSV_COLUMNS = [
  { label: 'Date', value: (e) => e.expense_date },
  { label: 'Description', value: (e) => e.description },
  { label: 'Category', value: (e) => e.category },
  { label: 'Amount', value: (e) => e.amount },
  { label: 'Recurrence', value: (e) => RECURRENCE_OPTIONS.find((r) => r.value === e.recurrence)?.label ?? '' },
  { label: 'Recurrence Day', value: (e) => e.recurrence_day },
  { label: 'Recurrence Month', value: (e) => e.recurrence_month ? MONTH_OPTIONS.find((m) => m.value === e.recurrence_month)?.label : '' },
  { label: 'Notes', value: (e) => e.notes },
]

function ExpenseCard({
  exp, receipts, dateLabel, busy, uploading,
  isEditing, editForm, onEditFormChange, onStartEdit, onSaveEdit, onCancelEdit,
  onDelete, onUpload, onPhotoClick,
}) {
  if (isEditing) {
    return (
      <form className="card form-grid" style={{ marginBottom: 12 }} onSubmit={onSaveEdit}>
        <input placeholder="Description" required value={editForm.description}
          onChange={(e) => onEditFormChange({ ...editForm, description: e.target.value })} />

        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
          Category
        </label>
        <select value={editForm.category} onChange={(e) => onEditFormChange({ ...editForm, category: e.target.value })}>
          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <input type="number" step="0.01" placeholder="Amount ($)" required value={editForm.amount}
          onChange={(e) => onEditFormChange({ ...editForm, amount: e.target.value })} />

        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
          Recurrence
        </label>
        <select value={editForm.recurrence} onChange={(e) => onEditFormChange({ ...editForm, recurrence: e.target.value })}>
          {RECURRENCE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        {editForm.recurrence === 'yearly' && (
          <>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
              Month
            </label>
            <select value={editForm.recurrence_month} onChange={(e) => onEditFormChange({ ...editForm, recurrence_month: e.target.value })}>
              {MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </>
        )}

        {editForm.recurrence !== 'one_time' && (
          <>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
              Day of {editForm.recurrence === 'yearly' ? 'Month' : 'Month it Recurs'}
            </label>
            <select value={editForm.recurrence_day} onChange={(e) => onEditFormChange({ ...editForm, recurrence_day: e.target.value })}>
              {DAY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </>
        )}

        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
          {editForm.recurrence === 'one_time' ? 'Date' : 'Start Date'}
        </label>
        <input type="date" required value={editForm.expense_date}
          onChange={(e) => onEditFormChange({ ...editForm, expense_date: e.target.value })} />

        <textarea placeholder="Notes" value={editForm.notes}
          onChange={(e) => onEditFormChange({ ...editForm, notes: e.target.value })} />

        <div className="card-actions">
          <button type="submit">Save Changes</button>
          <button type="button" className="btn-secondary" onClick={onCancelEdit}>Cancel</button>
        </div>
      </form>
    )
  }

  return (
    <div className="card" key={exp.id}>
      <div className="card-main">
        <strong>{exp.description}</strong>
        <span className="muted">{exp.category}</span>
        <span>${Number(exp.amount).toFixed(2)}</span>
        {dateLabel}
        {exp.notes && <p className="card-notes">{exp.notes}</p>}
      </div>

      {receipts.length > 0 && (
        <div className="photo-grid">
          {receipts.map((photo) => (
            <div className="photo-item" key={photo.id}>
              <img
                src={receiptUrl(photo.storage_path)}
                alt=""
                className="photo-thumb"
                onClick={() => onPhotoClick(photo)}
              />
              <span className="photo-timestamp">{formatTimestamp(photo.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card-actions">
        <label className="btn-file">
          {uploading ? 'Uploading...' : '+ Add Receipt'}
          <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={(e) => onUpload(exp.id, e)} />
        </label>
        <button className="btn-secondary" disabled={busy} onClick={() => onStartEdit(exp)}>
          Edit
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => onDelete(exp)}>
          Delete
        </button>
      </div>
    </div>
  )
}

function MileageCard({ log, isEditing, editForm, onEditFormChange, onStartEdit, onSaveEdit, onCancelEdit, onDelete, busy }) {
  if (isEditing) {
    return (
      <form className="card form-grid" style={{ marginBottom: 12 }} onSubmit={onSaveEdit}>
        <input placeholder="Vehicle (e.g. Truck, Van)" required list="vehicle-names" value={editForm.vehicle}
          onChange={(e) => onEditFormChange({ ...editForm, vehicle: e.target.value })} />

        <input type="number" step="0.1" placeholder="Miles" required value={editForm.miles}
          onChange={(e) => onEditFormChange({ ...editForm, miles: e.target.value })} />

        <input type="date" required value={editForm.log_date}
          onChange={(e) => onEditFormChange({ ...editForm, log_date: e.target.value })} />

        <input placeholder="Purpose (e.g. Job site visits)" value={editForm.purpose}
          onChange={(e) => onEditFormChange({ ...editForm, purpose: e.target.value })} />

        <textarea placeholder="Notes" value={editForm.notes}
          onChange={(e) => onEditFormChange({ ...editForm, notes: e.target.value })} />

        <div className="card-actions">
          <button type="submit">Save Changes</button>
          <button type="button" className="btn-secondary" onClick={onCancelEdit}>Cancel</button>
        </div>
      </form>
    )
  }

  return (
    <div className="card" key={log.id}>
      <div className="card-main">
        <strong>{log.vehicle}</strong>
        <span>{Number(log.miles).toLocaleString()} mi</span>
        <span className="card-date">{new Date(log.log_date + 'T00:00:00').toLocaleDateString()}</span>
        {log.purpose && <span className="muted">{log.purpose}</span>}
        {log.notes && <p className="card-notes">{log.notes}</p>}
      </div>
      <div className="card-actions">
        <button className="btn-secondary" disabled={busy} onClick={() => onStartEdit(log)}>
          Edit
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => onDelete(log)}>
          Delete
        </button>
      </div>
    </div>
  )
}

export default function Expenses() {
  const { accountId } = useAccount()
  const [expenses, setExpenses] = useState([])
  const [receiptsByExpense, setReceiptsByExpense] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [busyId, setBusyId] = useState(null)
  const [uploadingId, setUploadingId] = useState(null)
  const [lightboxPhoto, setLightboxPhoto] = useState(null)
  const [editingExpenseId, setEditingExpenseId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [mileageLogs, setMileageLogs] = useState([])
  const [showMileageForm, setShowMileageForm] = useState(false)
  const [mileageForm, setMileageForm] = useState(emptyMileageForm())
  const [busyMileageId, setBusyMileageId] = useState(null)
  const [editingMileageId, setEditingMileageId] = useState(null)
  const [editMileageForm, setEditMileageForm] = useState(null)
  const [activeSection, setActiveSection] = useState('dollar')
  const [showAllRecurring, setShowAllRecurring] = useState(false)
  const [showAllOneTime, setShowAllOneTime] = useState(false)

  async function loadExpenses() {
    setLoading(true)
    const [{ data: expenseData }, { data: receiptData }, { data: mileageData }] = await Promise.all([
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('expense_receipts').select('*').order('created_at', { ascending: false }),
      supabase.from('mileage_logs').select('*').order('log_date', { ascending: false }),
    ])
    setExpenses(expenseData ?? [])
    const grouped = {}
    for (const receipt of receiptData ?? []) {
      if (!grouped[receipt.expense_id]) grouped[receipt.expense_id] = []
      grouped[receipt.expense_id].push(receipt)
    }
    setReceiptsByExpense(grouped)
    setMileageLogs(mileageData ?? [])
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
      recurrence: form.recurrence,
      recurrence_day: form.recurrence !== 'one_time' ? Number(form.recurrence_day) : null,
      recurrence_month: form.recurrence === 'yearly' ? Number(form.recurrence_month) : null,
      account_id: accountId,
    }])
    setForm(emptyForm())
    setShowForm(false)
    loadExpenses()
  }

  function startEditExpense(expense) {
    setEditingExpenseId(expense.id)
    setEditForm(expenseToEditForm(expense))
  }

  function cancelEditExpense() {
    setEditingExpenseId(null)
    setEditForm(null)
  }

  async function handleUpdateExpense(e) {
    e.preventDefault()
    await supabase.from('expenses').update({
      description: editForm.description,
      category: editForm.category,
      amount: Number(editForm.amount) || 0,
      expense_date: editForm.expense_date,
      notes: editForm.notes || null,
      recurrence: editForm.recurrence,
      recurrence_day: editForm.recurrence !== 'one_time' ? Number(editForm.recurrence_day) : null,
      recurrence_month: editForm.recurrence === 'yearly' ? Number(editForm.recurrence_month) : null,
    }).eq('id', editingExpenseId)
    setEditingExpenseId(null)
    setEditForm(null)
    loadExpenses()
  }

  async function deleteExpense(expense) {
    if (!window.confirm(`Delete this expense ("${expense.description}")? This can't be undone.`)) return
    setBusyId(expense.id)
    await supabase.from('expenses').delete().eq('id', expense.id)
    setBusyId(null)
    loadExpenses()
  }

  async function handleUploadReceipt(expenseId, e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploadingId(expenseId)
    for (const file of files) {
      const path = `${expenseId}/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('expense-receipts').upload(path, file)
      if (!uploadError) {
        await supabase.from('expense_receipts').insert([{ expense_id: expenseId, storage_path: path, account_id: accountId }])
      }
    }
    e.target.value = ''
    setUploadingId(null)
    loadExpenses()
  }

  async function deleteReceipt(photo) {
    if (!window.confirm('Delete this receipt photo?')) return
    await supabase.storage.from('expense-receipts').remove([photo.storage_path])
    await supabase.from('expense_receipts').delete().eq('id', photo.id)
    setLightboxPhoto(null)
    loadExpenses()
  }

  async function handleAddMileage(e) {
    e.preventDefault()
    await supabase.from('mileage_logs').insert([{
      vehicle: mileageForm.vehicle,
      log_date: mileageForm.log_date,
      miles: Number(mileageForm.miles) || 0,
      purpose: mileageForm.purpose || null,
      notes: mileageForm.notes || null,
      account_id: accountId,
    }])
    setMileageForm(emptyMileageForm())
    setShowMileageForm(false)
    loadExpenses()
  }

  function startEditMileage(log) {
    setEditingMileageId(log.id)
    setEditMileageForm(mileageToEditForm(log))
  }

  function cancelEditMileage() {
    setEditingMileageId(null)
    setEditMileageForm(null)
  }

  async function handleUpdateMileage(e) {
    e.preventDefault()
    await supabase.from('mileage_logs').update({
      vehicle: editMileageForm.vehicle,
      log_date: editMileageForm.log_date,
      miles: Number(editMileageForm.miles) || 0,
      purpose: editMileageForm.purpose || null,
      notes: editMileageForm.notes || null,
    }).eq('id', editingMileageId)
    setEditingMileageId(null)
    setEditMileageForm(null)
    loadExpenses()
  }

  async function deleteMileage(log) {
    if (!window.confirm(`Delete this mileage entry for "${log.vehicle}"? This can't be undone.`)) return
    setBusyMileageId(log.id)
    await supabase.from('mileage_logs').delete().eq('id', log.id)
    setBusyMileageId(null)
    loadExpenses()
  }

  const oneTimeExpenses = expenses.filter((e) => e.recurrence === 'one_time')
  const recurringExpenses = expenses.filter((e) => e.recurrence !== 'one_time')
  const visibleRecurring = showAllRecurring ? recurringExpenses : recurringExpenses.slice(0, 3)
  const visibleOneTime = showAllOneTime ? oneTimeExpenses : oneTimeExpenses.slice(0, 3)
  const monthlyRecurring = recurringExpenses.filter((e) => e.recurrence === 'monthly')
  const yearlyRecurring = recurringExpenses.filter((e) => e.recurrence === 'yearly')

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const currentMonth = today.getMonth() + 1

  const oneTimeThisMonth = oneTimeExpenses
    .filter((e) => new Date(e.expense_date + 'T00:00:00') >= monthStart)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const monthlyRecurringTotal = monthlyRecurring.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const yearlyRecurringTotal = yearlyRecurring.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const yearlyDueThisMonth = yearlyRecurring
    .filter((e) => e.recurrence_month === currentMonth)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

  const thisMonthTotal = oneTimeThisMonth + monthlyRecurringTotal + yearlyDueThisMonth
  const allTimeTotal = oneTimeExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

  const mileageThisMonthTotal = mileageLogs
    .filter((m) => new Date(m.log_date + 'T00:00:00') >= monthStart)
    .reduce((sum, m) => sum + (Number(m.miles) || 0), 0)
  const mileageAllTimeTotal = mileageLogs.reduce((sum, m) => sum + (Number(m.miles) || 0), 0)

  const vehicleNames = [...new Set(mileageLogs.map((m) => m.vehicle))].sort()
  const mileageByVehicle = vehicleNames.map((vehicle) => {
    const logsForVehicle = mileageLogs.filter((m) => m.vehicle === vehicle)
    return {
      vehicle,
      thisMonth: logsForVehicle
        .filter((m) => new Date(m.log_date + 'T00:00:00') >= monthStart)
        .reduce((sum, m) => sum + (Number(m.miles) || 0), 0),
      allTime: logsForVehicle.reduce((sum, m) => sum + (Number(m.miles) || 0), 0),
    }
  })

  return (
    <div>
      <div className="page-header">
        <h1>Expenses</h1>
        <div className="card-actions">
          {activeSection === 'mileage' ? (
            <>
              <button
                className="btn-secondary"
                onClick={() => exportToCsv(`mileage-${localDateStr()}.csv`, mileageLogs, MILEAGE_CSV_COLUMNS)}
              >
                Export CSV
              </button>
              <button onClick={() => { setShowMileageForm((v) => !v); setMileageForm(emptyMileageForm()) }}>
                {showMileageForm ? 'Cancel' : '+ Log Mileage'}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-secondary"
                onClick={() => exportToCsv(`expenses-${localDateStr()}.csv`, expenses, EXPENSE_CSV_COLUMNS)}
              >
                Export CSV
              </button>
              <button onClick={() => { setShowForm((v) => !v); setForm(emptyForm()) }}>
                {showForm ? 'Cancel' : '+ Add Expense'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="tab-bar">
        <button type="button" className={activeSection === 'dollar' ? 'tab active' : 'tab'}
          onClick={() => setActiveSection('dollar')}>
          Expenses
        </button>
        <button type="button" className={activeSection === 'mileage' ? 'tab active' : 'tab'}
          onClick={() => setActiveSection('mileage')}>
          Vehicle Mileage
        </button>
      </div>

      <datalist id="vehicle-names">
        {vehicleNames.map((v) => <option key={v} value={v} />)}
      </datalist>

      {activeSection === 'mileage' ? (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-value">{mileageThisMonthTotal.toLocaleString()} mi</span>
              <span className="stat-label">This Month</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{mileageAllTimeTotal.toLocaleString()} mi</span>
              <span className="stat-label">All Time</span>
            </div>
          </div>

          {mileageByVehicle.length > 0 && (
            <div className="stat-grid">
              {mileageByVehicle.map((v) => (
                <div className="stat-card" key={v.vehicle}>
                  <span className="stat-value">{v.allTime.toLocaleString()} mi</span>
                  <span className="stat-label">{v.vehicle} — {v.thisMonth.toLocaleString()} mi this month</span>
                </div>
              ))}
            </div>
          )}

          {showMileageForm && (
            <form className="card form-grid" onSubmit={handleAddMileage}>
              <input placeholder="Vehicle (e.g. Truck, Van)" required list="vehicle-names" value={mileageForm.vehicle}
                onChange={(e) => setMileageForm({ ...mileageForm, vehicle: e.target.value })} />

              <input type="number" step="0.1" placeholder="Miles" required value={mileageForm.miles}
                onChange={(e) => setMileageForm({ ...mileageForm, miles: e.target.value })} />

              <input type="date" required value={mileageForm.log_date}
                onChange={(e) => setMileageForm({ ...mileageForm, log_date: e.target.value })} />

              <input placeholder="Purpose (e.g. Job site visits)" value={mileageForm.purpose}
                onChange={(e) => setMileageForm({ ...mileageForm, purpose: e.target.value })} />

              <textarea placeholder="Notes" value={mileageForm.notes}
                onChange={(e) => setMileageForm({ ...mileageForm, notes: e.target.value })} />

              <button type="submit">Save Mileage</button>
            </form>
          )}

          {loading ? (
            <p>Loading...</p>
          ) : mileageLogs.length === 0 ? (
            <p className="empty-state">No mileage logged yet.</p>
          ) : (
            <div className="card-list">
              {mileageLogs.map((log) => (
                <MileageCard
                  key={log.id}
                  log={log}
                  busy={busyMileageId === log.id}
                  isEditing={editingMileageId === log.id}
                  editForm={editMileageForm}
                  onEditFormChange={setEditMileageForm}
                  onStartEdit={startEditMileage}
                  onSaveEdit={handleUpdateMileage}
                  onCancelEdit={cancelEditMileage}
                  onDelete={deleteMileage}
                />
              ))}
            </div>
          )}
        </>
      ) : (
      <>
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">${thisMonthTotal.toFixed(2)}</span>
          <span className="stat-label">This Month</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">${allTimeTotal.toFixed(2)}</span>
          <span className="stat-label">All Time (one-time)</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">${monthlyRecurringTotal.toFixed(2)}</span>
          <span className="stat-label">Monthly Recurring</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">${yearlyRecurringTotal.toFixed(2)}</span>
          <span className="stat-label">Yearly Recurring</span>
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
            Recurrence
          </label>
          <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
            {RECURRENCE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>

          {form.recurrence === 'yearly' && (
            <>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                Month
              </label>
              <select value={form.recurrence_month} onChange={(e) => setForm({ ...form, recurrence_month: e.target.value })}>
                {MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </>
          )}

          {form.recurrence !== 'one_time' && (
            <>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                Day of {form.recurrence === 'yearly' ? 'Month' : 'Month it Recurs'}
              </label>
              <select value={form.recurrence_day} onChange={(e) => setForm({ ...form, recurrence_day: e.target.value })}>
                {DAY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </>
          )}

          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
            {form.recurrence === 'one_time' ? 'Date' : 'Start Date'}
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
      ) : (
        <>
          {recurringExpenses.length > 0 && (
            <section>
              <h2>Recurring Expenses</h2>
              <div className="card-list">
                {visibleRecurring.map((exp) => (
                  <ExpenseCard
                    key={exp.id}
                    exp={exp}
                    receipts={receiptsByExpense[exp.id] ?? []}
                    dateLabel={<span className="calendar-job-chip">{formatRecurrence(exp)}</span>}
                    busy={busyId === exp.id}
                    uploading={uploadingId === exp.id}
                    isEditing={editingExpenseId === exp.id}
                    editForm={editForm}
                    onEditFormChange={setEditForm}
                    onStartEdit={startEditExpense}
                    onSaveEdit={handleUpdateExpense}
                    onCancelEdit={cancelEditExpense}
                    onDelete={deleteExpense}
                    onUpload={handleUploadReceipt}
                    onPhotoClick={setLightboxPhoto}
                  />
                ))}
              </div>
              {recurringExpenses.length > 3 && (
                <button className="btn-secondary" onClick={() => setShowAllRecurring((v) => !v)}>
                  {showAllRecurring ? 'Show Less' : `Show All (${recurringExpenses.length})`}
                </button>
              )}
            </section>
          )}

          <section>
            <h2>One-Time Expenses</h2>
            {oneTimeExpenses.length === 0 ? (
              <p className="empty-state">No one-time expenses logged yet.</p>
            ) : (
              <>
                <div className="card-list">
                  {visibleOneTime.map((exp) => (
                    <ExpenseCard
                      key={exp.id}
                      exp={exp}
                      receipts={receiptsByExpense[exp.id] ?? []}
                      dateLabel={<span className="card-date">{new Date(exp.expense_date + 'T00:00:00').toLocaleDateString()}</span>}
                      busy={busyId === exp.id}
                      uploading={uploadingId === exp.id}
                      isEditing={editingExpenseId === exp.id}
                      editForm={editForm}
                      onEditFormChange={setEditForm}
                      onStartEdit={startEditExpense}
                      onSaveEdit={handleUpdateExpense}
                      onCancelEdit={cancelEditExpense}
                      onDelete={deleteExpense}
                      onUpload={handleUploadReceipt}
                      onPhotoClick={setLightboxPhoto}
                    />
                  ))}
                </div>
                {oneTimeExpenses.length > 3 && (
                  <button className="btn-secondary" onClick={() => setShowAllOneTime((v) => !v)}>
                    {showAllOneTime ? 'Show Less' : `Show All (${oneTimeExpenses.length})`}
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}
      </>
      )}

      {lightboxPhoto && (
        <div className="modal-overlay" onClick={() => setLightboxPhoto(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <img src={receiptUrl(lightboxPhoto.storage_path)} alt="" className="photo-lightbox-img" />
            <p className="photo-lightbox-timestamp">{formatTimestamp(lightboxPhoto.created_at)}</p>
            <div className="card-actions">
              <button className="btn-secondary" onClick={() => setLightboxPhoto(null)}>Close</button>
              <button className="btn-secondary" onClick={() => deleteReceipt(lightboxPhoto)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
