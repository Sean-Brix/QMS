/* ============================================================================
   monitoring.js — what the QMS Department keeps watch on.
   ----------------------------------------------------------------------------
   The Document Control & CAR Overview lists it under "CAR Monitoring &
   Management Reporting": CAR status, pending CARs, overdue CARs, close-out
   dates, effectiveness verification and re-issued CARs, reported to Top
   Management / Management Review. The dashboard and the Management Review
   report both read these selectors, so the two never count the same thing
   differently.
   ========================================================================== */

import { CAR_RESPONSE_STATUSES, CAR_STATUS } from '@/config/constants'
import { verificationDueDateFor } from './cars'
import { TODAY, daysBetween, pluralize, toDate } from './format'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A date-only string read in local time — `new Date('YYYY-MM-DD')` would read it as UTC. */
function localDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : toDate(value)
}

export function inRange(value, range) {
  const date = localDate(value)
  return Boolean(date) && date >= range.start && date <= range.end
}

/* Undated rows sort last. */
const byDate = (pick) => (a, b) => String(pick(a) || '9999').localeCompare(String(pick(b) || '9999'))

/** Waiting on the department's root cause analysis and action plan, nearest reply date first. */
export function pendingCars(cars) {
  return cars
    .filter((car) => CAR_RESPONSE_STATUSES.includes(car.status))
    .sort(byDate((car) => car.initiator.replyDueDate))
}

/** Past the deadline of their current stage, longest overdue first. */
export function overdueCars(cars) {
  return cars.filter((car) => car.overdue).sort(byDate((car) => car.deadline.date))
}

/**
 * A CAR closes out when verification finds the countermeasure in place, and
 * verification is due a day after the target completion date. Once the
 * implementation is recorded that date is fixed on the CAR.
 */
export function plannedCloseOut(car) {
  return car.status === CAR_STATUS.FOR_VERIFICATION || car.closeOutDate
    ? car.verificationDueDate || verificationDueDateFor(car)
    : verificationDueDateFor(car)
}

/** CARs still being implemented or awaiting verification, by planned close-out. */
export function upcomingCloseOuts(cars) {
  return cars
    .filter((car) => car.status === CAR_STATUS.ACTIVE || car.status === CAR_STATUS.FOR_VERIFICATION)
    .map((car) => ({ car, planned: plannedCloseOut(car), actual: null }))
    .filter((row) => row.planned)
    .sort(byDate((row) => row.planned))
}

/** CARs verified and closed out within the period. */
export function closeOutsIn(cars, range) {
  return cars
    .filter((car) => car.closeOutDate && inRange(car.closeOutDate, range))
    .map((car) => ({ car, planned: plannedCloseOut(car), actual: car.closeOutDate }))
    .sort(byDate((row) => row.actual))
}

/** "On time", "4 days late", "Due in 3 days", "Overdue by 2 days". */
export function closeOutStanding({ planned, actual }) {
  if (!planned) return '—'
  if (actual) {
    const late = daysBetween(planned, actual)
    return late > 0 ? `${pluralize(late, 'day')} late` : 'On time'
  }
  const days = daysBetween(TODAY, planned)
  if (days < 0) return `Overdue by ${pluralize(Math.abs(days), 'day')}`
  return days === 0 ? 'Due today' : `Due in ${pluralize(days, 'day')}`
}

/** Effectiveness checks and extended-monitoring checks still to be done, nearest first. */
export function effectivenessChecks(cars) {
  return cars
    .flatMap((car) => {
      if (car.status === CAR_STATUS.FOR_EFFECTIVENESS) {
        return [{ car, kind: 'Effectiveness check', date: car.effectivenessDueDate }]
      }
      if (car.status === CAR_STATUS.CLOSED && car.extendedMonitoring) {
        return [{ car, kind: 'Monitoring check', date: car.extendedMonitoring.nextCheckDate }]
      }
      return []
    })
    .sort(byDate((row) => row.date))
}

/**
 * Every effectiveness result on record: the one on the CAR, and any earlier
 * check that sent it back for further action. Limited to a period when given.
 */
export function effectivenessResults(cars, range) {
  const rows = []
  for (const car of cars) {
    const final = car.verification?.effectiveness
    if (final?.result && final.date) rows.push({ car, result: final.result, date: final.date, notes: final.notes })
    for (const check of car.previousChecks || []) {
      if (check.stage === 'effectiveness' && check.effectiveness?.result) {
        rows.push({ car, result: check.effectiveness.result, date: check.effectiveness.date, notes: check.effectiveness.notes })
      }
    }
  }
  return rows.filter((row) => !range || inRange(row.date, range)).sort(byDate((row) => row.date))
}

/** CARs raised again under a new number, newest first, with the CAR each one continues. */
export function reissuedCars(cars, allCars = cars) {
  const byId = Object.fromEntries(allCars.map((car) => [car.id, car]))
  return cars
    .filter((car) => car.reissuedFrom)
    .map((car) => ({
      car,
      original: byId[car.reissuedFrom] || null,
      reason: car.finding.reasonForReissue,
      recurrence: car.finding.recurrenceCount || 0,
    }))
    .sort(byDate((row) => row.car.initiator.dateIssued))
    .reverse()
}

/**
 * One row per group: CARs issued and closed within the period, and those open
 * and overdue today. `groups` is `[{ key, label }]` in display order.
 */
export function breakdown(cars, range, groupOf, groups) {
  const rows = groups.map((group) => ({ ...group, issued: 0, closed: 0, open: 0, overdue: 0 }))
  const index = Object.fromEntries(rows.map((row) => [row.key, row]))
  for (const car of cars) {
    const row = index[groupOf(car)]
    if (!row) continue
    if (inRange(car.initiator.dateIssued, range)) row.issued += 1
    if (inRange(car.dateClosed, range)) row.closed += 1
    if (car.status !== CAR_STATUS.CLOSED) row.open += 1
    if (car.overdue) row.overdue += 1
  }
  return rows
}

/** CARs issued and closed per month, for the twelve months ending with `end`. */
export function monthlyTrend(cars, end = TODAY) {
  const buckets = []
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(end.getFullYear(), end.getMonth() - offset, 1)
    buckets.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: MONTHS[date.getMonth()],
      month: `${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
      issued: 0,
      closed: 0,
    })
  }

  const index = Object.fromEntries(buckets.map((bucket) => [bucket.key, bucket]))
  const count = (value, field) => {
    const date = localDate(value)
    const bucket = date && index[`${date.getFullYear()}-${date.getMonth()}`]
    if (bucket) bucket[field] += 1
  }

  for (const car of cars) {
    count(car.initiator.dateIssued, 'issued')
    count(car.dateClosed, 'closed')
  }
  return buckets
}
