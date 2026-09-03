/* ============================================================================
   format.js — display helpers. All date/label formatting funnels through here.
   ========================================================================== */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The prototype pins "today" so seeded data always reads consistently. */
export const TODAY = new Date('2026-08-31T09:00:00')

export function toDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 2026-08-31 -> "31 Aug 2026" */
export function formatDate(value, fallback = '—') {
  const d = toDate(value)
  if (!d) return fallback
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** 2026-08-31T14:05:00 -> "31 Aug 2026, 02:05 PM" */
export function formatDateTime(value, fallback = '—') {
  const d = toDate(value)
  if (!d) return fallback
  return `${formatDate(d)}, ${formatTime(d)}`
}

export function formatTime(value, fallback = '—') {
  const d = toDate(value)
  if (!d) return fallback
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const period = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${String(h).padStart(2, '0')}:${m} ${period}`
}

/** "2 days ago", "in 5 days", "today" */
export function relativeDays(value, from = TODAY) {
  const d = toDate(value)
  if (!d) return '—'
  const days = daysBetween(from, d)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`
}

/** Whole days from a -> b (positive when b is later). */
export function daysBetween(a, b) {
  const start = toDate(a)
  const end = toDate(b)
  if (!start || !end) return 0
  const ms = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    - new Date(start.getFullYear(), start.getMonth(), start.getDate())
  return Math.round(ms / 86400000)
}

export function isPast(value, from = TODAY) {
  const d = toDate(value)
  return d ? daysBetween(from, d) < 0 : false
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function truncate(text = '', max = 120) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

/** "31 Aug 2026" for an ISO date, or a dash when the field was never filled. */
export function orDash(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback
  return value
}

/** Range label for the reporting screen. */
export function formatRange(start, end) {
  return `${formatDate(start)} — ${formatDate(end)}`
}

/** Start/end of the week (Mon–Sun) containing `date`. */
export function weekRange(date = TODAY) {
  const d = toDate(date)
  const day = (d.getDay() + 6) % 7
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59)
  return { start, end }
}

export function monthRange(date = TODAY) {
  const d = toDate(date)
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
  return { start, end }
}
