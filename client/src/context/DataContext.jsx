/* ============================================================================
   DataContext — in-memory store seeded from the JSON database.
   ----------------------------------------------------------------------------
   Holds every table, exposes lookups + derived selectors, and provides the
   mutations the prototype needs. Writes stay in memory (the JSON files are the
   seed, not a persistence layer).
   ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CAR_RULES } from '@/config/appConfig'
import {
  CAR_STATUS,
  CAR_OPEN_STATUSES,
  DOC_STATUS,
  NOTIFICATION_TYPE,
  identityLabel,
} from '@/config/constants'
import { loadDatabase } from '@/data/db'
import { TODAY, daysBetween, formatDate, isPast } from '@/utils/format'
import { DataContext } from './contexts'

let sequence = 1000
const nextId = (prefix) => `${prefix}-${++sequence}`

function nowStamp() {
  const d = TODAY
  const pad = (n) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    timestamp: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  }
}

/**
 * The system flags a CAR as Overdue from its due date (PRD 13). Rather than
 * storing that, it is derived on read so the register is always truthful.
 */
function withDerivedStatus(car) {
  const overdue =
    CAR_RULES.autoFlagOverdue &&
    CAR_OPEN_STATUSES.includes(car.status) &&
    car.status !== CAR_STATUS.OVERDUE &&
    !car.recipient.dateSubmitted &&
    isPast(car.initiator.replyDueDate)
  return overdue ? { ...car, status: CAR_STATUS.OVERDUE, autoFlagged: true } : car
}

