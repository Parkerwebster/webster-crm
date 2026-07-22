export function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
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
