import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Account() {
  const { user } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setStatus('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (error) {
      setError(error.message)
    } else {
      setStatus('Password updated. You can use it next time you sign in.')
      setPassword('')
      setConfirm('')
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Account</h1>
      </div>

      <div className="card" style={{ maxWidth: 420 }}>
        <p style={{ marginTop: 0 }}><strong>Email:</strong> {user?.email}</p>

        <form onSubmit={handleSubmit} className="form-grid" style={{ marginBottom: 0 }}>
          <label htmlFor="password" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
            Set a password
          </label>
          <input
            id="password"
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {error && <p style={{ color: 'var(--red)', margin: 0, fontSize: '0.85rem' }}>{error}</p>}
          {status && <p style={{ color: 'var(--green)', margin: 0, fontSize: '0.85rem' }}>{status}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
