/* ============================================================================
   CAR Details (PRD 15 — refers to 10.1–10.10) and the CAR lifecycle
   ----------------------------------------------------------------------------
   Pending / For Revision   the department submits root cause and action plan
   Under Review             a QMS Admin accepts the plan or returns it
   Active                   the department carries it out, records implementation
   For Verification         QMS verifies the countermeasure (a day after target)
   For Effectiveness Check  QMS checks effectiveness (6 months / next internal audit)
   Closed                   effective, under extended monitoring, or re-issued
   Overdue is a flag on whichever of those deadlines has passed.
   ========================================================================== */

import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle,
  Clipboard,
  ClipboardCheck,
  Clock,
  Download01,
  Edit03,
  InfoCircle,
  Paperclip,
  Plus,
  Printer,
  RefreshCcw01,
  ReverseLeft,
  Shield01,
  Trash01,
} from '@untitledui/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  AppDialog,
  Avatar,
  Badge,
  Button,
  ButtonUtility,
  Callout,
  Card,
  ChoiceRow,
  FileTypeIcon,
  FileUpload,
  FormGrid,
  Input,
  KeyValue,
  NativeSelect,
  PageState,
  Section,
  StatusBadge,
  StatusTag,
  TextArea,
} from '@/components/ui'
import { CAR_RULES } from '@/config/appConfig'
import {
  CAR_FLAG,
  CAR_QMS_QUEUE_STATUSES,
  CAR_RESPONSE_STATUSES,
  CAR_STATUS,
  DISPOSITIONS,
  EFFECTIVENESS_RESULT,
  EFFECTIVENESS_RESULTS,
  NOTIFICATION_TYPE,
  PERMISSION,
  REISSUE_REASON_HINT,
} from '@/config/constants'
import { ROUTES, path } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import {
  BLANK_CLOSURE,
  BLANK_EFFECTIVENESS,
  addDays,
  addMonths,
  effectivenessDueDateFor,
  implementationDueDate,
  isFailedEffectiveness,
  latestTargetDate,
  reissueReasonsFor,
  verificationDueDateFor,
} from '@/utils/cars'
import {
  TODAY,
  addWorkingDays,
  daysBetween,
  formatDate,
  formatDateTime,
  initials,
  isoDate,
  relativeDays,
  timestamp,
} from '@/utils/format'
import CarWorkflow from './CarWorkflow'

const iso = isoDate
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

/** What each effectiveness result does to the CAR. */
const RESULT_EFFECT = {
  [EFFECTIVENESS_RESULT.PASS]: 'The corrective action held. The CAR is closed.',
  [EFFECTIVENESS_RESULT.MONITORING]:
    'The CAR is closed but stays under extended monitoring until a later check confirms the action held.',
  [EFFECTIVENESS_RESULT.FURTHER_ACTION]:
    'The CAR goes back to implementation for the further action, then through verification and this check again.',
  [EFFECTIVENESS_RESULT.FAIL]: 'The CAR is closed as not effective, and you continue straight to re-issuing it.',
}

const MONITORING_OUTCOME = {
  END: 'The action held — end monitoring',
  CONTINUE: 'Keep monitoring',
}

/** The revised reply deadline a CAR gets when it is sent back for rework: a fresh reply period. */
function revisedDueDate() {
  return iso(addWorkingDays(TODAY, CAR_RULES.replyDueWorkingDays))
}

let actionSequence = 0

/** An empty row for the response form. */
function blankAction(responsibleId = '') {
  actionSequence += 1
  return { id: `ACT-NEW-${actionSequence}`, action: '', responsibleId, targetDate: '' }
}

/** A person block: avatar, name, position and department. */
function PersonCard({ label, person, name, department }) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-tertiary">{label}</p>
      <div className="flex items-center gap-3">
        <Avatar size="lg" src={person?.avatarUrl} initials={initials(name)} alt={name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-primary">{name}</p>
          <p className="truncate text-sm text-tertiary">{person?.position}</p>
          <p className="truncate text-sm text-tertiary">{department}</p>
        </div>
      </div>
    </div>
  )
}

/** A narrative section body, with the "not yet provided" state built in. */
function Narrative({ text, meta, emptyText }) {
  if (!text) {
    return <PageState icon={Edit03} size="sm" title="Not yet provided" text={emptyText} />
  }
  return (
    <>
      <p className="text-sm leading-relaxed text-secondary">{text}</p>
      {meta && <KeyValue className="mt-4" items={meta} />}
    </>
  )
}

