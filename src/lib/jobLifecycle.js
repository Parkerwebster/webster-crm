import { supabase } from './supabaseClient'

export const STATUS_FLOW = ['quoted', 'scheduled', 'completed', 'invoiced', 'paid']

export const RECURRING_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannual', label: 'Every 6 Months' },
  { value: 'annual', label: 'Annually' },
]

export function nextStatus(status) {
  const idx = STATUS_FLOW.indexOf(status)
  return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null
}

function computeNextServiceDate(interval, fromDate = new Date()) {
  const d = new Date(fromDate)
  if (interval === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (interval === 'quarterly') d.setMonth(d.getMonth() + 3)
  else if (interval === 'biannual') d.setMonth(d.getMonth() + 6)
  else if (interval === 'annual') d.setFullYear(d.getFullYear() + 1)
  else return null
  return d.toISOString().slice(0, 10)
}

export async function advanceJobStatus(job, { accountId } = {}) {
  const next = nextStatus(job.status)
  if (!next) return null

  await supabase.from('jobs').update({ status: next, updated_at: new Date().toISOString() }).eq('id', job.id)

  const customerId = job.customer_id || job.customers?.id

  if (next === 'completed' && job.recurring_interval && job.recurring_interval !== 'none' && customerId) {
    const nextServiceDate = computeNextServiceDate(job.recurring_interval)
    if (nextServiceDate) {
      await supabase.from('customers').update({ next_service_date: nextServiceDate }).eq('id', customerId)
    }
  }

  if (next === 'paid') {
    const customer = job.customers
    if (customer?.email) {
      supabase.functions.invoke('send-review-request', {
        body: {
          account_id: accountId,
          customer_name: customer.name,
          customer_email: customer.email,
        },
      }).catch(() => {})
    }
  }

  return next
}