export function DataProvider({ children }) {
  const [state, setState] = useState(() => loadDatabase())

  /* ------------------------------------------------------------- lookups */
  const index = useMemo(() => ({
    users: Object.fromEntries(state.users.map((u) => [u.id, u])),
    departments: Object.fromEntries(state.departments.map((d) => [d.id, d])),
    categories: Object.fromEntries(state.documentCategories.map((c) => [c.id, c])),
    sources: Object.fromEntries(state.carSources.map((s) => [s.code, s])),
    documents: Object.fromEntries(state.documents.map((d) => [d.id, d])),
  }), [state])

  const userById = useCallback((id) => index.users[id] || null, [index])
  const userName = useCallback((id) => index.users[id]?.fullName || '—', [index])
  const deptById = useCallback((id) => index.departments[id] || null, [index])
  const deptName = useCallback((id) => index.departments[id]?.name || '—', [index])
  const categoryName = useCallback((id) => index.categories[id]?.name || '—', [index])
  const sourceById = useCallback((code) => index.sources[code] || null, [index])

  /** How a person is labelled in the UI: QMS staff by role, everyone else by
      their own department, which is more informative than a generic role name. */
  const identityFor = useCallback(
    (userOrId) => identityLabel(
      typeof userOrId === 'string' ? index.users[userOrId] : userOrId,
      (id) => index.departments[id]?.name,
    ),
    [index],
  )

  /* ---------------------------------------------------------- derived CARs */
  const cars = useMemo(() => state.cars.map(withDerivedStatus), [state.cars])

  const carById = useCallback((id) => cars.find((c) => c.id === id) || null, [cars])

  const attachmentsForCar = useCallback(
    (carId) => state.carAttachments.filter((a) => a.carId === carId),
    [state.carAttachments],
  )

  const revisionsForDocument = useCallback(
    (documentId) => state.documentRevisions
      .filter((r) => r.documentId === documentId)
      .sort((a, b) => String(b.revisionNo).localeCompare(String(a.revisionNo), undefined, { numeric: true })),
    [state.documentRevisions],
  )

  /** CARs a given user is allowed to see: QMS sees all, others see their own. */
  const carsForUser = useCallback((user) => {
    if (!user) return []
    if (user.role === 'qms') return cars
    return cars.filter(
      (c) =>
        c.recipient.userId === user.id ||
        c.initiator.userId === user.id ||
        c.recipient.departmentId === user.departmentId ||
        c.initiator.departmentId === user.departmentId,
    )
  }, [cars])

  /** The scoped read used by the CAR detail page: a CAR nobody has routed to
      this user is invisible to them, whether they reach it from the register
      or by typing its URL. */
  const carForUser = useCallback(
    (user, carId) => carsForUser(user).find((c) => c.id === carId) || null,
    [carsForUser],
  )

  /** Everyone who reviews, verifies and closes CARs. */
  const qmsUsers = useMemo(
    () => state.users.filter((u) => u.role === 'qms' && u.status === 'Active'),
    [state.users],
  )

  const notificationsForUser = useCallback(
    (userId) => state.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [state.notifications],
  )

  const activityLogs = useMemo(
    () => [...state.activityLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [state.activityLogs],
  )

  /* -------------------------------------------------------------- writers */
  const log = useCallback((actor, action, module, record = {}, details = '') => {
    if (!actor) return
    const stamp = nowStamp()
    setState((prev) => ({
      ...prev,
      activityLogs: [
        {
          id: nextId('LOG'),
          userId: actor.id,
          role: actor.role,
          action,
          module,
          recordType: record.type || null,
          recordId: record.id || null,
          recordLabel: record.label || null,
          details,
          ...stamp,
        },
        ...prev.activityLogs,
      ],
    }))
  }, [])

  const notify = useCallback((userId, type, title, message, record = {}) => {
    if (!userId) return
    const stamp = nowStamp()
    setState((prev) => ({
      ...prev,
      notifications: [
        {
          id: nextId('NTF'),
          userId,
          type,
          title,
          message,
          recordType: record.type || null,
          recordId: record.id || null,
          read: false,
          timestamp: stamp.timestamp,
        },
        ...prev.notifications,
      ],
    }))
  }, [])

  const patchCar = useCallback((carId, patch) => {
    setState((prev) => ({
      ...prev,
      cars: prev.cars.map((c) => (c.id === carId ? { ...c, ...patch } : c)),
    }))
  }, [])

  const addCar = useCallback((car) => {
    setState((prev) => ({ ...prev, cars: [car, ...prev.cars] }))
  }, [])

  /** Writes the attachment row and keeps the CAR's own `attachments` list in
      step with it, so the two never drift apart. */
  const addAttachment = useCallback((attachment) => {
    setState((prev) => ({
      ...prev,
      carAttachments: [...prev.carAttachments, attachment],
      cars: prev.cars.map((c) =>
        c.id === attachment.carId
          ? { ...c, attachments: [...(c.attachments || []), attachment.id] }
          : c,
      ),
    }))
  }, [])

  const patchDocument = useCallback((documentId, patch) => {
    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((d) => (d.id === documentId ? { ...d, ...patch } : d)),
    }))
  }, [])

  const addDocument = useCallback((doc) => {
    setState((prev) => ({ ...prev, documents: [doc, ...prev.documents] }))
  }, [])

  const addRevision = useCallback((revision) => {
    setState((prev) => ({
      ...prev,
      documentRevisions: [
        revision,
        ...prev.documentRevisions.map((r) =>
          r.documentId === revision.documentId && r.status === 'ACTIVE'
            ? { ...r, status: 'SUPERSEDED' }
            : r,
        ),
      ],
    }))
  }, [])

  const patchUser = useCallback((userId, patch) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === userId ? { ...u, ...patch } : u)),
    }))
  }, [])

  const markNotificationRead = useCallback((id) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }))
  }, [])

  const markAllNotificationsRead = useCallback((userId) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)),
    }))
  }, [])

  /* ------------------------------------------------ due-date sweep (PRD 20)
     Overdue and due-soon are derived on read, so without a sweep the two
     reminder notifications the PRD promises would never be raised — the CAR
     would silently turn red in the register and no one would be told. A real
     deployment runs this nightly; the prototype runs it once, when the store
     is seeded. It is idempotent: a reminder already on file is never repeated. */
  const swept = useRef(false)
  useEffect(() => {
    if (swept.current) return
    swept.current = true

    setState((prev) => {
      const raised = []
      const stamp = nowStamp()

      const alreadyOnFile = (userId, type, carId) =>
        prev.notifications.some((n) => n.userId === userId && n.type === type && n.recordId === carId) ||
        raised.some((n) => n.userId === userId && n.type === type && n.recordId === carId)

      const raise = (userId, type, title, message, carId) => {
        if (!userId || alreadyOnFile(userId, type, carId)) return
        raised.push({
          id: nextId('NTF'),
          userId,
          type,
          title,
          message,
          recordType: 'car',
          recordId: carId,
          read: false,
          timestamp: stamp.timestamp,
        })
      }

      const qms = prev.users.filter((u) => u.role === 'qms' && u.status === 'Active')

      for (const car of prev.cars.map(withDerivedStatus)) {
        if (car.recipient.dateSubmitted) continue
        if (!CAR_OPEN_STATUSES.includes(car.status)) continue

        const days = daysBetween(TODAY, car.initiator.replyDueDate)
        const due = formatDate(car.initiator.replyDueDate)

        if (days < 0) {
          const late = Math.abs(days)
          const ago = `${late} day${late === 1 ? '' : 's'} ago`
          raise(
            car.recipient.userId,
            NOTIFICATION_TYPE.CAR_OVERDUE,
            `${car.carNo} is overdue`,
            `The reply due date of ${due} passed ${ago} without a submitted response.`,
            car.id,
          )
          for (const reviewer of qms) {
            raise(
              reviewer.id,
              NOTIFICATION_TYPE.CAR_OVERDUE,
              `${car.carNo} is overdue`,
              `No response ${ago}; the reply was due ${due}.`,
              car.id,
            )
          }
        } else if (days <= CAR_RULES.dueSoonReminderDays) {
          raise(
            car.recipient.userId,
            NOTIFICATION_TYPE.CAR_DUE_SOON,
            `${car.carNo} is due ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}`,
            `Submit the root cause analysis and action plan by ${due}.`,
            car.id,
          )
        }
      }

      return raised.length ? { ...prev, notifications: [...raised, ...prev.notifications] } : prev
    })
  }, [])

  /**
   * Next CAR number following the configured format (PRD 11).
   *
   * The sequence is the highest one already issued this year plus one — not a
   * row count, which would hand out a number twice as soon as a CAR is removed
   * or a year-crossing number happens to contain the current year.
   */
  const nextCarNumber = useCallback(() => {
    const year = String(TODAY.getFullYear())
    const prefix = CAR_RULES.numberFormat.replace('{YYYY}', year).replace('{####}', '')
    const highest = cars.reduce((max, c) => {
      if (!c.carNo.startsWith(prefix)) return max
      const seq = Number(c.carNo.slice(prefix.length))
      return Number.isFinite(seq) && seq > max ? seq : max
    }, 0)
    return CAR_RULES.numberFormat
      .replace('{YYYY}', year)
      .replace('{####}', String(highest + 1).padStart(4, '0'))
  }, [cars])

  const value = useMemo(() => ({
    ...state,
    cars,
    activityLogs,
    // lookups
    userById, userName, deptById, deptName, categoryName, sourceById, identityFor,
    carById, carForUser, attachmentsForCar, revisionsForDocument, carsForUser, notificationsForUser,
    qmsUsers,
    documentById: (id) => index.documents[id] || null,
    // writers
    log, notify, patchCar, addCar, addAttachment,
    patchDocument, addDocument, addRevision, patchUser,
    markNotificationRead, markAllNotificationsRead,
    nextCarNumber,
    // misc
    daysUntilDue: (date) => daysBetween(TODAY, date),
    docStatuses: DOC_STATUS,
  }), [
    state, cars, activityLogs, index,
    userById, userName, deptById, deptName, categoryName, sourceById, identityFor,
    carById, carForUser, attachmentsForCar, revisionsForDocument, carsForUser, notificationsForUser,
    qmsUsers,
    log, notify, patchCar, addCar, addAttachment,
    patchDocument, addDocument, addRevision, patchUser,
    markNotificationRead, markAllNotificationsRead, nextCarNumber,
  ])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
