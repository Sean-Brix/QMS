/* ============================================================================
   cars.js — CAR lifecycle rules (Document Control & CAR Overview, CAR form).
   ----------------------------------------------------------------------------
   Every stage of a CAR has its own deadline: the reply, the implementation,
   the verification a day after the target date, the effectiveness check six
   months after close-out, and any extended-monitoring check. Overdue is not a
   status but a flag on whichever deadline applies now, so the register can say
   both where a CAR is and whether it is late there.
   ========================================================================== */

import { CAR_RULES } from '@/config/appConfig'
import { CAR_RESPONSE_STATUSES, CAR_STATUS, EFFECTIVENESS_RESULT, REISSUE_REASON } from '@/config/constants'
import { isPast, isoDate, toDate } from './format'

/** A date-only string read in local time — `new Date('YYYY-MM-DD')` would read it as UTC. */
function localDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(toDate(value))
}

export function addDays(value, days) {
  const date = localDate(value)
  date.setDate(date.getDate() + days)
  return isoDate(date)
}

/** Calendar months, clamped to the end of a shorter month (31 Aug + 6 months = 28 Feb). */
export function addMonths(value, months) {
  const date = localDate(value)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return isoDate(date)
}

export const BLANK_CLOSURE = { notes: '', verifiedBy: null, approvedBy: null, verificationDate: null, disposition: 'OPEN' }
export const BLANK_EFFECTIVENESS = { notes: '', validatedBy: null, approvedBy: null, result: null, date: null }

/** The latest target / close-out date across a CAR's actions. */
export function latestTargetDate(car) {
  const dates = [...(car.immediateActions || []), ...(car.correctiveActions || [])]
    .map((item) => item.targetDate)
    .filter(Boolean)
    .sort()
  return dates.length ? dates[dates.length - 1] : null
}

/** When implementation is due: the action targets, unless a check sent the CAR back with a new date. */
export function implementationDueDate(car) {
  return car.implementationDueDate || latestTargetDate(car)
}

/** Verification of the countermeasure: a day after the target completion date (CAR form), or after the
    implementation was recorded if that came later. Whether "a day" is a working day is follow-up E7. */
export function verificationDueDateFor(car, completedOn) {
  const base = [implementationDueDate(car), completedOn].filter(Boolean).sort().pop()
  return base ? addDays(base, CAR_RULES.verificationOffsetDays) : null
}

/** Effectiveness: 6 months after close-out or at the next internal audit, whichever comes first. */
export function effectivenessDueDateFor(closeOutDate) {
  const sixMonths = addMonths(closeOutDate, CAR_RULES.effectivenessMonths)
  const audit = CAR_RULES.nextInternalAudit
  return audit && audit >= closeOutDate && audit < sixMonths ? audit : sixMonths
}

/**
 * The deadline that applies at the CAR's current stage, and who owns it.
 * Under Review has none: the client's documents set no limit on QMS review.
 */
export function carDeadline(car) {
  switch (car.status) {
    case CAR_STATUS.PENDING:
    case CAR_STATUS.FOR_REVISION:
      return { key: 'reply', label: 'Reply due', date: car.initiator.replyDueDate, owner: 'department' }
    case CAR_STATUS.ACTIVE: {
      const date = implementationDueDate(car)
      return date ? { key: 'implementation', label: 'Implementation due', date, owner: 'department' } : null
    }
    case CAR_STATUS.FOR_VERIFICATION:
      return { key: 'verification', label: 'Verification due', date: car.verificationDueDate, owner: 'qms' }
    case CAR_STATUS.FOR_EFFECTIVENESS:
      return { key: 'effectiveness', label: 'Effectiveness check due', date: car.effectivenessDueDate, owner: 'qms' }
    case CAR_STATUS.CLOSED:
      return car.extendedMonitoring
        ? { key: 'monitoring', label: 'Monitoring check due', date: car.extendedMonitoring.nextCheckDate, owner: 'qms' }
        : null
    default:
      return null
  }
}

/** A CAR with its current deadline and overdue flag attached, derived on read.
    `rules` defaults to the CAR settings in effect. */
export function withDeadline(car, rules = CAR_RULES) {
  const deadline = carDeadline(car)
  const overdue = Boolean(rules.autoFlagOverdue && deadline?.date && isPast(deadline.date))
  return { ...car, deadline, overdue }
}

export function isFailedEffectiveness(car) {
  return car.verification?.effectiveness?.result === EFFECTIVENESS_RESULT.FAIL
}

/**
 * The re-issue reasons that apply to a CAR right now (Overview: re-issuance;
 * follow-up D5). A CAR is re-issued once at most; the new CAR carries the chain.
 */
export function reissueReasonsFor(car) {
  if (car.reissuedAs) return []
  if (CAR_RESPONSE_STATUSES.includes(car.status)) {
    const reasons = []
    if (!car.recipient.dateSubmitted && withDeadline(car).overdue) reasons.push(REISSUE_REASON.NO_REPLY)
    if (car.status === CAR_STATUS.FOR_REVISION) reasons.push(REISSUE_REASON.NOT_ACCEPTED)
    return reasons
  }
  if (car.status === CAR_STATUS.UNDER_REVIEW) return [REISSUE_REASON.NOT_ACCEPTED]
  if (car.status === CAR_STATUS.CLOSED) {
    return isFailedEffectiveness(car)
      ? [REISSUE_REASON.FAILED_EFFECTIVENESS, REISSUE_REASON.SAME_ROOT_CAUSE]
      : [REISSUE_REASON.SAME_ROOT_CAUSE]
  }
  return []
}
