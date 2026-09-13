/* ============================================================================
   DataContext — in-memory store seeded from the JSON database.
   ----------------------------------------------------------------------------
   Holds every table, exposes lookups + derived selectors, and provides the
   mutations the prototype needs. Writes stay in memory (the JSON files are the
   seed, not a persistence layer).

   Two kinds of people exist. Accounts (users.json) sign in: individual QMS
   Admins, one shared account per department, and Dev. Personnel
   (personnel.json) do not sign in; each department keeps its own list and they
   are the names recorded on CARs and requests.
   ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CAR_RULES, DOCUMENT_RULES, applySettings, seedSettings } from '@/config/appConfig'
import {
  ACCOUNT_STATUS,
  CAR_SEQUENCE_RESET,
  DOC_STATUS,
  NOTIFICATION_TYPE,
  ORG_WIDE_ROLES,
  PERSONNEL_STATUS,
  REQUEST_OPEN_STATUSES,
  REQUEST_STATUS,
  REQUEST_TYPE,
  ROLE,
  identityLabel,
} from '@/config/constants'
import { loadDatabase } from '@/data/db'
import { withDeadline } from '@/utils/cars'
import { TODAY, daysBetween, formatDate, isoDate, timestamp } from '@/utils/format'
import { emailRecipientsFor } from '@/utils/notifications'
import { isReviewLate } from '@/utils/requests'
import { DataContext } from './contexts'

let sequence = 1000
const nextId = (prefix) => `${prefix}-${++sequence}`

function nowStamp() {
  const stamp = timestamp()
  return { date: stamp.slice(0, 10), time: stamp.slice(11), timestamp: stamp }
}

/** The client's XXX-YY-ZZZ control number, which the seed uses. */
const DEFAULT_NUMBER_FORMAT = '{SRC}-{YY}-{ZZZ}'

/** Matches control numbers written in `format`, capturing source, year and sequence. */
function carNumberPattern(format) {
  const escaped = format.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(
    `^${escaped
      .replace('\\{SRC\\}', '(?<source>[A-Z]{3})')
      .replace('\\{YY\\}', '(?<year>\\d{2})')
      .replace('\\{ZZZ\\}', '(?<seq>\\d{3})')}$`,
  )
}

/* ---------------------------------------------------- due-date sweep (PRD 20)
   Overdue and due-soon are derived on read, so without a sweep the reminder
   notifications would never be raised — a CAR would silently turn red in the
   register and no one would be told. A real deployment runs this nightly; the
   prototype runs it when the store is seeded and again whenever settings are
   saved. It is idempotent: a reminder already on file is never repeated. */
