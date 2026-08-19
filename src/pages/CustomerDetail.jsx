import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { buildQuoteEmail } from '../lib/quoteEmail'
import { formatTimeRange, TIME_OPTIONS } from '../lib/format'
import QuoteEmailModal from '../components/QuoteEmailModal'
import { useAccount } from '../context/AccountContext'
import { nextStatus, advanceJobStatus, RECURRING_OPTIONS } from '../lib/jobLifecycle'
import { emptyServiceLine, combineServiceLines, serviceLinesFromJob } from '../lib/services'
import ServiceLineItems from '../components/ServiceLineItems'

const SOURCE_OPTIONS = ['Website', 'Door Knocking', 'Referral']

const VISIT_TYPES = ['Touch-up', 'Follow-up Visit', 'Free Walkthrough/Estimate', 'Custom']

const EMPTY_JOB_FORM = {
  mode: 'job',
  serviceLines: [emptyServiceLine()],
  visitType: VISIT_TYPES[0],
  visitTypeCustom: '',
  scheduled_date: '',
  startTime: '',
  endTime: '',
  notes: '',
  technicianId: '',
  recurringInterval: 'none',
}

function photoUrl(path) {
  return supabase.storage.from('customer-photos').getPublicUrl(path).data.publicUrl
}

function jobPhotoUrl(path) {
  return supabase.storage.from('job-photos').getPublicUrl(path).data.publicUrl
}

function customerToInfoForm(customer) {
  return {
    phone: customer.phone || '',
    email: customer.email || '',
    address: customer.address || '',
    source: customer.source || '',
    referral_name: customer.referral_name || '',
    notes: customer.notes || '',
  }
}

function jobToEditForm(job) {
  return {
    serviceLines: serviceLinesFromJob(job),
    scheduled_date: job.scheduled_date || '',
    startTime: job.start_time ? job.start_time.slice(0, 5) : '',
    endTime: job.end_time ? job.end_time.slice(0, 5) : '',
    notes: job.notes || '',
    technicianId: job.technician_id || '',
  }
}