/** The actions of one kind, each with its own responsible person and target date. */
function ActionList({ items, nameOf, emptyText }) {
  if (!items.length) return <PageState icon={Edit03} size="sm" title="Not yet provided" text={emptyText} />
  return (
    <ol className="flex flex-col gap-4">
      {items.map((item, index) => (
        <li key={item.id} className="flex gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed text-secondary">{item.action}</p>
            <p className="mt-1 text-sm text-tertiary">
              {nameOf(item.responsibleId)} · target {formatDate(item.targetDate)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Editable rows of actions in the response form. */
function ActionListEditor({ title, hint, items, onChange, options, required, addLabel, responsibleDefault }) {
  const update = (index, patch) =>
    onChange(items.map((item, position) => (position === index ? { ...item, ...patch } : item)))
  const canRemove = !required || items.length > 1

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-primary">
          {title}
          {required && <span className="text-brand-tertiary"> *</span>}
        </p>
        <p className="text-sm text-tertiary">{hint}</p>
      </div>

      {items.map((item, index) => (
        <div key={item.id} className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-secondary">
          <div className="flex items-start gap-2">
            <TextArea
              className="flex-1"
              label={`Action ${index + 1}`}
              rows={2}
              value={item.action}
              onChange={(value) => update(index, { action: value })}
            />
            {canRemove && (
              <ButtonUtility
                size="sm"
                color="tertiary"
                tooltip="Remove this action"
                icon={Trash01}
                className="mt-6"
                onClick={() => onChange(items.filter((_, position) => position !== index))}
              />
            )}
          </div>
          <FormGrid>
            <NativeSelect
              label="Responsible person"
              value={item.responsibleId}
              onChange={(event) => update(index, { responsibleId: event.target.value })}
              options={options}
            />
            <Input
              label="Target / close-out date"
              type="date"
              value={item.targetDate}
              onChange={(value) => update(index, { targetDate: value })}
            />
          </FormGrid>
        </div>
      ))}

      <Button
        color="link-color"
        size="sm"
        iconLeading={Plus}
        className="self-start"
        onClick={() => onChange([...items, blankAction(responsibleDefault)])}
      >
        {addLabel}
      </Button>
    </div>
  )
}

export default function CarDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, can, isQms } = useAuth()
  const {
    carForUser,
    carById,
    attachmentsForCar,
    userById,
    personById,
    personnelForDepartment,
    userName,
    deptName,
    sourceById,
    patchCar,
    log,
    notify,
    addAttachment,
    qmsUsers,
  } = useData()

  /* Scoped on purpose: a CAR that is none of this user's business is invisible
     whether they arrive from the register or type the URL. */
  const car = carForUser(user, id)
  const [dialog, setDialog] = useState(null)
  const [response, setResponse] = useState({
    preparedBy: '',
    rootCause: '',
    immediateActions: [],
    correctiveActions: [],
    comments: '',
  })
  const [reviewNote, setReviewNote] = useState('')
  const [implementation, setImplementation] = useState({ recordedBy: '', details: '', completedOn: '' })
  const [verify, setVerify] = useState({ notes: '', approvedBy: '', disposition: 'CLOSED', implementationDueDate: '' })
  const [effectiveness, setEffectiveness] = useState({
    notes: '',
    approvedBy: '',
    result: EFFECTIVENESS_RESULT.PASS,
    nextCheckDate: '',
    implementationDueDate: '',
  })
  const [monitoring, setMonitoring] = useState({ notes: '', outcome: MONITORING_OUTCOME.END, nextCheckDate: '' })
  const [reissueReason, setReissueReason] = useState('')

  if (!car) {
    return (
      <Page>
        <PageState
          icon={Clipboard}
          title="CAR not found"
          text="This Corrective Action Report does not exist or is outside your access."
          action={
            <Button color="secondary" onClick={() => navigate(ROUTES.cars)}>
              Back to register
            </Button>
          }
        />
      </Page>
    )
  }

  const source = sourceById(car.source)
  /* The named person where one was recorded, otherwise the account itself. */
  const recipientId = car.recipient.personnelId || car.recipient.userId
  const initiatorId = car.initiator.personnelId || car.initiator.userId
  const recipient = personById(recipientId)
  const initiator = personById(initiatorId)
  const recipientAccount = userById(car.recipient.userId)
  const initiatorAccount = userById(car.initiator.userId)
  const responders = personnelForDepartment(car.recipient.departmentId)
  const responderOptions = [
    { value: '', label: responders.length ? 'Select person…' : 'No active personnel listed' },
    ...responders.map((person) => ({ value: person.id, label: `${person.fullName} — ${person.position}` })),
  ]
  const approverOptions = [
    { value: '', label: 'Select QMS Admin…' },
    ...qmsUsers
      .filter((admin) => admin.id !== user.id)
      .map((admin) => ({ value: admin.id, label: `${admin.fullName}${admin.position ? ` — ${admin.position}` : ''}` })),
  ]
  const attachments = attachmentsForCar(car.id)
  const record = { type: 'car', id: car.id, label: car.carNo }

  const { deadline } = car
  const daysToDeadline = deadline?.date ? daysBetween(TODAY, deadline.date) : null
  const latestTarget = latestTargetDate(car)
  const implementationDue = implementationDueDate(car)
  const revision = car.revision?.notes ? car.revision : null
  const failedEffectiveness = isFailedEffectiveness(car)

  /* Re-issue links, shown as a number even when the other CAR is outside this account's access. */
  const origin = car.reissuedFrom ? carForUser(user, car.reissuedFrom) : null
  const originNo = car.reissuedFrom ? carById(car.reissuedFrom)?.carNo : null
  const successor = car.reissuedAs ? carForUser(user, car.reissuedAs) : null
  const successorNo = car.reissuedAs ? carById(car.reissuedAs)?.carNo : null

  const isRecipient = user.id === car.recipient.userId || user.departmentId === car.recipient.departmentId

  /* Separation of duties (PRD 6): nobody assesses their own work. The account
     the CAR was delivered to wrote the response, so it cannot review, verify or
     close it, and the account that raised the finding cannot judge the answer. */
  const isResponder = user.id === car.recipient.userId
  const isInitiator = user.id === car.initiator.userId
  const isImpartial = !isResponder && !isInitiator

  const canRespond = can(PERMISSION.CAR_RESPOND) && isRecipient && CAR_RESPONSE_STATUSES.includes(car.status)
  const canImplement = can(PERMISSION.CAR_RESPOND) && isRecipient && car.status === CAR_STATUS.ACTIVE
  const canReview = can(PERMISSION.CAR_REVIEW) && isImpartial && car.status === CAR_STATUS.UNDER_REVIEW
  const canVerify = can(PERMISSION.CAR_VERIFY) && isImpartial && car.status === CAR_STATUS.FOR_VERIFICATION
  const canCheckEffectiveness =
    can(PERMISSION.CAR_CLOSE) && isImpartial && car.status === CAR_STATUS.FOR_EFFECTIVENESS
  const canCheckMonitoring =
    can(PERMISSION.CAR_CLOSE) && isImpartial && car.status === CAR_STATUS.CLOSED && Boolean(car.extendedMonitoring)
  const reissueReasons = can(PERMISSION.CAR_REVIEW) && !isResponder ? reissueReasonsFor(car) : []

  /* Shown instead of the action buttons when the only thing standing between
     this user and the CAR is that they are too close to it. */
  const blockedByDuties = !isImpartial && can(PERMISSION.CAR_REVIEW) && CAR_QMS_QUEUE_STATUSES.includes(car.status)

  const verificationEarly = Boolean(car.verificationDueDate) && daysBetween(TODAY, car.verificationDueDate) > 0
  const effectivenessEarly = Boolean(car.effectivenessDueDate) && daysBetween(TODAY, car.effectivenessDueDate) > 0

  /* --------------------------------------------------------------- response */
  const listedImmediate = response.immediateActions.filter((item) => item.action.trim() || item.targetDate)
  const isComplete = (item) => item.action.trim() && item.responsibleId && item.targetDate
  const responseReady =
    Boolean(response.preparedBy) &&
    (car.finding.ncType === 'OFI' || response.rootCause.trim()) &&
    response.correctiveActions.length > 0 &&
    response.correctiveActions.every(isComplete) &&
    listedImmediate.every(isComplete)

  const openResponse = () => {
    const fallback = car.recipient.personnelId || ''
    const editable = (list) =>
      list.map((item) => ({
        id: item.id,
        action: item.action,
        responsibleId: item.responsibleId || fallback,
        targetDate: item.targetDate || '',
      }))
    setResponse({
      preparedBy: car.rootCause.analyzedBy || fallback,
      rootCause: car.rootCause.explanation || '',
      immediateActions: car.immediateActions.length ? editable(car.immediateActions) : [blankAction(fallback)],
      correctiveActions: car.correctiveActions.length ? editable(car.correctiveActions) : [blankAction(fallback)],
      comments: car.comments || '',
    })
    setDialog('respond')
  }

  const signActions = (list) =>
    list.map((item) => ({
      id: item.id,
      action: item.action.trim(),
      responsibleId: item.responsibleId,
      targetDate: item.targetDate,
      signature: userName(item.responsibleId),
    }))

  const submitResponse = () => {
    /* A shared account signs with the names of the people who did the work. */
    const preparer = userName(response.preparedBy)
    patchCar(car.id, {
      status: CAR_STATUS.UNDER_REVIEW,
      recipient: { ...car.recipient, dateSubmitted: iso(TODAY), signature: preparer },
      rootCause: { explanation: response.rootCause.trim(), analyzedBy: response.preparedBy, date: iso(TODAY) },
      immediateActions: signActions(listedImmediate),
      correctiveActions: signActions(response.correctiveActions),
      comments: response.comments.trim(),
    })
    log(
      user,
      'Submitted CAR',
      'CAR',
      record,
      `Root cause and action plan prepared by ${preparer} and submitted to the QMS Department.`,
      response.preparedBy,
    )

    /* The review sits with the QMS Department, so that is who has to be told.
       The initiator is copied in because the finding was theirs. */
    for (const reviewer of qmsUsers) {
      if (reviewer.id === user.id) continue
      notify(
        reviewer.id,
        NOTIFICATION_TYPE.CAR_SUBMITTED,
        `${car.carNo} is awaiting your review`,
        `${preparer} (${user.fullName}) submitted the root cause analysis and action plan.`,
        { type: 'car', id: car.id },
      )
    }
    if (car.initiator.userId !== user.id && !qmsUsers.some((q) => q.id === car.initiator.userId)) {
      notify(
        car.initiator.userId,
        NOTIFICATION_TYPE.CAR_SUBMITTED,
        `${car.carNo} response submitted`,
        `${preparer} (${user.fullName}) submitted a response to the finding you raised. It is now with the QMS Department.`,
        { type: 'car', id: car.id },
      )
    }
    setDialog(null)
  }

  /* ------------------------------------------------------------- QMS review */
  const acceptReview = () => {
    patchCar(car.id, { status: CAR_STATUS.ACTIVE, planAccepted: { by: user.id, at: iso(TODAY) } })
    log(user, 'Reviewed CAR', 'CAR', record, `Action plan accepted; implementation due ${formatDate(latestTarget)}.`)
    notify(
      car.recipient.userId,
      NOTIFICATION_TYPE.CAR_ACCEPTED,
      `${car.carNo} action plan accepted`,
      `Carry out the corrective actions and record the implementation by ${formatDate(latestTarget)}.`,
      { type: 'car', id: car.id },
    )
    setDialog(null)
  }

  /**
   * Sends the CAR back for rework. The submitted response is kept in
   * previousResponses (follow-up E3), the reason gets its own record, and the
   * recipient gets a fresh deadline — without one the CAR would be judged
   * against a due date that has already passed.
   */
  const returnForRevision = () => {
    const dueDate = revisedDueDate()
    const notes = reviewNote.trim()
    patchCar(car.id, {
      status: CAR_STATUS.FOR_REVISION,
      recipient: { ...car.recipient, dateSubmitted: null, signature: null },
      initiator: { ...car.initiator, replyDueDate: dueDate },
      previousResponses: [
        ...(car.previousResponses || []),
        {
          submittedAt: car.recipient.dateSubmitted,
          preparedBy: car.rootCause.analyzedBy,
          rootCause: car.rootCause.explanation,
          immediateActions: car.immediateActions,
          correctiveActions: car.correctiveActions,
          comments: car.comments,
          returnedBy: user.id,
          returnedAt: iso(TODAY),
          notes,
        },
      ],
      revision: { notes, returnedBy: user.id, returnedAt: iso(TODAY), dueDate, stage: 'review' },
    })
    log(user, 'Returned for Revision', 'CAR', record, notes)
    notify(
      car.recipient.userId,
      NOTIFICATION_TYPE.CAR_RETURNED,
      `${car.carNo} returned for revision`,
      `${notes} A revised response is due ${formatDate(dueDate)}.`,
      { type: 'car', id: car.id },
    )
    setReviewNote('')
    setDialog(null)
  }

  /* --------------------------------------------------------- implementation */
  const openImplementation = () => {
    setImplementation({ recordedBy: car.recipient.personnelId || '', details: '', completedOn: iso(TODAY) })
    setDialog('implement')
  }

  const submitImplementation = () => {
    const verificationDue = verificationDueDateFor(car, implementation.completedOn)
    const recorder = userName(implementation.recordedBy)
    patchCar(car.id, {
      status: CAR_STATUS.FOR_VERIFICATION,
      implementation: {
        details: implementation.details.trim(),
        recordedBy: implementation.recordedBy,
        recordedAt: timestamp(),
        completedOn: implementation.completedOn,
      },
      verificationDueDate: verificationDue,
    })
    log(
      user,
      'Recorded Implementation',
      'CAR',
      record,
      `Implementation recorded by ${recorder}; verification due ${formatDate(verificationDue)}.`,
      implementation.recordedBy,
    )
    for (const reviewer of qmsUsers) {
      if (reviewer.id === user.id) continue
      notify(
        reviewer.id,
        NOTIFICATION_TYPE.CAR_IMPLEMENTED,
        `${car.carNo} is ready for verification`,
        `${recorder} (${user.fullName}) recorded the implementation. Verification is due ${formatDate(verificationDue)}.`,
        { type: 'car', id: car.id },
      )
    }
    setDialog(null)
  }

  /* ----------------------------------------------------------- verification */
  const openVerify = () => {
    setVerify({
      notes: '',
      approvedBy: approverOptions[1]?.value || '',
      disposition: 'CLOSED',
      implementationDueDate: addDays(TODAY, 14),
    })
    setDialog('verify')
  }

  const submitVerification = () => {
    const closure = {
      notes: verify.notes.trim(),
      verifiedBy: user.id,
      approvedBy: verify.approvedBy,
      verificationDate: iso(TODAY),
      disposition: verify.disposition,
    }

    if (verify.disposition === 'CLOSED') {
      const closeOut = iso(TODAY)
      const due = effectivenessDueDateFor(closeOut)
      patchCar(car.id, {
        status: CAR_STATUS.FOR_EFFECTIVENESS,
        verification: { ...car.verification, closure },
        closeOutDate: closeOut,
        effectivenessDueDate: due,
      })
      log(
        user,
        'Verified CAR',
        'CAR',
        record,
        `Countermeasure verified and closed out, approved by ${userName(verify.approvedBy)}; effectiveness check due ${formatDate(due)}.`,
      )
      notify(
        car.recipient.userId,
        NOTIFICATION_TYPE.CAR_VERIFIED,
        `${car.carNo} closed out`,
        `The countermeasure was verified as in place. Its effectiveness is checked by ${formatDate(due)}.`,
        { type: 'car', id: car.id },
      )
    } else {
      /* Flowchart: "Verification OK? No" goes back to CAR implementation. */
      patchCar(car.id, {
        status: CAR_STATUS.ACTIVE,
        verification: { ...car.verification, closure: BLANK_CLOSURE },
        implementation: null,
        verificationDueDate: null,
        implementationDueDate: verify.implementationDueDate,
        previousChecks: [
          ...(car.previousChecks || []),
          { stage: 'verification', closure, implementation: car.implementation },
        ],
      })
      log(
        user,
        'Verified CAR',
        'CAR',
        record,
        `Countermeasure not yet in place; returned to implementation, now due ${formatDate(verify.implementationDueDate)}.`,
      )
      notify(
        car.recipient.userId,
        NOTIFICATION_TYPE.CAR_RETURNED,
        `${car.carNo} returned to implementation`,
        `${closure.notes} Record the implementation again by ${formatDate(verify.implementationDueDate)}.`,
        { type: 'car', id: car.id },
      )
    }
    setDialog(null)
  }

  /* ---------------------------------------------------------- effectiveness */
  const openEffectiveness = () => {
    setEffectiveness({
      notes: '',
      approvedBy: approverOptions[1]?.value || '',
      result: EFFECTIVENESS_RESULT.PASS,
      nextCheckDate: addMonths(TODAY, CAR_RULES.extendedMonitoringMonths || 3),
      implementationDueDate: addDays(TODAY, 30),
    })
    setDialog('effectiveness')
  }

  const submitEffectiveness = () => {
    const today = iso(TODAY)
    const outcome = {
      notes: effectiveness.notes.trim(),
      validatedBy: user.id,
      approvedBy: effectiveness.approvedBy,
      result: effectiveness.result,
      date: today,
    }

    if (effectiveness.result === EFFECTIVENESS_RESULT.FURTHER_ACTION) {
      patchCar(car.id, {
        status: CAR_STATUS.ACTIVE,
        verification: { closure: BLANK_CLOSURE, effectiveness: BLANK_EFFECTIVENESS },
        implementation: null,
        verificationDueDate: null,
        closeOutDate: null,
        effectivenessDueDate: null,
        implementationDueDate: effectiveness.implementationDueDate,
        previousChecks: [
          ...(car.previousChecks || []),
          {
            stage: 'effectiveness',
            closure: car.verification.closure,
            effectiveness: outcome,
            implementation: car.implementation,
          },
        ],
      })
      log(
        user,
        'Recorded Effectiveness Check',
        'CAR',
        record,
        `Further action required; returned to implementation, now due ${formatDate(effectiveness.implementationDueDate)}.`,
      )
      notify(
        car.recipient.userId,
        NOTIFICATION_TYPE.CAR_RETURNED,
        `${car.carNo} needs further action`,
        `${outcome.notes} Carry out the further action and record it by ${formatDate(effectiveness.implementationDueDate)}.`,
        { type: 'car', id: car.id },
      )
      setDialog(null)
      return
    }

    const failed = effectiveness.result === EFFECTIVENESS_RESULT.FAIL
    const extended =
      effectiveness.result === EFFECTIVENESS_RESULT.MONITORING
        ? { since: today, nextCheckDate: effectiveness.nextCheckDate }
        : null
    patchCar(car.id, {
      status: CAR_STATUS.CLOSED,
      dateClosed: today,
      verification: { ...car.verification, effectiveness: outcome },
      extendedMonitoring: extended,
      closedReason: failed ? 'Failed effectiveness verification' : null,
    })
    log(
      user,
      'Closed CAR',
      'CAR',
      record,
      `Effectiveness result: ${effectiveness.result}${extended ? `; next monitoring check ${formatDate(extended.nextCheckDate)}` : ''}.`,
    )
    notify(
      car.recipient.userId,
      NOTIFICATION_TYPE.CAR_CLOSED,
      `${car.carNo} has been closed`,
      `Effectiveness result: ${effectiveness.result}.${failed ? ' The finding is being re-issued under a new CAR.' : ''}`,
      { type: 'car', id: car.id },
    )
    setDialog(null)
    if (failed) {
      navigate(`${ROUTES.carIssue}?reissue=${car.id}&reason=${encodeURIComponent('Failed effectiveness verification')}`)
    }
  }

  /* ------------------------------------------------------------- monitoring */
  const openMonitoring = () => {
    setMonitoring({
      notes: '',
      outcome: MONITORING_OUTCOME.END,
      nextCheckDate: addMonths(TODAY, CAR_RULES.extendedMonitoringMonths || 3),
    })
    setDialog('monitoring')
  }

  const submitMonitoring = () => {
    const continuing = monitoring.outcome === MONITORING_OUTCOME.CONTINUE
    patchCar(car.id, {
      extendedMonitoring: continuing ? { ...car.extendedMonitoring, nextCheckDate: monitoring.nextCheckDate } : null,
      previousChecks: [
        ...(car.previousChecks || []),
        {
          stage: 'monitoring',
          notes: monitoring.notes.trim(),
          by: user.id,
          date: iso(TODAY),
          continued: continuing,
          nextCheckDate: continuing ? monitoring.nextCheckDate : null,
        },
      ],
    })
    log(
      user,
      'Recorded Monitoring Check',
      'CAR',
      record,
      continuing
        ? `Monitoring continues; next check ${formatDate(monitoring.nextCheckDate)}.`
        : 'Extended monitoring ended; the corrective action held.',
    )
    setDialog(null)
  }

  /* --------------------------------------------------------------- re-issue */
  const openReissue = () => {
    setReissueReason(reissueReasons[0])
    setDialog('reissue')
  }

  const attachEvidence = () => {
    addAttachment({
      id: `ATT-${Date.now()}`,
      carId: car.id,
      fileName: `evidence_${Date.now()}.pdf`,
      fileType: 'PDF',
      fileSize: '—',
      uploadedBy: user.id,
      personnelId: null,
      uploadDate: timestamp(),
      category: 'Evidence',
      note: 'Uploaded from the CAR details page.',
    })
    setDialog(null)
  }

  const verifyReady =
    verify.notes.trim() && verify.approvedBy && (verify.disposition === 'CLOSED' || verify.implementationDueDate)
  const effectivenessReady =
    effectiveness.notes.trim() &&
    effectiveness.approvedBy &&
    (effectiveness.result !== EFFECTIVENESS_RESULT.MONITORING || effectiveness.nextCheckDate) &&
    (effectiveness.result !== EFFECTIVENESS_RESULT.FURTHER_ACTION || effectiveness.implementationDueDate)

  const glance = [
    { k: 'CAR number', v: car.carNo, mono: true },
    { k: 'Status', v: <StatusBadge status={car.status} /> },
    {
      k: 'Current deadline',
      v: deadline?.date
        ? `${deadline.label} ${formatDate(deadline.date)}`
        : car.status === CAR_STATUS.UNDER_REVIEW
          ? 'With QMS for review'
          : 'None at this stage',
    },
    { k: 'Date issued', v: formatDate(car.initiator.dateIssued) },
    { k: 'Reply due', v: formatDate(car.initiator.replyDueDate) },
    ...(car.planAccepted && implementationDue ? [{ k: 'Implementation due', v: formatDate(implementationDue) }] : []),
    ...(car.verificationDueDate ? [{ k: 'Verification due', v: formatDate(car.verificationDueDate) }] : []),
    ...(car.closeOutDate ? [{ k: 'Closed out', v: formatDate(car.closeOutDate) }] : []),
    ...(car.effectivenessDueDate ? [{ k: 'Effectiveness due', v: formatDate(car.effectivenessDueDate) }] : []),
    ...(car.dateClosed ? [{ k: 'Date closed', v: formatDate(car.dateClosed) }] : []),
  ]

  const earlierRounds = (car.previousResponses?.length || 0) + (car.previousChecks?.length || 0)

  return (
    <Page>
      <PageHeader
        title={car.carNo}
        subtitle={car.finding.deviation}
        actions={
          <>
            <Button color="secondary" size="md" iconLeading={ArrowLeft} onClick={() => navigate(ROUTES.cars)}>
              Back
            </Button>
            <Button color="secondary" size="md" iconLeading={Printer} onClick={() => window.print()}>
              Print
            </Button>
            {reissueReasons.length > 0 && (
              <Button color="secondary" size="md" iconLeading={RefreshCcw01} onClick={openReissue}>
                Re-issue CAR
              </Button>
            )}
            {canRespond && (
              <Button color="primary" size="md" iconLeading={Edit03} onClick={openResponse}>
                {car.status === CAR_STATUS.FOR_REVISION ? 'Revise response' : 'Submit response'}
              </Button>
            )}
            {canImplement && (
              <Button color="primary" size="md" iconLeading={ClipboardCheck} onClick={openImplementation}>
                Record implementation
              </Button>
            )}
            {canReview && (
              <>
                <Button color="secondary" size="md" iconLeading={ReverseLeft} onClick={() => setDialog('return')}>
                  Return for revision
                </Button>
                <Button color="primary" size="md" iconLeading={Check} onClick={() => setDialog('accept')}>
                  Accept action plan
                </Button>
              </>
            )}
            {canVerify && (
              <Button color="primary" size="md" iconLeading={Shield01} onClick={openVerify}>
                Verify countermeasure
              </Button>
            )}
            {canCheckEffectiveness && (
              <Button color="primary" size="md" iconLeading={CheckCircle} onClick={openEffectiveness}>
                Record effectiveness check
              </Button>
            )}
            {canCheckMonitoring && (
              <Button color="primary" size="md" iconLeading={Activity} onClick={openMonitoring}>
                Record monitoring check
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={car.status} size="md" />
          <StatusTag status={car.finding.ncType} />
          <Badge size="sm" color="gray" type="modern" className="font-mono">
            {car.source}
          </Badge>
          <Badge size="sm" color="gray" type="modern">
            {source?.name}
          </Badge>
          {car.finding.recurrenceCount > 0 && (
            <Badge size="sm" color="warning">
              Recurrence ×{car.finding.recurrenceCount}
            </Badge>
          )}
          {car.overdue && <StatusTag status={CAR_FLAG.OVERDUE} />}
          {car.extendedMonitoring && <StatusTag status={CAR_FLAG.MONITORING} />}
          {car.reissuedFrom && <StatusTag status={CAR_FLAG.REISSUE} label="Re-issue" />}
          {car.reissuedAs && <StatusTag status={CAR_FLAG.REISSUED} />}
        </div>
      </PageHeader>

      {/* ----------------------------------------------------- status callouts */}
      {car.overdue && deadline && (
        <Callout tone="error" icon={AlertTriangle} title={`${deadline.label} ${formatDate(deadline.date)} has passed`}>
          {plural(Math.abs(daysToDeadline), 'day')} late.{' '}
          {deadline.owner === 'department'
            ? `${deptName(car.recipient.departmentId)} and the QMS Admins have been notified.`
            : 'The QMS Admins have been notified.'}
        </Callout>
      )}

      {/* Tied to the revision record rather than to the status, so the reason a
          CAR came back stays on screen even once it has also run late. */}
      {revision && car.status === CAR_STATUS.FOR_REVISION && (
        <Callout tone="warning" icon={ReverseLeft} title="Returned for revision by the QMS Department">
          {revision.notes}
          <span className="mt-1 block text-sm">
            Returned by {userName(revision.returnedBy)} on {formatDate(revision.returnedAt)}
            {revision.dueDate ? ` · revised response due ${formatDate(revision.dueDate)}` : ''}.
          </span>
        </Callout>
      )}

      {car.reissuedFrom && (
        <Callout
          tone="brand"
          icon={RefreshCcw01}
          title={`Re-issue of ${originNo || 'an earlier CAR'}`}
          actions={
            origin && (
              <Link to={path.car(origin.id)} className="text-sm font-semibold hover:underline">
                Open {origin.carNo}
              </Link>
            )
          }
        >
          Reason: {car.finding.reasonForReissue || 'not recorded'}. This is recurrence {car.finding.recurrenceCount} of the
          finding.
        </Callout>
      )}

      {car.reissuedAs && (
        <Callout
          tone="gray"
          icon={RefreshCcw01}
          title={`Re-issued as ${successorNo || 'a new CAR'}`}
          actions={
            successor && (
              <Link to={path.car(successor.id)} className="text-sm font-semibold hover:underline">
                Open {successor.carNo}
              </Link>
            )
          }
        >
          {car.closedReason ? `${car.closedReason}.` : 'The finding continues under the new CAR.'}
        </Callout>
      )}

      {car.status === CAR_STATUS.CLOSED && failedEffectiveness && !car.reissuedAs && (
        <Callout
          tone="warning"
          icon={AlertTriangle}
          title="The corrective action was not effective"
          actions={
            reissueReasons.length > 0 && (
              <Button color="secondary" size="sm" onClick={openReissue}>
                Re-issue CAR
              </Button>
            )
          }
        >
          The effectiveness check failed, so this finding needs a re-issued CAR.
        </Callout>
      )}

      {car.extendedMonitoring && !car.overdue && (
        <Callout tone="warning" icon={Activity} title="Under extended monitoring">
          Closed on {formatDate(car.dateClosed)}; the next monitoring check is due{' '}
          {formatDate(car.extendedMonitoring.nextCheckDate)}.
        </Callout>
      )}

      {blockedByDuties && (
        <Callout tone="gray" icon={Shield01} title="Another reviewer has to take this one">
          You raised this finding or worked on the response, so the assessment of it has to come from someone else in
          the QMS Department.
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" bodyClassName="flex flex-col gap-8 py-6">
          {/* ------------------------------------------ 10.2 Finding / NC */}
          <Section no="1" title="Finding / Nonconformity">
            <KeyValue
              items={[
                { k: 'Source', v: `${car.source} — ${source?.name || ''}${source?.group ? ` (${source.group})` : ''}` },
                ...(car.sourceOther ? [{ k: 'Specified', v: car.sourceOther }] : []),
                { k: 'Deviation from the standard', v: car.finding.deviation },
                { k: 'ISO standard / clause', v: car.finding.isoClause },
                { k: 'Type of NC', v: <StatusTag status={car.finding.ncType} /> },
                ...(car.finding.ofiType ? [{ k: 'OFI classification', v: car.finding.ofiType }] : []),
                { k: 'Reason for re-issue', v: car.finding.reasonForReissue },
                { k: 'No. of recurrence', v: car.finding.recurrenceCount },
              ]}
            />
          </Section>

          {/* ------------------------- 10.3 Initiator / 10.4 Recipient */}
          <Section no="2" title="Initiator and recipient">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <PersonCard
                  label="Initiator"
                  person={initiator}
                  name={userName(initiatorId)}
                  department={car.initiator.departmentId ? deptName(car.initiator.departmentId) : null}
                />
                <KeyValue
                  className="mt-4"
                  items={[
                    ...(car.initiator.personnelId ? [{ k: 'Issued from account', v: initiatorAccount?.fullName }] : []),
                    { k: 'Date issued', v: formatDate(car.initiator.dateIssued) },
                    { k: 'Reply due date', v: formatDate(car.initiator.replyDueDate) },
                    { k: 'Signature', v: car.initiator.signature },
                  ]}
                />
              </div>

              <div>
                <PersonCard
                  label="Recipient — responsible person"
                  person={recipient}
                  name={userName(recipientId)}
                  department={deptName(car.recipient.departmentId)}
                />
                <KeyValue
                  className="mt-4"
                  items={[
                    { k: 'Delivered to account', v: recipientAccount?.fullName },
                    {
                      k: 'Date submitted',
                      v: car.recipient.dateSubmitted ? formatDate(car.recipient.dateSubmitted) : null,
                    },
                    { k: 'Signature', v: car.recipient.signature },
                  ]}
                />
              </div>
            </div>
          </Section>

          {/* --------------------- 10.5 Description of the problem */}
          <Section no="3" title="Description of the problem">
            <p className="text-sm leading-relaxed text-secondary">{car.problem.description}</p>
            <KeyValue
              className="mt-4"
              items={[
                { k: 'May occur in other departments/sections?', v: car.problem.mayOccurElsewhere },
                { k: 'Identified in the RBT?', v: car.problem.identifiedInRBT },
              ]}
            />
          </Section>

          {/* ------------------------- 10.6 Root cause of the problem */}
          <Section no="4" title="Root cause of the problem">
            <Narrative
              text={car.rootCause.explanation}
              emptyText={
                car.finding.ncType === 'OFI'
                  ? 'Root cause is optional for suggestions for improvement.'
                  : 'Required before the response can be submitted to the QMS Department.'
              }
              meta={[
                { k: 'Analyzed by', v: userName(car.rootCause.analyzedBy) },
                { k: 'Date', v: formatDate(car.rootCause.date) },
              ]}
            />
          </Section>

          {/* ------------------ 10.7 Immediate action / correction */}
          <Section no="5" title="Immediate action / correction">
            <ActionList
              items={car.immediateActions}
              nameOf={userName}
              emptyText="Containment actions are listed here once the department responds."
            />
          </Section>

          {/* ------------------- 10.8 Permanent corrective action */}
          <Section no="6" title="Permanent corrective action">
            <ActionList
              items={car.correctiveActions}
              nameOf={userName}
              emptyText="The actions that prevent recurrence, each with its own responsible person and target date."
            />
            {(car.comments || car.planAccepted) && (
              <KeyValue
                className="mt-2"
                items={[
                  ...(car.comments ? [{ k: 'Comments', v: car.comments }] : []),
                  ...(car.planAccepted
                    ? [
                        {
                          k: 'Plan accepted',
                          v: `${userName(car.planAccepted.by)} on ${formatDate(car.planAccepted.at)}`,
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </Section>

          {/* --------------------------------------------- implementation */}
          <Section no="7" title="Implementation">
            <Narrative
              text={car.implementation?.details}
              emptyText={
                car.status === CAR_STATUS.ACTIVE
                  ? `Due ${formatDate(implementationDue)}. The department records what was done and attaches the evidence.`
                  : 'Recorded by the department once the action plan is accepted and carried out.'
              }
              meta={
                car.implementation && [
                  { k: 'Recorded by', v: userName(car.implementation.recordedBy) },
                  { k: 'Completed on', v: formatDate(car.implementation.completedOn) },
                  { k: 'Recorded', v: formatDateTime(car.implementation.recordedAt) },
                ]
              }
            />
          </Section>

          {/* ------------------------------------- 10.10 Verification */}
          <Section no="8" title="Verification — closure of countermeasure">
            <KeyValue
              items={[
                {
                  k: 'Scheduled for',
                  v: car.verificationDueDate
                    ? `${formatDate(car.verificationDueDate)} — a day after the target date`
                    : null,
                },
                { k: 'Notes and justification', v: car.verification.closure.notes },
                {
                  k: 'Verified by',
                  v: car.verification.closure.verifiedBy ? userName(car.verification.closure.verifiedBy) : null,
                },
                {
                  k: 'Approved by',
                  v: car.verification.closure.approvedBy ? userName(car.verification.closure.approvedBy) : null,
                },
                {
                  k: 'Verification date',
                  v: car.verification.closure.verificationDate
                    ? formatDate(car.verification.closure.verificationDate)
                    : null,
                },
                { k: 'Disposition', v: <StatusTag status={car.verification.closure.disposition} /> },
              ]}
            />
          </Section>

          <Section no="9" title="Verification — effectiveness of action plan">
            <KeyValue
              items={[
                {
                  k: 'Due',
                  v: car.effectivenessDueDate
                    ? `${formatDate(car.effectivenessDueDate)} — 6 months after close-out or the next internal audit`
                    : null,
                },
                { k: 'Notes and justification', v: car.verification.effectiveness.notes },
                {
                  k: 'Validated by',
                  v: car.verification.effectiveness.validatedBy
                    ? userName(car.verification.effectiveness.validatedBy)
                    : null,
                },
                {
                  k: 'Approved by',
                  v: car.verification.effectiveness.approvedBy
                    ? userName(car.verification.effectiveness.approvedBy)
                    : null,
                },
                {
                  k: 'Date',
                  v: car.verification.effectiveness.date ? formatDate(car.verification.effectiveness.date) : null,
                },
                {
                  k: 'Result',
                  v: car.verification.effectiveness.result ? (
                    <StatusTag status={car.verification.effectiveness.result} />
                  ) : null,
                },
                ...(car.extendedMonitoring
                  ? [{ k: 'Next monitoring check', v: formatDate(car.extendedMonitoring.nextCheckDate) }]
                  : []),
              ]}
            />
          </Section>

          {/* --------------------------------------------- earlier rounds */}
          {earlierRounds > 0 && (
            <Section
              no="10"
              title="Earlier rounds"
              subtitle="Responses that were returned and checks that sent the CAR back, kept for the record."
            >
              <ol className="flex flex-col gap-3">
                {(car.previousResponses || []).map((entry, index) => (
                  <li key={`response-${entry.returnedAt}-${index}`} className="rounded-xl p-4 ring-1 ring-secondary">
                    <p className="text-sm font-semibold text-primary">
                      Response {index + 1} — returned on {formatDate(entry.returnedAt)} by {userName(entry.returnedBy)}
                    </p>
                    <p className="mt-1 text-sm text-tertiary">{entry.notes}</p>
                    <KeyValue
                      className="mt-2"
                      items={[
                        { k: 'Prepared by', v: entry.preparedBy ? userName(entry.preparedBy) : null },
                        { k: 'Submitted', v: entry.submittedAt ? formatDate(entry.submittedAt) : null },
                        { k: 'Root cause', v: entry.rootCause },
                        {
                          k: 'Corrective actions',
                          v: (entry.correctiveActions || []).map((item) => item.action).join(' · '),
                        },
                      ]}
                    />
                  </li>
                ))}
                {(car.previousChecks || []).map((check, index) => (
                  <li key={`check-${check.stage}-${index}`} className="rounded-xl p-4 ring-1 ring-secondary">
                    <p className="text-sm font-semibold text-primary">
                      {check.stage === 'verification' &&
                        `Verification on ${formatDate(check.closure.verificationDate)} — countermeasure not in place`}
                      {check.stage === 'effectiveness' &&
                        `Effectiveness check on ${formatDate(check.effectiveness.date)} — ${check.effectiveness.result}`}
                      {check.stage === 'monitoring' &&
                        `Monitoring check on ${formatDate(check.date)} — ${
                          check.continued ? `continued to ${formatDate(check.nextCheckDate)}` : 'monitoring ended'
                        }`}
                    </p>
                    <p className="mt-1 text-sm text-tertiary">
                      {check.stage === 'verification' && check.closure.notes}
                      {check.stage === 'effectiveness' && check.effectiveness.notes}
                      {check.stage === 'monitoring' && check.notes}
                    </p>
                    <p className="mt-1 text-xs text-quaternary">
                      {check.stage === 'verification' && `Verified by ${userName(check.closure.verifiedBy)}`}
                      {check.stage === 'effectiveness' && `Validated by ${userName(check.effectiveness.validatedBy)}`}
                      {check.stage === 'monitoring' && `Checked by ${userName(check.by)}`}
                    </p>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </Card>

        {/* -------------------------------------------------------- side rail */}
        <div className="flex flex-col gap-4">
          <Card title="Progress" subtitle="Where this CAR stands">
            <CarWorkflow car={car} />
          </Card>

          <Card title="At a glance">
            <KeyValue items={glance} />
          </Card>

          {/* -------------------------------- PRD 16 supporting files */}
          <Card
            title="Supporting files"
            subtitle={`${attachments.length} attached`}
            actions={
              (canRespond || canImplement || isQms) && (
                <Button color="link-color" size="sm" iconLeading={Paperclip} onClick={() => setDialog('attach')}>
                  Attach
                </Button>
              )
            }
          >
            {attachments.length === 0 ? (
              <PageState
                icon={Paperclip}
                size="sm"
                title="No attachments"
                text="Photos, PDFs, reports, screenshots and forms can be attached to this CAR."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {attachments.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 rounded-lg p-2 ring-1 ring-secondary">
                    <FileTypeIcon fileName={file.fileName} fileType={file.fileType} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-primary">{file.fileName}</p>
                      <p className="truncate text-xs text-tertiary">
                        {file.fileSize} · {userName(file.personnelId || file.uploadedBy)} ·{' '}
                        {formatDateTime(file.uploadDate)}
                      </p>
                    </div>
                    <ButtonUtility size="xs" color="tertiary" tooltip="Download" icon={Download01} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {(canRespond || canImplement) && deadline?.date && (
            <Callout tone={car.overdue ? 'error' : 'brand'} icon={Clock} title="Action required from your department">
              {canImplement
                ? 'Carry out the corrective actions and record the implementation'
                : 'Submit the root cause analysis and action plan'}{' '}
              —{' '}
              {daysToDeadline >= 0
                ? `due ${relativeDays(deadline.date)}`
                : `${plural(Math.abs(daysToDeadline), 'day')} late`}
              .
            </Callout>
          )}
        </div>
      </div>

      {/* ============================== dialogs =============================== */}

      <AppDialog
        isOpen={dialog === 'respond'}
        onClose={() => setDialog(null)}
        size="lg"
        icon={Edit03}
        title="Submit corrective action response"
        subtitle={`${car.carNo} — sections 10.6 to 10.9 of the CAR form`}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button color="primary" size="md" iconLeading={Check} isDisabled={!responseReady} onClick={submitResponse}>
              Submit to QMS
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <NativeSelect
            label="Prepared by"
            value={response.preparedBy}
            onChange={(event) => setResponse((current) => ({ ...current, preparedBy: event.target.value }))}
            hint={
              responders.length
                ? `${recipientAccount?.fullName || 'This account'} is shared — name the person who prepared this response.`
                : `${deptName(car.recipient.departmentId)} has no active personnel. Add them on the Personnel page first.`
            }
            options={responderOptions}
          />

          <TextArea
            label="Root cause of the problem"
            isRequired={car.finding.ncType !== 'OFI'}
            hint="Reach the systemic cause — not only the immediate trigger."
            rows={4}
            value={response.rootCause}
            onChange={(value) => setResponse((current) => ({ ...current, rootCause: value }))}
          />

          <ActionListEditor
            title="Immediate action / correction"
            hint="What was done to contain the nonconformity. Leave empty if none was needed."
            items={response.immediateActions}
            onChange={(items) => setResponse((current) => ({ ...current, immediateActions: items }))}
            options={responderOptions}
            addLabel="Add immediate action"
            responsibleDefault={car.recipient.personnelId || ''}
          />

          <ActionListEditor
            title="Permanent corrective action"
            hint="What prevents this from happening again. Implementation is due on the latest target date."
            items={response.correctiveActions}
            onChange={(items) => setResponse((current) => ({ ...current, correctiveActions: items }))}
            options={responderOptions}
            required
            addLabel="Add corrective action"
            responsibleDefault={car.recipient.personnelId || ''}
          />

          <TextArea
            label="Comments"
            rows={2}
            value={response.comments}
            onChange={(value) => setResponse((current) => ({ ...current, comments: value }))}
            placeholder="Optional — anything QMS should know when assessing the plan."
          />

          <Callout tone="brand" icon={InfoCircle}>
            Every action needs a description, a responsible person and a target date. Submitting signs the response as{' '}
            <strong>{response.preparedBy ? userName(response.preparedBy) : 'the person who prepared it'}</strong> on
            behalf of {user.fullName}, and moves the CAR to <strong>Under Review</strong>.
          </Callout>
        </div>
      </AppDialog>

      <AppDialog
        isOpen={dialog === 'accept'}
        onClose={() => setDialog(null)}
        size="sm"
        icon={Shield01}
        iconColor="success"
        title="Accept action plan"
        subtitle={car.carNo}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button color="primary" size="md" iconLeading={Check} onClick={acceptReview}>
              Accept and start implementation
            </Button>
          </>
        }
      >
        <p className="text-sm text-tertiary">
          The root cause analysis and action plan are adequate. The CAR becomes{' '}
          <strong className="text-primary">Active</strong>: the department carries out the actions and records the
          implementation by <strong className="text-primary">{formatDate(latestTarget)}</strong>, the latest target
          date.
        </p>
      </AppDialog>

      <AppDialog
        isOpen={dialog === 'return'}
        onClose={() => setDialog(null)}
        size="md"
        icon={ReverseLeft}
        iconColor="warning"
        title="Return for revision"
        subtitle={car.carNo}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              color="primary"
              size="md"
              iconLeading={ReverseLeft}
              isDisabled={!reviewNote.trim()}
              onClick={returnForRevision}
            >
              Return to {userName(recipientId)}
            </Button>
          </>
        }
      >
        <TextArea
          label="Reason and what is required"
          isRequired
          hint="Sent to the responsible person. This response is kept on the CAR, and a fresh reply period starts."
          rows={5}
          value={reviewNote}
          onChange={setReviewNote}
          placeholder="e.g. The root cause describes the trigger, not the systemic cause. Please re-analyze and propose a control mechanism."
        />
      </AppDialog>

      <AppDialog
        isOpen={dialog === 'implement'}
        onClose={() => setDialog(null)}
        size="md"
        icon={ClipboardCheck}
        title="Record implementation"
        subtitle={`${car.carNo} — implementation details and evidence`}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              color="primary"
              size="md"
              iconLeading={Check}
              isDisabled={
                !implementation.details.trim() ||
                !implementation.completedOn ||
                (responders.length > 0 && !implementation.recordedBy)
              }
              onClick={submitImplementation}
            >
              Send for verification
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <NativeSelect
            label="Recorded by"
            value={implementation.recordedBy}
            onChange={(event) => setImplementation((current) => ({ ...current, recordedBy: event.target.value }))}
            options={responderOptions}
          />
          <TextArea
            label="What was done, and the evidence"
            isRequired
            rows={5}
            value={implementation.details}
            onChange={(value) => setImplementation((current) => ({ ...current, details: value }))}
            placeholder="Describe each action as carried out, and attach photos, records or forms as evidence."
          />
          <Input
            label="Completed on"
            type="date"
            isRequired
            value={implementation.completedOn}
            onChange={(value) => setImplementation((current) => ({ ...current, completedOn: value }))}
          />
          <Callout tone="brand" icon={InfoCircle}>
            QMS verifies the countermeasure on{' '}
            <strong>{formatDate(verificationDueDateFor(car, implementation.completedOn))}</strong> — a day after the
            target completion date.
          </Callout>
        </div>
      </AppDialog>

      <AppDialog
        isOpen={dialog === 'verify'}
        onClose={() => setDialog(null)}
        size="md"
        icon={Shield01}
        title="Verify closure of countermeasure"
        subtitle={`${car.carNo} — PRD 10.10`}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button color="primary" size="md" iconLeading={Shield01} isDisabled={!verifyReady} onClick={submitVerification}>
              Record verification
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {verificationEarly && (
            <Callout tone="warning" icon={Clock} title={`Scheduled for ${formatDate(car.verificationDueDate)}`}>
              The CAR form sets verification a day after the target completion date. Recording it now is early.
            </Callout>
          )}
          {car.implementation && (
            <KeyValue
              items={[
                { k: 'Implementation', v: car.implementation.details },
                { k: 'Recorded by', v: userName(car.implementation.recordedBy) },
              ]}
            />
          )}
          <TextArea
            label="Notes and justification"
            isRequired
            rows={4}
            value={verify.notes}
            onChange={(value) => setVerify((current) => ({ ...current, notes: value }))}
          />
          <FormGrid>
            <Input label="Verified by" value={user.fullName} isReadOnly />
            <NativeSelect
              label="Approved by"
              value={verify.approvedBy}
              onChange={(event) => setVerify((current) => ({ ...current, approvedBy: event.target.value }))}
              hint={
                approverOptions.length > 1
                  ? 'A second QMS Admin approves the verification.'
                  : 'No other active QMS Admin can approve this.'
              }
              options={approverOptions}
            />
          </FormGrid>
          <ChoiceRow
            label="Disposition"
            options={DISPOSITIONS}
            value={verify.disposition}
            onChange={(value) => setVerify((current) => ({ ...current, disposition: value }))}
            hint={
              verify.disposition === 'CLOSED'
                ? 'The countermeasure is in place. The CAR is closed out and its effectiveness check is scheduled.'
                : 'The countermeasure is not in place yet. The CAR goes back to implementation.'
            }
          />
          {verify.disposition === 'OPEN' && (
            <Input
              label="Record the implementation again by"
              type="date"
              isRequired
              value={verify.implementationDueDate}
              onChange={(value) => setVerify((current) => ({ ...current, implementationDueDate: value }))}
            />
          )}
        </div>
      </AppDialog>

      <AppDialog
        isOpen={dialog === 'effectiveness'}
        onClose={() => setDialog(null)}
        size="md"
        icon={CheckCircle}
        iconColor="success"
        title="Check effectiveness of the action plan"
        subtitle={`${car.carNo} — PRD 10.10`}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              color="primary"
              size="md"
              iconLeading={CheckCircle}
              isDisabled={!effectivenessReady}
              onClick={submitEffectiveness}
            >
              {effectiveness.result === EFFECTIVENESS_RESULT.FAIL ? 'Record and re-issue' : 'Record result'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {effectivenessEarly && (
            <Callout tone="warning" icon={Clock} title={`Due ${formatDate(car.effectivenessDueDate)}`}>
              Effectiveness is checked 6 months after close-out or at the next internal audit, whichever comes first.
              Recording it now is early.
            </Callout>
          )}
          <KeyValue
            items={[
              { k: 'Closed out', v: formatDate(car.closeOutDate) },
              { k: 'Countermeasure', v: car.verification.closure.notes },
            ]}
          />
          <TextArea
            label="Notes and justification"
            isRequired
            rows={4}
            value={effectiveness.notes}
            onChange={(value) => setEffectiveness((current) => ({ ...current, notes: value }))}
            placeholder="Evidence that the corrective action held over the monitoring period."
          />
          <FormGrid>
            <Input label="Validated by" value={user.fullName} isReadOnly />
            <NativeSelect
              label="Approved by"
              value={effectiveness.approvedBy}
              onChange={(event) => setEffectiveness((current) => ({ ...current, approvedBy: event.target.value }))}
              options={approverOptions}
            />
          </FormGrid>
          <NativeSelect
            label="Result"
            value={effectiveness.result}
            onChange={(event) => setEffectiveness((current) => ({ ...current, result: event.target.value }))}
            options={EFFECTIVENESS_RESULTS.map((value) => ({ value, label: value }))}
          />
          {effectiveness.result === EFFECTIVENESS_RESULT.MONITORING && (
            <Input
              label="Next monitoring check"
              type="date"
              isRequired
              value={effectiveness.nextCheckDate}
              onChange={(value) => setEffectiveness((current) => ({ ...current, nextCheckDate: value }))}
            />
          )}
          {effectiveness.result === EFFECTIVENESS_RESULT.FURTHER_ACTION && (
            <Input
              label="Further action due by"
              type="date"
              isRequired
              value={effectiveness.implementationDueDate}
              onChange={(value) => setEffectiveness((current) => ({ ...current, implementationDueDate: value }))}
            />
          )}
          <Callout
            tone={
              effectiveness.result === EFFECTIVENESS_RESULT.PASS
                ? 'success'
                : effectiveness.result === EFFECTIVENESS_RESULT.FAIL
                  ? 'error'
                  : 'warning'
            }
            icon={effectiveness.result === EFFECTIVENESS_RESULT.PASS ? CheckCircle : AlertTriangle}
          >
            {RESULT_EFFECT[effectiveness.result]}
          </Callout>
        </div>
      </AppDialog>

      <AppDialog
        isOpen={dialog === 'monitoring'}
        onClose={() => setDialog(null)}
        size="md"
        icon={Activity}
        title="Record monitoring check"
        subtitle={car.carNo}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              color="primary"
              size="md"
              iconLeading={Check}
              isDisabled={
                !monitoring.notes.trim() ||
                (monitoring.outcome === MONITORING_OUTCOME.CONTINUE && !monitoring.nextCheckDate)
              }
              onClick={submitMonitoring}
            >
              Record check
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextArea
            label="What the check found"
            isRequired
            rows={4}
            value={monitoring.notes}
            onChange={(value) => setMonitoring((current) => ({ ...current, notes: value }))}
          />
          <ChoiceRow
            label="Outcome"
            options={Object.values(MONITORING_OUTCOME)}
            value={monitoring.outcome}
            onChange={(value) => setMonitoring((current) => ({ ...current, outcome: value }))}
            hint="If the problem has come back, close this check and re-issue the CAR instead."
          />
          {monitoring.outcome === MONITORING_OUTCOME.CONTINUE && (
            <Input
              label="Next monitoring check"
              type="date"
              isRequired
              value={monitoring.nextCheckDate}
              onChange={(value) => setMonitoring((current) => ({ ...current, nextCheckDate: value }))}
            />
          )}
        </div>
      </AppDialog>

      <AppDialog
        isOpen={dialog === 'reissue'}
        onClose={() => setDialog(null)}
        size="md"
        icon={RefreshCcw01}
        title="Re-issue this CAR"
        subtitle={car.carNo}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              color="primary"
              size="md"
              iconLeading={RefreshCcw01}
              isDisabled={!reissueReason}
              onClick={() =>
                navigate(`${ROUTES.carIssue}?reissue=${car.id}&reason=${encodeURIComponent(reissueReason)}`)
              }
            >
              Continue to re-issue
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <ChoiceRow
            label="Reason for re-issue"
            options={reissueReasons}
            value={reissueReason}
            onChange={setReissueReason}
            hint={REISSUE_REASON_HINT[reissueReason]}
          />
          <Callout tone="gray" icon={InfoCircle}>
            The new CAR gets its own number and links back to {car.carNo}, with the recurrence counted along the chain.
            {car.status !== CAR_STATUS.CLOSED && ` ${car.carNo} is closed as re-issued when you submit it.`}
          </Callout>
        </div>
      </AppDialog>

      <AppDialog
        isOpen={dialog === 'attach'}
        onClose={() => setDialog(null)}
        size="md"
        icon={Paperclip}
        title="Attach supporting file"
        subtitle={car.carNo}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button color="primary" size="md" iconLeading={Paperclip} onClick={attachEvidence}>
              Attach file
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FileUpload.Root>
            <FileUpload.DropZone hint="Photos, PDFs, reports, screenshots and forms" />
          </FileUpload.Root>
          <Callout tone="gray" icon={InfoCircle}>
            The system records the filename, uploader, upload date and time, the related CAR and the file type.
          </Callout>
        </div>
      </AppDialog>
    </Page>
  )
}
