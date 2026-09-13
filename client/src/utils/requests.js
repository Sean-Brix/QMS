/* ============================================================================
   requests.js — Document Review / Change Notice (DRCN) rules.
   ----------------------------------------------------------------------------
   The maximum review time comes from the table printed on form F-DCC-001 and
   held in settings.document.drcnReviewLimits. The form says "days" without
   saying which kind; they are counted as working days here, like the CAR reply
   period, until the client confirms (follow-up B6).
   ========================================================================== */

import { DOCUMENT_RULES } from '@/config/appConfig'
import { REQUEST_QMS_QUEUE_STATUSES } from '@/config/constants'
import { addWorkingDays, isPast, isoDate } from './format'

const withinRange = (count, range) => !range || (count >= range[0] && (range[1] == null || count <= range[1]))

/** The DRCN row that sets a request's maximum review time, or null until level and process type are chosen. */
export function reviewLimitFor({ processType, level, documentCount = 1 }) {
  if (!processType || !level) return null
  return (
    DOCUMENT_RULES.drcnReviewLimits.find(
      (rule) =>
        rule.processType === processType &&
        rule.levels.includes(Number(level)) &&
        withinRange(documentCount, rule.documents),
    ) || null
  )
}

/** The date a decision is due, counted from the day QMS receives the endorsed request. */
export function reviewDueDateFor(request, receivedAt) {
  const rule = reviewLimitFor(request)
  return rule ? isoDate(addWorkingDays(receivedAt, rule.maxDays)) : null
}

/** Still waiting on a QMS Admin and past the limit. A request due today is not late yet. */
export function isReviewLate(request) {
  return (
    REQUEST_QMS_QUEUE_STATUSES.includes(request.status) &&
    Boolean(request.reviewDueDate) &&
    isPast(request.reviewDueDate)
  )
}

export function limitText(rule) {
  return rule ? `${rule.maxDays} working day${rule.maxDays === 1 ? '' : 's'}` : '—'
}

/** How a request is named in the activity log. */
export function requestLabel(request) {
  return `${request.controlNo} ${request.type} ${request.documentCode}`
}
