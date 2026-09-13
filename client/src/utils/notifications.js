/* ============================================================================
   notifications.js — who a notification is emailed to.
   ----------------------------------------------------------------------------
   Every notification lands in an account's notification centre and is mirrored
   by email (Confirmed Requirements #11). A QMS Admin or Dev account is one
   person, so the email goes to that account's address. A department account is
   shared, so the email goes to the person on the record it is about — the
   responsible person on a CAR, the originator of a document request — and to
   the department's own address only when the record names nobody.

   Sending is simulated in this prototype; the addresses are recorded on the
   notification so the notification centre can say where each one went.
   ========================================================================== */

import { NOTIFICATION_RULES } from '@/config/appConfig'
import { ORG_WIDE_ROLES } from '@/config/constants'

/**
 * @param state         the store: `users`, `personnel`, `cars`, `documentRequests`
 * @param notification  `{ userId, recordType, recordId }`
 * @returns `[{ name, email }]` — empty when email notifications are switched off
 */
export function emailRecipientsFor(state, notification) {
  if (!NOTIFICATION_RULES.email) return []

  const account = state.users.find((u) => u.id === notification.userId)
  if (!account) return []
  const accountAddress = account.email ? [{ name: account.fullName, email: account.email }] : []
  if (ORG_WIDE_ROLES.includes(account.role)) return accountAddress

  let personnelId = null
  if (notification.recordType === 'car') {
    const car = state.cars.find((c) => c.id === notification.recordId)
    if (car) {
      const receives = car.recipient.userId === account.id || car.recipient.departmentId === account.departmentId
      personnelId = receives ? car.recipient.personnelId : car.initiator.personnelId
    }
  } else if (notification.recordType === 'request') {
    const request = state.documentRequests.find((r) => r.id === notification.recordId)
    if (request) {
      personnelId =
        request.originator.accountId === account.id ? request.originator.personnelId : request.reviewer?.personnelId
    }
  }

  /* Only someone from this account's own department: a revision raised by the
     QMS Department names a QMS reviewer, who is not Production's contact. */
  const person = personnelId && state.personnel.find((p) => p.id === personnelId)
  return person?.email && person.departmentId === account.departmentId
    ? [{ name: person.fullName, email: person.email }]
    : accountAddress
}
