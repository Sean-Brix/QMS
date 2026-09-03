/* ============================================================================
   filters.js — search, filter, sort and paginate helpers shared by all tables.
   ========================================================================== */

import { ALL } from '@/config/constants'
import { toDate } from './format'

/** Case-insensitive match of `query` against a set of extracted strings. */
export function matchesQuery(record, query, fields) {
  if (!query) return true
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((field) => {
    const value = typeof field === 'function' ? field(record) : record[field]
    return value != null && String(value).toLowerCase().includes(q)
  })
}

/** Equality filter that treats the sentinel "All" as no filter. */
export function matchesValue(actual, expected) {
  if (expected === ALL || expected === '' || expected == null) return true
  return actual === expected
}

/** Inclusive date-range filter; either bound may be empty. */
export function matchesDateRange(value, from, to) {
  const d = toDate(value)
  if (!d) return !from && !to
  if (from) {
    const start = toDate(from)
    if (start && d < new Date(start.getFullYear(), start.getMonth(), start.getDate())) return false
  }
  if (to) {
    const end = toDate(to)
    if (end && d > new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59)) return false
  }
  return true
}

/** Stable sort by an accessor, honouring 'asc' | 'desc'. */
export function sortBy(rows, accessor, direction = 'asc') {
  const get = typeof accessor === 'function' ? accessor : (row) => row[accessor]
  const factor = direction === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const va = get(a)
    const vb = get(b)
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor
    return String(va).localeCompare(String(vb), undefined, { numeric: true }) * factor
  })
}

export function paginate(rows, page, pageSize) {
  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * pageSize
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    pageCount,
    page: safePage,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
  }
}

/** Count occurrences of `key(row)` across rows — used by every stat strip. */
export function countBy(rows, key) {
  const get = typeof key === 'function' ? key : (row) => row[key]
  return rows.reduce((acc, row) => {
    const k = get(row)
    if (k == null) return acc
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
}

/** Options list for a <select>, always led by the "All" sentinel. */
export function withAll(values, allLabel = ALL) {
  return [allLabel, ...values]
}