function sweepReminders(prev) {
  const raised = []
  const stamp = nowStamp()

  /* A CAR has a deadline per stage, so a reminder is on file per stage too.
     Notifications seeded before stages existed were all about the reply. */
  const stageOf = (notification) =>
    notification.stage || (notification.recordType === 'car' ? 'reply' : null)
  const alreadyOnFile = (userId, type, recordId, stage) =>
    [...prev.notifications, ...raised].some(
      (n) => n.userId === userId && n.type === type && n.recordId === recordId && stageOf(n) === stage,
    )

  const raise = (userId, type, title, message, recordId, recordType = 'car', stage = null) => {
    if (!userId || alreadyOnFile(userId, type, recordId, stage)) return
    const notification = {
      id: nextId('NTF'),
      userId,
      type,
      title,
      message,
      recordType,
      recordId,
      stage,
      read: false,
      timestamp: stamp.timestamp,
    }
    raised.push({ ...notification, emailedTo: emailRecipientsFor(prev, notification) })
  }

  const qms = prev.users.filter((u) => u.role === ROLE.QMS && u.status === ACCOUNT_STATUS.ACTIVE)

  /* Whoever owns the current stage is reminded before its deadline and told
     when it passes; the QMS Admins hear about every overdue CAR. */
  for (const car of prev.cars.map((item) => withDeadline(item, prev.settings.car))) {
    const { deadline } = car
    if (!deadline?.date) continue

    const days = daysBetween(TODAY, deadline.date)
    const due = formatDate(deadline.date)
    const departmentOwns = deadline.owner === 'department'

    if (days < 0) {
      const late = Math.abs(days)
      const message = `${deadline.label} ${due} — passed ${late} day${late === 1 ? '' : 's'} ago.`
      if (departmentOwns) {
        raise(car.recipient.userId, NOTIFICATION_TYPE.CAR_OVERDUE, `${car.carNo} is overdue`, message, car.id, 'car', deadline.key)
      }
      for (const reviewer of qms) {
        raise(reviewer.id, NOTIFICATION_TYPE.CAR_OVERDUE, `${car.carNo} is overdue`, message, car.id, 'car', deadline.key)
      }
    } else if (days <= CAR_RULES.dueSoonReminderDays) {
      const when = days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`
      if (departmentOwns) {
        raise(
          car.recipient.userId,
          NOTIFICATION_TYPE.CAR_DUE_SOON,
          `${car.carNo} is due ${when}`,
          deadline.key === 'reply'
            ? `Submit the root cause analysis and action plan by ${due}.`
            : `Complete the corrective actions and record the implementation by ${due}.`,
          car.id,
          'car',
          deadline.key,
        )
      } else {
        for (const reviewer of qms) {
          raise(
            reviewer.id,
            NOTIFICATION_TYPE.CAR_CHECK_DUE,
            `${car.carNo}: ${deadline.label.toLowerCase()} ${when}`,
            `${deadline.label} ${due}.`,
            car.id,
            'car',
            deadline.key,
          )
        }
      }
    }
  }

  /* A document inside its review reminder window, or past its review date,
     is raised with the QMS Admins, who run the review, and with the owning
     department's account, which raises the revision request if one is
     needed. Keyed by review date, so the next review cycle reminds again. */
  for (const doc of prev.documents) {
    if (doc.status !== DOC_STATUS.ACTIVE || !doc.reviewDate) continue
    const days = daysBetween(TODAY, doc.reviewDate)
    if (days > DOCUMENT_RULES.reviewReminderDays) continue

    const when = days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`
    const title = days < 0 ? `${doc.code} is past its review date` : `${doc.code} is due for review ${when}`
    const message = `${doc.title} — review date ${formatDate(doc.reviewDate)}. Raise a revision request if the document needs to change.`
    const owner = prev.users.find(
      (u) => u.role === ROLE.DEPARTMENT && u.departmentId === doc.departmentId && u.status === ACCOUNT_STATUS.ACTIVE,
    )
    for (const account of owner ? [...qms, owner] : qms) {
      raise(account.id, NOTIFICATION_TYPE.DOCUMENT_REVIEW_DUE, title, message, doc.id, 'document', `review-${doc.reviewDate}`)
    }
  }

  /* A request past its DRCN review limit is flagged to every QMS Admin. The
     form calls for a CAR in that case; raising one stays a QMS decision. */
  for (const request of prev.documentRequests) {
    if (!isReviewLate(request)) continue
    for (const reviewer of qms) {
      raise(
        reviewer.id,
        NOTIFICATION_TYPE.DOC_REQUEST_LATE,
        `${request.controlNo} is past its review limit`,
        `The ${request.type.toLowerCase()} request for ${request.documentCode} needed a decision by ${formatDate(request.reviewDueDate)}.`,
        request.id,
        'request',
      )
    }
  }

  return raised.length ? { ...prev, notifications: [...raised, ...prev.notifications] } : prev
}

export function DataProvider({ children }) {
  /* Seeded notifications predate email mirroring, so who each one went to is
     worked out once here, the same way a live notification records it. */
  const [state, setState] = useState(() => {
    const db = loadDatabase()
    /* Settings load from the seed like every other table, and are put into
       effect before anything reads them. */
    const settings = seedSettings()
    applySettings(settings)
    return {
      ...db,
      settings,
      notifications: db.notifications.map((n) => (n.emailedTo ? n : { ...n, emailedTo: emailRecipientsFor(db, n) })),
    }
  })

  /* ------------------------------------------------------------- lookups */
  const index = useMemo(() => ({
    users: Object.fromEntries(state.users.map((u) => [u.id, u])),
    personnel: Object.fromEntries(state.personnel.map((p) => [p.id, p])),
    departments: Object.fromEntries(state.departments.map((d) => [d.id, d])),
    categories: Object.fromEntries(state.documentCategories.map((c) => [c.id, c])),
    sources: Object.fromEntries(state.carSources.map((s) => [s.code, s])),
    documents: Object.fromEntries(state.documents.map((d) => [d.id, d])),
  }), [state])

  const userById = useCallback((id) => index.users[id] || null, [index])
  const personnelById = useCallback((id) => index.personnel[id] || null, [index])
  /** An account or a personnel record — CAR fields hold either, depending on who signed. */
  const personById = useCallback((id) => index.users[id] || index.personnel[id] || null, [index])
  const userName = useCallback((id) => personById(id)?.fullName || '—', [personById])
  const deptById = useCallback((id) => index.departments[id] || null, [index])
  const deptName = useCallback((id) => index.departments[id]?.name || '—', [index])
  const categoryName = useCallback((id) => index.categories[id]?.name || '—', [index])
  const sourceById = useCallback((code) => index.sources[code] || null, [index])

  const identityFor = useCallback(
    (userOrId) => identityLabel(typeof userOrId === 'string' ? index.users[userOrId] : userOrId),
    [index],
  )

  /** A department's personnel, active members only unless asked otherwise. */
  const personnelForDepartment = useCallback(
    (departmentId, { includeInactive = false } = {}) =>
      state.personnel
        .filter((p) => p.departmentId === departmentId)
        .filter((p) => includeInactive || p.status === PERSONNEL_STATUS.ACTIVE)
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [state.personnel],
  )

  /**
   * The accounts a CAR for this department is delivered to. Every department
   * has one shared account; the QMS Department has no shared account, so its
   * CARs go to one of the individual QMS Admins instead.
   */
  const receivingAccounts = useCallback(
    (departmentId) =>
      state.users.filter(
        (u) => u.departmentId === departmentId && u.role !== ROLE.DEV && u.status === ACCOUNT_STATUS.ACTIVE,
      ),
    [state.users],
  )

  /** The department's shared account, whatever its state, unless it has been closed. */
  const departmentAccount = useCallback(
    (departmentId) =>
      state.users.find(
        (u) => u.role === ROLE.DEPARTMENT && u.departmentId === departmentId && u.status !== ACCOUNT_STATUS.ARCHIVED,
      ) || null,
    [state.users],
  )

  /* --------------------------------------------------- document requests */

  /** Requests an account may see: QMS Admins and Dev see all; a department sees
      the ones it raised and the ones about its own documents. Newest first. */
  const requestsForUser = useCallback((user) => {
    if (!user) return []
    const rows = ORG_WIDE_ROLES.includes(user.role)
      ? state.documentRequests
      : state.documentRequests.filter(
          (r) => r.originator.accountId === user.id || r.departmentId === user.departmentId,
        )
    return [...rows].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
  }, [state.documentRequests])

  const requestForUser = useCallback(
    (user, requestId) => requestsForUser(user).find((r) => r.id === requestId) || null,
    [requestsForUser],
  )

  /** The undecided request already raised against a document. Only one may be open at a time. */
  const openRequestForDocument = useCallback(
    (documentId) =>
      state.documentRequests.find((r) => r.documentId === documentId && REQUEST_OPEN_STATUSES.includes(r.status)) ||
      null,
    [state.documentRequests],
  )

  /* ---------------------------------------------------------- derived CARs */
  /* The system flags a CAR as overdue from its due dates (PRD 13). Rather than
     storing that, the deadline of the current stage and the overdue flag are
     derived on read, so the register is always truthful. */
  const cars = useMemo(
    () => state.cars.map((car) => withDeadline(car, state.settings.car)),
    [state.cars, state.settings.car],
  )

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

  /* ------------------------------------------------ document visibility */

  /** Documents an account may open. QMS Admins and Dev see every status; anyone
      else sees ACTIVE documents only, because obsolete ones are archived and kept
      from other users (Document Control & CAR Overview). */
  const documentsForUser = useCallback((user) => {
    if (!user) return []
    return ORG_WIDE_ROLES.includes(user.role)
      ? state.documents
      : state.documents.filter((d) => d.status === DOC_STATUS.ACTIVE)
  }, [state.documents])

  const documentForUser = useCallback(
    (user, documentId) => documentsForUser(user).find((d) => d.id === documentId) || null,
    [documentsForUser],
  )

  /** A document's revisions an account may see: every one for QMS Admins and Dev,
      only the ACTIVE one for anyone else — earlier revisions are obsolete. */
  const revisionsForUser = useCallback((user, documentId) => {
    const rows = revisionsForDocument(documentId)
    return user && ORG_WIDE_ROLES.includes(user.role) ? rows : rows.filter((r) => r.status === DOC_STATUS.ACTIVE)
  }, [revisionsForDocument])

  /** CARs an account may see: QMS Admins and Dev see all, a department sees its own. */
  const carsForUser = useCallback((user) => {
    if (!user) return []
    if (ORG_WIDE_ROLES.includes(user.role)) return cars
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
    () => state.users.filter((u) => u.role === ROLE.QMS && u.status === ACCOUNT_STATUS.ACTIVE),
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

  /**
   * `personnelId` names who actually did the work when the actor is a shared
   * department account, so the trail records both the account and the person.
   */
  const log = useCallback((actor, action, module, record = {}, details = '', personnelId = null) => {
    if (!actor) return
    const stamp = nowStamp()
    setState((prev) => ({
      ...prev,
      activityLogs: [
        {
          id: nextId('LOG'),
          userId: actor.id,
          personnelId,
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
    const id = nextId('NTF')
    /* Resolved inside the update, so a record written just before — the CAR
       being issued, the request being approved — is already in `prev`. */
    setState((prev) => {
      const notification = {
        id,
        userId,
        type,
        title,
        message,
        recordType: record.type || null,
        recordId: record.id || null,
        read: false,
        timestamp: stamp.timestamp,
      }
      return {
        ...prev,
        notifications: [{ ...notification, emailedTo: emailRecipientsFor(prev, notification) }, ...prev.notifications],
      }
    })
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

  /** A new revision becomes ACTIVE and the one it replaces becomes OBSOLETE (Confirmed #23). */
  const addRevision = useCallback((revision) => {
    setState((prev) => ({
      ...prev,
      documentRevisions: [
        revision,
        ...prev.documentRevisions.map((r) =>
          r.documentId === revision.documentId && r.status === DOC_STATUS.ACTIVE
            ? { ...r, status: DOC_STATUS.OBSOLETE }
            : r,
        ),
      ],
    }))
  }, [])

  const addUser = useCallback((account) => {
    setState((prev) => ({ ...prev, users: [...prev.users, account] }))
  }, [])

  const patchUser = useCallback((userId, patch) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === userId ? { ...u, ...patch } : u)),
    }))
  }, [])

  const addPersonnel = useCallback((member) => {
    setState((prev) => ({ ...prev, personnel: [...prev.personnel, member] }))
  }, [])

  const patchPersonnel = useCallback((personnelId, patch) => {
    setState((prev) => ({
      ...prev,
      personnel: prev.personnel.map((p) => (p.id === personnelId ? { ...p, ...patch } : p)),
    }))
  }, [])

  /* ------------------------------------------------ master lists (Settings) */

  const addCategory = useCallback((category) => {
    setState((prev) => ({ ...prev, documentCategories: [...prev.documentCategories, category] }))
  }, [])

  const patchCategory = useCallback((categoryId, patch) => {
    setState((prev) => ({
      ...prev,
      documentCategories: prev.documentCategories.map((c) => (c.id === categoryId ? { ...c, ...patch } : c)),
    }))
  }, [])

  /** Only offered for a category no document or request has used. */
  const removeCategory = useCallback((categoryId) => {
    setState((prev) => ({ ...prev, documentCategories: prev.documentCategories.filter((c) => c.id !== categoryId) }))
  }, [])

  const addCarSource = useCallback((source) => {
    setState((prev) => ({ ...prev, carSources: [...prev.carSources, source] }))
  }, [])

  const patchCarSource = useCallback((code, patch) => {
    setState((prev) => ({
      ...prev,
      carSources: prev.carSources.map((s) => (s.code === code ? { ...s, ...patch } : s)),
    }))
  }, [])

  /** Only offered for a source no CAR has used. */
  const removeCarSource = useCallback((code) => {
    setState((prev) => ({ ...prev, carSources: prev.carSources.filter((s) => s.code !== code) }))
  }, [])

  /**
   * Saves System Settings and puts them into effect at once: the rule objects
   * every module reads are rewritten, the store re-renders with them, and the
   * due-date sweep runs again so a new reminder timing raises what it now calls for.
   */
  const saveSettings = useCallback((next) => {
    applySettings(next)
    setState((prev) => sweepReminders({ ...prev, settings: JSON.parse(JSON.stringify(next)) }))
  }, [])

  const addRequest = useCallback((request) => {
    setState((prev) => ({ ...prev, documentRequests: [request, ...prev.documentRequests] }))
  }, [])

  /** Patches a request and, when given, appends one step to its history in the same update. */
  const patchRequest = useCallback((requestId, patch, historyEntry) => {
    setState((prev) => ({
      ...prev,
      documentRequests: prev.documentRequests.map((r) =>
        r.id === requestId
          ? { ...r, ...patch, history: historyEntry ? [...(r.history || []), historyEntry] : r.history }
          : r,
      ),
    }))
  }, [])

  /**
   * Approves a request and applies it to the repository in one update, so the
   * request, the document and its revisions can never disagree. A new document
   * is published ACTIVE; a revision becomes ACTIVE and the revision it replaces
   * becomes OBSOLETE; an obsoletion archives the document. Nothing is deleted.
   */
  const publishRequest = useCallback((request, { actor, effectiveDate, approval, metadata = {} }) => {
    const stamp = timestamp()
    const isNew = request.type === REQUEST_TYPE.NEW
    const isObsolete = request.type === REQUEST_TYPE.OBSOLETE
    const documentId = isNew ? nextId('DOC') : request.documentId
    const revisionId = nextId('REV')
    const revisionNo = isObsolete ? request.currentRevisionNo : metadata.revisionNo
    const extension = (request.fileName?.split('.').pop() || 'pdf').toLowerCase()
    const fileName = `${request.documentCode}_rev${revisionNo}.${extension}`
    const restoring = request.restoresRevisionId ? ` from the file of revision ${metadata.restoresRevisionNo}` : ''
    const disposition = isObsolete
      ? 'Marked obsolete and archived'
      : isNew
        ? `Published as ACTIVE at revision ${revisionNo}`
        : `Revision ${revisionNo} released as ACTIVE${restoring}; revision ${request.currentRevisionNo} made obsolete`

    setState((prev) => {
      const retire = (r) =>
        r.documentId === documentId && r.status === DOC_STATUS.ACTIVE ? { ...r, status: DOC_STATUS.OBSOLETE } : r

      let documents
      let documentRevisions
      if (isObsolete) {
        documents = prev.documents.map((d) =>
          d.id === documentId ? { ...d, status: DOC_STATUS.OBSOLETE, lastRequestId: request.id } : d,
        )
        documentRevisions = prev.documentRevisions.map(retire)
      } else {
        const fields = {
          title: metadata.title,
          categoryId: metadata.categoryId,
          level: Number(metadata.level),
          departmentId: metadata.departmentId,
          revisionNo,
          effectiveDate,
          reviewDate: metadata.reviewDate,
          status: DOC_STATUS.ACTIVE,
          retentionPeriod: metadata.retentionPeriod,
          fileName,
          fileType: extension.toUpperCase(),
          watermark: metadata.watermark,
          watermarkTemplateId: metadata.watermark ? metadata.watermarkTemplateId || null : null,
          description: metadata.description,
          lastRequestId: request.id,
        }
        documents = isNew
          ? [
              {
                id: documentId,
                code: request.documentCode,
                ...fields,
                uploadedBy: request.originator.accountId,
                uploadDate: stamp,
                lastRevisionBy: null,
                lastRevisionDate: null,
                fileSize: '—',
                pages: 0,
                downloads: 0,
                views: 0,
              },
              ...prev.documents,
            ]
          : prev.documents.map((d) =>
              d.id === documentId
                ? { ...d, ...fields, lastRevisionBy: request.originator.accountId, lastRevisionDate: stamp }
                : d,
            )
        documentRevisions = [
          {
            id: revisionId,
            documentId,
            revisionNo,
            effectiveDate,
            revisedBy: request.originator.accountId,
            revisionDate: stamp,
            changeSummary: request.reason,
            status: DOC_STATUS.ACTIVE,
            fileName,
            requestId: request.id,
            restoredFrom: request.restoresRevisionId || null,
          },
          ...prev.documentRevisions.map(retire),
        ]
      }

      const documentRequests = prev.documentRequests.map((r) =>
        r.id === request.id
          ? {
              ...r,
              status: REQUEST_STATUS.APPROVED,
              documentId,
              approval: {
                decision: 'Approved',
                approvedBy: actor.id,
                signatory: approval.signatory,
                position: approval.position,
                remarks: approval.remarks,
                date: isoDate(TODAY),
              },
              dcc: { disposition, effectiveDate },
              history: [
                ...(r.history || []),
                { at: stamp, action: 'Approved', by: actor.id, personnelId: null, notes: approval.remarks },
              ],
            }
          : r,
      )

      return { ...prev, documents, documentRevisions, documentRequests }
    })

    return { documentId, disposition }
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

  /* The due-date sweep: once when the store is seeded, and on every settings save. */
  const swept = useRef(false)
  useEffect(() => {
    if (swept.current) return
    swept.current = true
    setState(sweepReminders)
  }, [])

  /**
   * Next CAR control number, XXX-YY-ZZZ (Document Control & CAR Overview):
   * source code, two-digit year, three-digit sequence.
   *
   * The sequence is the highest one already issued in the same bucket plus one —
   * not a row count, which would hand out a number twice as soon as a CAR is
   * removed. What counts as the same bucket follows the reset rule in settings,
   * which the client has yet to confirm (follow-up D3).
   */
  const nextCarNumber = useCallback((source, rules = state.settings.car) => {
    const year = String(TODAY.getFullYear()).slice(-2)
    /* Numbers issued before a format change still count towards the sequence. */
    const patterns = [carNumberPattern(rules.numberFormat), carNumberPattern(DEFAULT_NUMBER_FORMAT)]
    const highest = state.cars.reduce((max, car) => {
      const match = patterns.map((pattern) => pattern.exec(car.carNo)).find(Boolean)
      if (!match) return max
      const { source: carSource, year: carYear, seq } = match.groups
      if (rules.sequenceReset !== CAR_SEQUENCE_RESET.CONTINUOUS && carYear !== year) return max
      if (rules.sequenceReset === CAR_SEQUENCE_RESET.SOURCE_YEAR && carSource !== source) return max
      return Math.max(max, Number(seq))
    }, 0)
    return rules.numberFormat
      .replace('{SRC}', source)
      .replace('{YY}', year)
      .replace('{ZZZ}', String(highest + 1).padStart(3, '0'))
  }, [state.cars, state.settings.car])

  /** Next DRCN control number, DRCN-YY-NNN, restarting each year. */
  const nextRequestNumber = useCallback(() => {
    const year = String(TODAY.getFullYear()).slice(-2)
    const highest = state.documentRequests.reduce((max, r) => {
      const match = /^DRCN-(\d{2})-(\d{3})$/.exec(r.controlNo)
      return match && match[1] === year ? Math.max(max, Number(match[2])) : max
    }, 0)
    return `DRCN-${year}-${String(highest + 1).padStart(3, '0')}`
  }, [state.documentRequests])

  const value = useMemo(() => ({
    ...state,
    cars,
    activityLogs,
    // lookups
    userById, personnelById, personById, userName, deptById, deptName, categoryName, sourceById, identityFor,
    personnelForDepartment, receivingAccounts, departmentAccount,
    requestsForUser, requestForUser, openRequestForDocument,
    documentsForUser, documentForUser, revisionsForUser,
    carById, carForUser, attachmentsForCar, revisionsForDocument, carsForUser, notificationsForUser,
    qmsUsers,
    documentById: (id) => index.documents[id] || null,
    // writers
    log, notify, patchCar, addCar, addAttachment,
    patchDocument, addDocument, addRevision,
    addUser, patchUser, addPersonnel, patchPersonnel,
    addCategory, patchCategory, removeCategory, addCarSource, patchCarSource, removeCarSource, saveSettings,
    addRequest, patchRequest, publishRequest,
    markNotificationRead, markAllNotificationsRead,
    nextCarNumber, nextRequestNumber,
    // misc
    daysUntilDue: (date) => daysBetween(TODAY, date),
    docStatuses: DOC_STATUS,
  }), [
    state, cars, activityLogs, index,
    userById, personnelById, personById, userName, deptById, deptName, categoryName, sourceById, identityFor,
    personnelForDepartment, receivingAccounts, departmentAccount,
    requestsForUser, requestForUser, openRequestForDocument,
    documentsForUser, documentForUser, revisionsForUser,
    carById, carForUser, attachmentsForCar, revisionsForDocument, carsForUser, notificationsForUser,
    qmsUsers,
    log, notify, patchCar, addCar, addAttachment,
    patchDocument, addDocument, addRevision,
    addUser, patchUser, addPersonnel, patchPersonnel,
    addCategory, patchCategory, removeCategory, addCarSource, patchCarSource, removeCarSource, saveSettings,
    addRequest, patchRequest, publishRequest,
    markNotificationRead, markAllNotificationsRead, nextCarNumber, nextRequestNumber,
  ])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
