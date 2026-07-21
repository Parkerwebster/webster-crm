const BUSINESS_NAME = 'Webster Exterior Cleaning'
const BUSINESS_PHONE = '(972) 583-6818'

export function buildQuoteEmail(customer, job) {
  const subject = `Your Quote from ${BUSINESS_NAME}`

  const lines = [
    `Hi ${customer.name || 'there'},`,
    '',
    `Thank you for considering ${BUSINESS_NAME}! Here's your quote:`,
    '',
    `Service: ${job.service_type}`,
  ]

  if (job.price != null) lines.push(`Price: $${Number(job.price).toFixed(2)}`)
  if (job.scheduled_date) lines.push(`Proposed Date: ${job.scheduled_date}`)
  if (job.notes) lines.push('', job.notes)

  lines.push(
    '',
    'If you have any questions or would like to schedule this service, just reply to this email or call/text me.',
    '',
    'Thanks,',
    'Parker Webster',
    BUSINESS_NAME,
    BUSINESS_PHONE,
  )

  return {
    to: customer.email || '',
    subject,
    body: lines.join('\n'),
  }
}

export function buildQuoteMailto({ to, subject, body }) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
