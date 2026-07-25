import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useAccount } from '../context/AccountContext'

const WEBHOOK_BASE_URL = 'https://icboiftjjmevwwltnazb.supabase.co/functions/v1/stripe-webhook'

export default function Account() {
  const { user } = useAuth()
  const { accountId } = useAccount()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [stripeConnected, setStripeConnected] = useState(false)
  const [stripeSecretKey, setStripeSecretKey] = useState('')
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('')
  const [stripeStatus, setStripeStatus] = useState('')
  const [stripeError, setStripeError] = useState('')
  const [savingStripe, setSavingStripe] = useState(false)

  useEffect(() => {
    if (!accountId) return
    supabase.from('accounts').select('stripe_connected').eq('id', accountId).single()
      .then(({ data }) => setStripeConnected(!!data?.stripe_connected))
  }, [accountId])

  async function handleSaveStripe(e) {
    e.preventDefault()
    setStripeError('')
    setStripeStatus('')
    setSavingStripe(true)
    const { data, error } = await supabase.functions.invoke('save-stripe-key', {
      body: {
        stripe_secret_key: stripeSecretKey.trim(),
        stripe_webhook_secret: stripeWebhookSecret.trim() || undefined,
      },
    })
    setSavingStripe(false)
    if (error || !data?.ok) {
      setStripeError(data?.error || 'Failed to save Stripe key. Double check it and try again.')
      return
    }
    setStripeStatus('Stripe connected!')
    setStripeConnected(true)
    setStripeSecretKey('')
    setStripeWebhookSecret('')
  }

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

      <div className="card" style={{ maxWidth: 420, marginTop: 20 }}>
        <p style={{ marginTop: 0 }}>
          <strong>Stripe Payments:</strong>{' '}
          {stripeConnected ? (
            <span style={{ color: 'var(--green)' }}>Connected ✓</span>
          ) : (
            <span className="muted">Not connected</span>
          )}
        </p>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Connect your own Stripe account so invoice payment links and payouts go directly to you.
        </p>

        {accountId && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
              Your webhook URL (paste into Stripe → Developers → Webhooks)
            </label>
            <div className="form-row" style={{ marginTop: 6 }}>
              <input readOnly value={`${WEBHOOK_BASE_URL}?account_id=${accountId}`} onFocus={(e) => e.target.select()} />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(`${WEBHOOK_BASE_URL}?account_id=${accountId}`)
                  setStripeStatus('Webhook URL copied!')
                }}
              >
                Copy
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveStripe} className="form-grid" style={{ marginBottom: 0 }}>
          <label htmlFor="stripe-secret" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
            Stripe secret key
          </label>
          <input
            id="stripe-secret"
            type="password"
            placeholder="sk_live_..."
            value={stripeSecretKey}
            onChange={(e) => setStripeSecretKey(e.target.value)}
            required
          />
          <label htmlFor="stripe-webhook" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
            Stripe webhook signing secret
          </label>
          <input
            id="stripe-webhook"
            type="password"
            placeholder="whsec_..."
            value={stripeWebhookSecret}
            onChange={(e) => setStripeWebhookSecret(e.target.value)}
          />
          {stripeError && <p style={{ color: 'var(--red)', margin: 0, fontSize: '0.85rem' }}>{stripeError}</p>}
          {stripeStatus && <p style={{ color: 'var(--green)', margin: 0, fontSize: '0.85rem' }}>{stripeStatus}</p>}
          <button type="submit" disabled={savingStripe}>
            {savingStripe ? 'Saving...' : 'Save Stripe Key'}
          </button>
        </form>
      </div>
    </div>
  )
}