export default function CustomerDetail() {
  const { accountId } = useAccount()
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [jobs, setJobs] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [photos, setPhotos] = useState([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState(null)
  const [jobPhotosByJob, setJobPhotosByJob] = useState({})
  const [uploadingJobPhotoId, setUploadingJobPhotoId] = useState(null)
  const [lightboxJobPhoto, setLightboxJobPhoto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [quoteEmail, setQuoteEmail] = useState(null)
  const [form, setForm] = useState(EMPTY_JOB_FORM)
  const [editingJobId, setEditingJobId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editingInfo, setEditingInfo] = useState(false)
  const [infoForm, setInfoForm] = useState(null)
  const [sendingInvoiceId, setSendingInvoiceId] = useState(null)

  async function loadData() {
    setLoading(true)
    const [{ data: customerData }, { data: jobsData }, { data: techData }, { data: photosData }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('jobs').select('*, technicians(id, name, color)').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('technicians').select('*').eq('active', true).order('name'),
      supabase.from('customer_photos').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
    ])

    const jobIds = (jobsData ?? []).map((j) => j.id)
    const { data: jobPhotosData } = jobIds.length > 0
      ? await supabase.from('job_photos').select('*').in('job_id', jobIds).order('created_at', { ascending: false })
      : { data: [] }
    const groupedJobPhotos = {}
    for (const photo of jobPhotosData ?? []) {
      if (!groupedJobPhotos[photo.job_id]) groupedJobPhotos[photo.job_id] = []
      groupedJobPhotos[photo.job_id].push(photo)
    }

    setCustomer(customerData)
    setJobs(jobsData ?? [])
    setTechnicians(techData ?? [])
    setPhotos(photosData ?? [])
    setJobPhotosByJob(groupedJobPhotos)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [id])

  async function handleAddJob(e) {
    e.preventDefault()

    const { serviceType, total } = form.mode === 'visit'
      ? { serviceType: form.visitType === 'Custom' ? (form.visitTypeCustom.trim() || 'Custom') : form.visitType, total: 0 }
      : combineServiceLines(form.serviceLines)

    await supabase.from('jobs').insert([{
      customer_id: id,
      service_type: serviceType,
      price: total > 0 ? total : null,
      scheduled_date: form.scheduled_date || null,
      start_time: form.startTime || null,
      end_time: form.endTime || null,
      notes: form.notes,
      technician_id: form.technicianId || null,
      recurring_interval: form.recurringInterval || 'none',
      account_id: accountId,
    }])
    setForm(EMPTY_JOB_FORM)
    setShowForm(false)
    loadData()
  }

  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploadingPhotos(true)
    for (const file of files) {
      const path = `${id}/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('customer-photos').upload(path, file)
      if (!uploadError) {
        await supabase.from('customer_photos').insert([{ customer_id: id, storage_path: path, account_id: accountId }])
      }
    }
    e.target.value = ''
    setUploadingPhotos(false)
    loadData()
  }

  async function deletePhoto(photo) {
    if (!window.confirm('Delete this photo?')) return
    await supabase.storage.from('customer-photos').remove([photo.storage_path])
    await supabase.from('customer_photos').delete().eq('id', photo.id)
    setLightboxPhoto(null)
    loadData()
  }

  async function handleJobPhotoUpload(jobId, e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploadingJobPhotoId(jobId)
    for (const file of files) {
      const path = `${jobId}/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('job-photos').upload(path, file)
      if (!uploadError) {
        await supabase.from('job_photos').insert([{ job_id: jobId, storage_path: path, account_id: accountId }])
      }
    }
    e.target.value = ''
    setUploadingJobPhotoId(null)
    loadData()
  }

  async function deleteJobPhoto(photo) {
    if (!window.confirm('Delete this photo?')) return
    await supabase.storage.from('job-photos').remove([photo.storage_path])
    await supabase.from('job_photos').delete().eq('id', photo.id)
    setLightboxJobPhoto(null)
    loadData()
  }

  function startEditInfo() {
    setInfoForm(customerToInfoForm(customer))
    setEditingInfo(true)
  }

  async function handleUpdateInfo(e) {
    e.preventDefault()
    await supabase.from('customers').update({
      phone: infoForm.phone,
      email: infoForm.email,
      address: infoForm.address,
      source: infoForm.source,
      referral_name: infoForm.source === 'Referral' ? infoForm.referral_name : null,
      notes: infoForm.notes,
    }).eq('id', id)
    setEditingInfo(false)
    setInfoForm(null)
    loadData()
  }

  function startEdit(job) {
    setEditingJobId(job.id)
    setEditForm(jobToEditForm(job))
  }

  async function handleUpdateJob(e, job) {
    e.preventDefault()

    const { serviceType, total } = combineServiceLines(editForm.serviceLines)

    await supabase.from('jobs').update({
      service_type: serviceType,
      price: total > 0 ? total : null,
      scheduled_date: editForm.scheduled_date || null,
      start_time: editForm.startTime || null,
      end_time: editForm.endTime || null,
      notes: editForm.notes,
      technician_id: editForm.technicianId || null,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id)

    setEditingJobId(null)
    setEditForm(null)
    loadData()
  }

  async function advanceStatus(job) {
    await advanceJobStatus({ ...job, customers: customer }, { accountId })
    loadData()
  }

  async function deleteJob(job) {
    if (!window.confirm('Delete this quote/job? This can\'t be undone.')) return
    await supabase.from('jobs').delete().eq('id', job.id)
    loadData()
  }

  function sendQuote(job) {
    setQuoteEmail(buildQuoteEmail(customer, job))
  }

  async function sendInvoice(job) {
    if (!customer.email) {
      alert('This customer has no email on file. Add one before sending an invoice.')
      return
    }
    if (!job.price) {
      alert('This job has no price set. Add a price before sending an invoice.')
      return
    }
    setSendingInvoiceId(job.id)
    const { data, error } = await supabase.functions.invoke('send-invoice', {
      body: {
        job_id: job.id,
        account_id: accountId,
        customer_name: customer.name,
        customer_email: customer.email,
        service_type: job.service_type,
        price: job.price,
        existing_payment_link_url: job.stripe_payment_link_url,
        existing_payment_link_id: job.stripe_payment_link_id,
      },
    })
    setSendingInvoiceId(null)
    if (error || !data?.ok) {
      alert('Failed to send invoice. Check that the job has a price and the customer has an email, then try again.')
      return
    }
    await supabase.from('jobs').update({
      stripe_payment_link_id: data.payment_link_id,
      stripe_payment_link_url: data.payment_link_url,
      invoice_sent_at: new Date().toISOString(),
    }).eq('id', job.id)
    loadData()
  }

  function copyPaymentLink(job) {
    navigator.clipboard.writeText(job.stripe_payment_link_url)
    alert('Payment link copied!')
  }

  async function deleteCustomer() {
    if (!window.confirm(`Delete "${customer.name}" and all their jobs/quotes? This can't be undone.`)) return
    await supabase.from('customers').delete().eq('id', id)
    navigate('/customers')
  }

  async function convertToLead() {
    if (!window.confirm(`Move "${customer.name}" back to Leads? This deletes their customer record and job/quote history.`)) return
    await supabase.from('leads').insert([{
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      message: customer.notes,
      source: customer.source,
      referral_name: customer.referral_name,
      account_id: accountId,
    }])
    await supabase.from('customers').delete().eq('id', id)
    navigate('/leads')
  }

  if (loading) return <p>Loading...</p>
  if (!customer) return <p>Customer not found.</p>

  return (
    <div>
      <Link to="/customers" className="back-link">&larr; All Customers</Link>

      <div className="page-header">
        <h1>{customer.name}</h1>
        <div className="card-actions">
          <button onClick={startEditInfo}>Edit Customer Details</button>
          <button className="btn-secondary" onClick={convertToLead}>Convert to Lead</button>
          <button className="btn-secondary" onClick={deleteCustomer}>Delete Customer</button>
        </div>
      </div>

      {editingInfo ? (
        <form className="card form-grid" onSubmit={handleUpdateInfo}>
          <input placeholder="Phone" value={infoForm.phone}
            onChange={(e) => setInfoForm({ ...infoForm, phone: e.target.value })} />
          <input placeholder="Email" value={infoForm.email}
            onChange={(e) => setInfoForm({ ...infoForm, email: e.target.value })} />
          <input placeholder="Address" value={infoForm.address}
            onChange={(e) => setInfoForm({ ...infoForm, address: e.target.value })} />

          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
            How did you get this customer?
          </label>
          <select value={infoForm.source}
            onChange={(e) => setInfoForm({ ...infoForm, source: e.target.value })}>
            <option value="">Select...</option>
            {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {infoForm.source === 'Referral' && (
            <input placeholder="Referred by..." value={infoForm.referral_name}
              onChange={(e) => setInfoForm({ ...infoForm, referral_name: e.target.value })} />
          )}

          <textarea placeholder="Notes" value={infoForm.notes}
            onChange={(e) => setInfoForm({ ...infoForm, notes: e.target.value })} />

          <div className="card-actions">
            <button type="submit">Save Changes</button>
            <button type="button" className="btn-secondary" onClick={() => setEditingInfo(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="card customer-info-grid">
          <div className="customer-info-item">
            <span className="customer-info-label">Phone</span>
            <span>{customer.phone || '—'}</span>
          </div>
          <div className="customer-info-item">
            <span className="customer-info-label">Email</span>
            <span>{customer.email || '—'}</span>
          </div>
          <div className="customer-info-item">
            <span className="customer-info-label">Address</span>
            <span>{customer.address || '—'}</span>
          </div>
          <div className="customer-info-item">
            <span className="customer-info-label">Source</span>
            <span>
              {customer.source || '—'}
              {customer.source === 'Referral' && customer.referral_name ? ` — ${customer.referral_name}` : ''}
            </span>
          </div>
          {customer.notes && (
            <div className="customer-info-item customer-info-notes">
              <span className="customer-info-label">Notes</span>
              <span>{customer.notes}</span>
            </div>
          )}
        </div>
      )}

      <div className="page-header">
        <h2>Photos</h2>
        <label className="btn-file">
          {uploadingPhotos ? 'Uploading...' : '+ Add Photos'}
          <input type="file" accept="image/*" multiple hidden disabled={uploadingPhotos} onChange={handlePhotoUpload} />
        </label>
      </div>

      {photos.length === 0 ? (
        <p className="empty-state">No photos yet.</p>
      ) : (
        <div className="photo-grid">
          {photos.map((photo) => (
            <img
              key={photo.id}
              src={photoUrl(photo.storage_path)}
              alt=""
              className="photo-thumb"
              onClick={() => setLightboxPhoto(photo)}
            />
          ))}
        </div>
      )}

      {lightboxPhoto && (
        <div className="modal-overlay" onClick={() => setLightboxPhoto(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <img src={photoUrl(lightboxPhoto.storage_path)} alt="" className="photo-lightbox-img" />
            <div className="card-actions">
              <button className="btn-secondary" onClick={() => setLightboxPhoto(null)}>Close</button>
              <button className="btn-secondary" onClick={() => deletePhoto(lightboxPhoto)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h2>Jobs</h2>
        <button onClick={() => { setShowForm((v) => !v); setForm(EMPTY_JOB_FORM) }}>
          {showForm ? 'Cancel' : '+ Add Job'}
        </button>
      </div>

      {showForm && (
        <form className="card form-grid" onSubmit={handleAddJob}>
          <div className="tab-bar">
            <button type="button" className={form.mode === 'job' ? 'tab active' : 'tab'}
              onClick={() => setForm({ ...form, mode: 'job' })}>
              Full Job / Quote
            </button>
            <button type="button" className={form.mode === 'visit' ? 'tab active' : 'tab'}
              onClick={() => setForm({ ...form, mode: 'visit' })}>
              Quick Visit
            </button>
          </div>

          {form.mode === 'job' ? (
            <>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                Services
              </label>
              <ServiceLineItems lines={form.serviceLines}
                onChange={(lines) => setForm({ ...form, serviceLines: lines })} />
            </>
          ) : (
            <>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                Visit Type
              </label>
              <select value={form.visitType}
                onChange={(e) => setForm({ ...form, visitType: e.target.value })}>
                {VISIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {form.visitType === 'Custom' && (
                <input placeholder="Describe the visit" value={form.visitTypeCustom}
                  onChange={(e) => setForm({ ...form, visitTypeCustom: e.target.value })} />
              )}
            </>
          )}

          <input type="date" value={form.scheduled_date}
            onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="job-start-time">Start Time</label>
              <select id="job-start-time" value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}>
                <option value="">--:-- --</option>
                {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="job-end-time">End Time</label>
              <select id="job-end-time" value={form.endTime}
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
          <button type="submit">Save Job</button>
        </form>
      )}

      {jobs.length === 0 ? (
        <p className="empty-state">No jobs yet for this customer.</p>
      ) : (
        <div className="card-list">
          {jobs.map((job) => (
            <div className="card" key={job.id}>
              {editingJobId === job.id ? (
                <form className="form-grid" style={{ marginBottom: 0 }} onSubmit={(e) => handleUpdateJob(e, job)}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                    Services
                  </label>
                  <ServiceLineItems lines={editForm.serviceLines}
                    onChange={(lines) => setEditForm({ ...editForm, serviceLines: lines })} />

                  <input type="date" value={editForm.scheduled_date}
                    onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })} />

                  <div className="form-row">
                    <div className="form-field">
                      <label htmlFor={`edit-start-${job.id}`}>Start Time</label>
                      <select id={`edit-start-${job.id}`} value={editForm.startTime}
                        onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}>
                        <option value="">--:-- --</option>
                        {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="form-field">
                      <label htmlFor={`edit-end-${job.id}`}>End Time</label>
                      <select id={`edit-end-${job.id}`} value={editForm.endTime}
                        onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}>
                        <option value="">--:-- --</option>
                        {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <label htmlFor={`edit-tech-${job.id}`} style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-900)' }}>
                    Technician
                  </label>
                  <select id={`edit-tech-${job.id}`} value={editForm.technicianId}
                    onChange={(e) => setEditForm({ ...editForm, technicianId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  <textarea placeholder="Notes" value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />

                  <div className="card-actions">
                    <button type="submit">Save Changes</button>
                    <button type="button" className="btn-secondary" onClick={() => setEditingJobId(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="card-main">
                    <strong>{job.service_type}</strong>
                    <span className={`status-badge status-${job.status}`}>{job.status}</span>
                    {job.price != null && <span>${Number(job.price).toFixed(2)}</span>}
                    {job.scheduled_date && (
                      <span>
                        Scheduled: {job.scheduled_date}
                        {job.start_time && ` · ${formatTimeRange(job.start_time, job.end_time)}`}
                      </span>
                    )}
                    <span className="muted">
                      Quoted {new Date(job.created_at).toLocaleDateString()}
                    </span>
                    {job.technicians && (
                      <span className="tech-badge">
                        <span className="tech-dot" style={{ background: job.technicians.color }} />
                        {job.technicians.name}
                      </span>
                    )}
                    {job.notes && <p className="card-notes">{job.notes}</p>}
                  </div>

                  {(jobPhotosByJob[job.id]?.length > 0) && (
                    <div className="photo-grid">
                      {jobPhotosByJob[job.id].map((photo) => (
                        <img
                          key={photo.id}
                          src={jobPhotoUrl(photo.storage_path)}
                          alt=""
                          className="photo-thumb"
                          onClick={() => setLightboxJobPhoto(photo)}
                        />
                      ))}
                    </div>
                  )}

                  <div className="card-actions">
                    <label className="btn-file">
                      {uploadingJobPhotoId === job.id ? 'Uploading...' : '+ Add Before Photo'}
                      <input type="file" accept="image/*" multiple hidden
                        disabled={uploadingJobPhotoId === job.id}
                        onChange={(e) => handleJobPhotoUpload(job.id, e)} />
                    </label>
                    <button className="btn-secondary" onClick={() => startEdit(job)}>Edit</button>
                    <button className="btn-secondary" onClick={() => sendQuote(job)}>Send Quote</button>
                    {job.price != null && (
                      job.stripe_payment_link_url ? (
                        <>
                          <button className="btn-secondary" disabled={sendingInvoiceId === job.id} onClick={() => sendInvoice(job)}>
                            {sendingInvoiceId === job.id ? 'Sending...' : 'Resend Invoice'}
                          </button>
                          <button className="btn-secondary" onClick={() => copyPaymentLink(job)}>Copy Payment Link</button>
                        </>
                      ) : (
                        <button disabled={sendingInvoiceId === job.id} onClick={() => sendInvoice(job)}>
                          {sendingInvoiceId === job.id ? 'Sending...' : 'Send Invoice'}
                        </button>
                      )
                    )}
                    {nextStatus(job.status) && (
                      <button onClick={() => advanceStatus(job)}>
                        Mark {nextStatus(job.status)}
                      </button>
                    )}
                    <button className="btn-secondary" onClick={() => deleteJob(job)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {lightboxJobPhoto && (
        <div className="modal-overlay" onClick={() => setLightboxJobPhoto(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <img src={jobPhotoUrl(lightboxJobPhoto.storage_path)} alt="" className="photo-lightbox-img" />
            <div className="card-actions">
              <button className="btn-secondary" onClick={() => setLightboxJobPhoto(null)}>Close</button>
              <button className="btn-secondary" onClick={() => deleteJobPhoto(lightboxJobPhoto)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {quoteEmail && (
        <QuoteEmailModal email={quoteEmail} onClose={() => setQuoteEmail(null)} />
      )}
    </div>
  )
}
