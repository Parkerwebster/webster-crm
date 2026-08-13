export const SERVICE_OPTIONS = [
  'Window Cleaning (Exterior Only)',
  'Window Cleaning (Interior and Exterior)',
  'Screen Cleaning',
  'Deep Track Cleaning',
  'Cobweb/Mud Dauber Clean Up',
  'Solar Panel Cleaning',
  'Custom',
]

export function emptyServiceLine() {
  return { id: crypto.randomUUID(), type: SERVICE_OPTIONS[0], customName: '', price: '' }
}

export function combineServiceLines(lines) {
  const names = []
  let total = 0
  for (const line of lines) {
    const name = line.type === 'Custom' ? line.customName.trim() : line.type
    if (name) names.push(name)
    if (line.price) total += Number(line.price) || 0
  }
  return { serviceType: names.join(' + '), total }
}

export function serviceLinesFromJob(job) {
  return [{
    id: crypto.randomUUID(),
    type: 'Custom',
    customName: job.service_type || '',
    price: job.price != null ? String(job.price) : '',
  }]
}
