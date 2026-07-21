import { useState } from 'react'
import { buildQuoteMailto } from '../lib/quoteEmail'

export default function QuoteEmailModal({ email, onClose }) {
  const [copied, setCopied] = useState('')

  async function copy(field, value) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(field)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      alert('Could not copy automatically — select the text and copy it manually.')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="page-header">
          <h2 style={{ margin: 0 }}>Quote Email</h2>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>

        <p className="muted" style={{ marginTop: 0 }}>
          Copy this into a new email in Gmail (or whatever you use), or try "Open in Email App" if you have a desktop mail app set up.
        </p>

        <div className="form-field">
          <label>To</label>
          <div className="copy-row">
            <input readOnly value={email.to || '(no email on file)'} />
            <button className="btn-secondary" onClick={() => copy('to', email.to)}>
              {copied === 'to' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="form-field">
          <label>Subject</label>
          <div className="copy-row">
            <input readOnly value={email.subject} />
            <button className="btn-secondary" onClick={() => copy('subject', email.subject)}>
              {copied === 'subject' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="form-field">
          <label>Body</label>
          <div className="copy-row copy-row-textarea">
            <textarea readOnly rows={10} value={email.body} />
            <button className="btn-secondary" onClick={() => copy('body', email.body)}>
              {copied === 'body' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <a href={buildQuoteMailto(email)} className="btn-link">
          Open in Email App instead &rarr;
        </a>
      </div>
    </div>
  )
}
