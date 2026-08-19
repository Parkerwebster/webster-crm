export function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

export const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const totalMinutes = i * 15
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return { value, label: formatTime(value) }
})

export function formatTimestamp(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatTimeRange(startTime, endTime) {
  if (!startTime && !endTime) return ''
  if (startTime && endTime) {
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    const hours = (eh + em / 60) - (sh + sm / 60)
    const durationLabel = hours > 0 ? ` (${hours % 1 === 0 ? hours : hours.toFixed(1)} hr${hours === 1 ? '' : 's'})` : ''
    return `${formatTime(startTime)} – ${formatTime(endTime)}${durationLabel}`
  }
  return formatTime(startTime || endTime)
}
