/* ============================================================================
   CAR Details (PRD 15 — refers to 10.1–10.10) + workflow actions (PRD 12)
   ----------------------------------------------------------------------------
   Recipient  : completes root cause, immediate action, corrective action, submits
   QMS Dept.  : reviews, returns for revision, verifies closure, validates
                effectiveness and closes the CAR
   ========================================================================== */

import { useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle,
  Clipboard,
  Clock,
  Download01,
  Edit03,
  InfoCircle,
  Paperclip,
  Printer,
  ReverseLeft,
  Shield01,
} from '@untitledui/icons'
import { useNavigate, useParams } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  AppDialog,
  Avatar,
  Badge,
  Button,
  ButtonUtility,
  Callout,
  Card,
  ContentDivider,
  FileTypeIcon,
  FileUpload,
  Input,
  KeyValue,
  NativeSelect,
  PageState,
  Section,
  StatusBadge,
  StatusTag,
  TextArea,
} from '@/components/ui'
import {
  CAR_STATUS,
  DISPOSITIONS,
  EFFECTIVENESS_RESULTS,
  NOTIFICATION_TYPE,
  PERMISSION,
} from '@/config/constants'
import { ROUTES } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { CAR_RULES } from '@/config/appConfig'
import { TODAY, daysBetween, formatDate, formatDateTime, initials } from '@/utils/format'
import CarWorkflow from './CarWorkflow'

const iso = (date) => date.toISOString().slice(0, 10)

/** The revised reply deadline a CAR gets when it is sent back for rework. */
function revisedDueDate() {
  const next = new Date(TODAY)
  next.setDate(next.getDate() + CAR_RULES.replyDueDays)
  return iso(next)
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

export default function CarDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, can, isQms } = useAuth()
  const {
    carForUser,
    attachmentsForCar,
    userById,
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
    rootCause: '',
    immediateAction: '',
    immediateTarget: iso(TODAY),
    correctiveAction: '',
    correctiveTarget: iso(TODAY),
  })
  const [reviewNote, setReviewNote] = useState('')
  const [verify, setVerify] = useState({ notes: '', disposition: 'CLOSED' })
  const [effectiveness, setEffectiveness] = useState({ notes: '', result: EFFECTIVENESS_RESULTS[0] })

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
  const recipient = userById(car.recipient.userId)
  const initiator = userById(car.initiator.userId)
  const attachments = attachmentsForCar(car.id)
  const daysLeft = daysBetween(TODAY, car.initiator.replyDueDate)
  const revision = car.revision?.notes ? car.revision : null

  const isRecipient = user.id === car.recipient.userId || user.departmentId === car.recipient.departmentId
  const awaitingResponse = [
    CAR_STATUS.ACTIVE,
    CAR_STATUS.PENDING,
    CAR_STATUS.FOR_REVISION,
    CAR_STATUS.OVERDUE,
  ].includes(car.status)

  /* Separation of duties (PRD 6): nobody assesses their own work. Whoever wrote
     the response cannot review, verify or close it, and whoever raised the
     finding cannot be the one to judge the answer to it. */
  const isResponder = [
    car.rootCause.analyzedBy,
    car.immediateAction.responsibleId,
    car.correctiveAction.responsibleId,
    car.recipient.userId,
  ].includes(user.id)
  const isInitiator = user.id === car.initiator.userId
  const isImpartial = !isResponder && !isInitiator

  const canRespond = can(PERMISSION.CAR_RESPOND) && isRecipient && awaitingResponse
  const canReview = can(PERMISSION.CAR_REVIEW) && isImpartial && car.status === CAR_STATUS.UNDER_REVIEW
  const canVerify = can(PERMISSION.CAR_VERIFY) && isImpartial && car.status === CAR_STATUS.FOR_VERIFICATION
  const canClose =
    can(PERMISSION.CAR_CLOSE) &&
    isImpartial &&
    car.status === CAR_STATUS.FOR_VERIFICATION &&
    car.verification.closure.disposition === 'CLOSED'

  /* Shown instead of the action buttons when the only thing standing between
     this user and the CAR is that they are too close to it. */
  const blockedByDuties =
    !isImpartial &&
    ((can(PERMISSION.CAR_REVIEW) && car.status === CAR_STATUS.UNDER_REVIEW) ||
      (can(PERMISSION.CAR_VERIFY) && car.status === CAR_STATUS.FOR_VERIFICATION))

  /* ---------------------------------------------------------------- actions */
  const openResponse = () => {
    setResponse({
      rootCause: car.rootCause.explanation || '',
      immediateAction: car.immediateAction.action || '',
      immediateTarget: car.immediateAction.targetDate || iso(TODAY),
      correctiveAction: car.correctiveAction.action || '',
      correctiveTarget: car.correctiveAction.targetDate || iso(TODAY),
    })
    setDialog('respond')
  }

  const submitResponse = () => {
    patchCar(car.id, {
      status: CAR_STATUS.UNDER_REVIEW,
      recipient: { ...car.recipient, dateSubmitted: iso(TODAY), signature: user.fullName },
      rootCause: { explanation: response.rootCause, analyzedBy: user.id, date: iso(TODAY) },
      immediateAction: {
        action: response.immediateAction,
        responsibleId: user.id,
        targetDate: response.immediateTarget,
        signature: user.fullName,
      },
      correctiveAction: {
        action: response.correctiveAction,
        responsibleId: user.id,
        targetDate: response.correctiveTarget,
        signature: user.fullName,
      },
    })
    log(
      user,
      'Submitted CAR',
      'CAR',
      { type: 'car', id: car.id, label: car.carNo },
      'Root cause and action plan submitted to the QMS Department.',
    )

    /* The review sits with the QMS Department, so that is who has to be told.
       The initiator is copied in because the finding was theirs. */
    for (const reviewer of qmsUsers) {
      if (reviewer.id === user.id) continue
      notify(
        reviewer.id,
        NOTIFICATION_TYPE.CAR_SUBMITTED,
        `${car.carNo} is awaiting your review`,
        `${user.fullName} submitted the root cause analysis and action plan.`,
        { type: 'car', id: car.id },
      )
    }
    if (car.initiator.userId !== user.id && !qmsUsers.some((q) => q.id === car.initiator.userId)) {
      notify(
        car.initiator.userId,
        NOTIFICATION_TYPE.CAR_SUBMITTED,
        `${car.carNo} response submitted`,
        `${user.fullName} submitted a response to the finding you raised. It is now with the QMS Department.`,
        { type: 'car', id: car.id },
      )
    }
    setDialog(null)
  }

  const acceptReview = () => {
    patchCar(car.id, { status: CAR_STATUS.FOR_VERIFICATION })
    log(
      user,
      'Reviewed CAR',
      'CAR',
      { type: 'car', id: car.id, label: car.carNo },
      'Response accepted; moved to verification.',
    )
    notify(
      car.recipient.userId,
      NOTIFICATION_TYPE.CAR_VERIFIED,
      `${car.carNo} accepted for verification`,
      'Your corrective action has been accepted and is awaiting verification of closure.',
      { type: 'car', id: car.id },
    )
    setDialog(null)
  }

  /**
   * Sends the CAR back for rework. The reason belongs in its own record, not in
   * the verification block, and the recipient gets a fresh deadline — without
   * one the CAR is judged against a due date that has already passed and the
   * register reports it as Overdue the moment it is returned.
   */
  const returnForRevision = () => {
    const dueDate = revisedDueDate()
    patchCar(car.id, {
      status: CAR_STATUS.FOR_REVISION,
      recipient: { ...car.recipient, dateSubmitted: null, signature: null },
      initiator: { ...car.initiator, replyDueDate: dueDate },
      revision: {
        notes: reviewNote,
        returnedBy: user.id,
        returnedAt: iso(TODAY),
        dueDate,
        stage: 'review',
      },
    })
    log(user, 'Returned for Revision', 'CAR', { type: 'car', id: car.id, label: car.carNo }, reviewNote)
    notify(
      car.recipient.userId,
      NOTIFICATION_TYPE.CAR_RETURNED,
      `${car.carNo} returned for revision`,
      `${reviewNote} A revised response is due ${formatDate(dueDate)}.`,
      { type: 'car', id: car.id },
    )
    setReviewNote('')
    setDialog(null)
  }

  const submitVerification = () => {
    patchCar(car.id, {
      verification: {
        ...car.verification,
        closure: {
          notes: verify.notes,
          verifiedBy: user.id,
          approvedBy: user.id,
          verificationDate: iso(TODAY),
          disposition: verify.disposition,
        },
      },
    })
    log(
      user,
      'Verified CAR',
      'CAR',
      { type: 'car', id: car.id, label: car.carNo },
      `Closure of countermeasure verified; disposition set to ${verify.disposition}.`,
    )
    notify(
      car.recipient.userId,
      NOTIFICATION_TYPE.CAR_VERIFIED,
      `${car.carNo} closure verified`,
      verify.disposition === 'CLOSED'
        ? 'The countermeasure was verified as in place. Effectiveness validation follows.'
        : `The countermeasure is not yet fully in place: ${verify.notes}`,
      { type: 'car', id: car.id },
    )
    setDialog(null)
  }

  const submitEffectiveness = () => {
    const closes = effectiveness.result !== 'Fail (CAR Returned for Further Processing)'
    const dueDate = closes ? car.initiator.replyDueDate : revisedDueDate()
    patchCar(car.id, {
      status: closes ? CAR_STATUS.CLOSED : CAR_STATUS.FOR_REVISION,
      dateClosed: closes ? iso(TODAY) : null,
      verification: {
        /* A failed action plan sends the CAR back to the start of the response
           stage, so the closure verification it already passed no longer holds
           — leaving the disposition at CLOSED would re-offer effectiveness
           validation the moment the CAR returns, skipping the re-verification. */
        closure: closes
          ? car.verification.closure
          : { notes: '', verifiedBy: null, approvedBy: null, verificationDate: null, disposition: 'OPEN' },
        effectiveness: {
          notes: effectiveness.notes,
          validatedBy: user.id,
          approvedBy: user.id,
          result: effectiveness.result,
          date: iso(TODAY),
        },
      },
      ...(closes
        ? {}
        : {
            recipient: { ...car.recipient, dateSubmitted: null, signature: null },
            initiator: { ...car.initiator, replyDueDate: dueDate },
            revision: {
              notes: effectiveness.notes,
              returnedBy: user.id,
              returnedAt: iso(TODAY),
              dueDate,
              stage: 'effectiveness',
            },
          }),
    })
    log(
      user,
      closes ? 'Closed CAR' : 'Returned for Revision',
      'CAR',
      { type: 'car', id: car.id, label: car.carNo },
      `Effectiveness validated with result ${effectiveness.result}.`,
    )
    notify(
      car.recipient.userId,
      closes ? NOTIFICATION_TYPE.CAR_CLOSED : NOTIFICATION_TYPE.CAR_RETURNED,
      closes ? `${car.carNo} has been closed` : `${car.carNo} returned for further processing`,
      closes
        ? `Effectiveness result: ${effectiveness.result}.`
        : `${effectiveness.notes} A revised response is due ${formatDate(dueDate)}.`,
      { type: 'car', id: car.id },
    )
    setDialog(null)
  }

  const attachEvidence = () => {
    addAttachment({
      id: `ATT-${Date.now()}`,
      carId: car.id,
      fileName: `evidence_${Date.now()}.pdf`,
      fileType: 'PDF',
      fileSize: '—',
      uploadedBy: user.id,
      uploadDate: TODAY.toISOString().slice(0, 19),
      category: 'Evidence',
      note: 'Uploaded from the CAR details page.',
    })
    setDialog(null)
  }

  const failing = effectiveness.result.startsWith('Fail')

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
            {canRespond && (
              <Button color="primary" size="md" iconLeading={Edit03} onClick={openResponse}>
                {car.status === CAR_STATUS.FOR_REVISION ? 'Revise response' : 'Submit response'}
              </Button>
            )}
            {canReview && (
              <>
                <Button color="secondary" size="md" iconLeading={ReverseLeft} onClick={() => setDialog('return')}>
                  Return for revision
                </Button>
                <Button color="primary" size="md" iconLeading={Check} onClick={() => setDialog('accept')}>
                  Accept response
                </Button>
              </>
            )}
            {canVerify && (
              <Button color="primary" size="md" iconLeading={Shield01} onClick={() => setDialog('verify')}>
                Verify closure
              </Button>
            )}
            {canClose && (
              <Button color="primary" size="md" iconLeading={CheckCircle} onClick={() => setDialog('effectiveness')}>
                Validate effectiveness
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
          {car.autoFlagged && (
            <Badge size="sm" color="error">
              Auto-flagged overdue
            </Badge>
          )}
        </div>
      </PageHeader>

      {/* ----------------------------------------------------- status callouts */}
      {car.status === CAR_STATUS.OVERDUE && (
        <Callout tone="error" icon={AlertTriangle} title="This CAR is overdue">
          The reply due date of {formatDate(car.initiator.replyDueDate)} passed {Math.abs(daysLeft)} days ago
          without a submitted response. The responsible person and the QMS Department have been notified.
        </Callout>
      )}

      {/* Tied to the revision record rather than to the status, so the reason a
          CAR came back stays on screen even once it has also run late. */}
      {revision?.notes && !car.recipient.dateSubmitted && car.status !== CAR_STATUS.CLOSED && (
        <Callout
          tone="warning"
          icon={ReverseLeft}
          title={
            revision.stage === 'effectiveness'
              ? 'Returned for further processing — the action plan was not effective'
              : 'Returned for revision by the QMS Department'
          }
        >
          {revision.notes}
          <span className="mt-1 block text-sm">
            Returned by {userName(revision.returnedBy)} on {formatDate(revision.returnedAt)}
            {revision.dueDate ? ` · revised response due ${formatDate(revision.dueDate)}` : ''}.
          </span>
        </Callout>
      )}

      {blockedByDuties && (
        <Callout tone="gray" icon={Shield01} title="Another reviewer has to take this one">
          You raised this finding or worked on the response, so the assessment of it has to come from someone
          else in the QMS Department.
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" bodyClassName="flex flex-col gap-8 py-6">
          {/* ------------------------------------------ 10.2 Finding / NC */}
          <Section no="1" title="Finding / Nonconformity">
            <KeyValue
              items={[
                { k: 'Source', v: `${car.source} — ${source?.name || ''}` },
                ...(car.sourceOther ? [{ k: 'Other source (specified)', v: car.sourceOther }] : []),
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
                  name={userName(car.initiator.userId)}
                  department={deptName(car.initiator.departmentId)}
                />
                <KeyValue
                  className="mt-4"
                  items={[
                    { k: 'Date issued', v: formatDate(car.initiator.dateIssued) },
                    { k: 'Reply due date', v: formatDate(car.initiator.replyDueDate) },
                    { k: 'Signature', v: car.initiator.signature },
                  ]}
                />
              </div>

              <div>
                <PersonCard
                  label="Recipient"
                  person={recipient}
                  name={userName(car.recipient.userId)}
                  department={deptName(car.recipient.departmentId)}
                />
                <KeyValue
                  className="mt-4"
                  items={[
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
            <Narrative
              text={car.immediateAction.action}
              meta={[
                { k: 'Responsible person', v: userName(car.immediateAction.responsibleId) },
                { k: 'Signature', v: car.immediateAction.signature },
                { k: 'Target date of completion', v: formatDate(car.immediateAction.targetDate) },
              ]}
            />
          </Section>

          {/* ------------------- 10.8 Permanent corrective action */}
          <Section no="6" title="Permanent corrective action">
            <Narrative
              text={car.correctiveAction.action}
              meta={[
                { k: 'Responsible person', v: userName(car.correctiveAction.responsibleId) },
                { k: 'Signature', v: car.correctiveAction.signature },
                { k: 'Target date of completion', v: formatDate(car.correctiveAction.targetDate) },
              ]}
            />
          </Section>

          {/* ------------------------------------- 10.10 Verification */}
          <Section no="7" title="Verification — closure of countermeasure">
            <KeyValue
              items={[
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

          <Section no="8" title="Verification — effectiveness of action plan">
            <KeyValue
              items={[
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
                    <StatusTag
                      status={
                        car.verification.effectiveness.result.startsWith('Fail')
                          ? 'Fail'
                          : car.verification.effectiveness.result
                      }
                      label={car.verification.effectiveness.result}
                    />
                  ) : null,
                },
              ]}
            />
          </Section>
        </Card>

        {/* -------------------------------------------------------- side rail */}
        <div className="flex flex-col gap-4">
          <Card title="Progress" subtitle="PRD 12 — CAR workflow">
            <CarWorkflow car={car} />
          </Card>

          <Card title="At a glance">
            <KeyValue
              items={[
                { k: 'CAR number', v: car.carNo, mono: true },
                { k: 'Status', v: <StatusBadge status={car.status} /> },
                { k: 'Date issued', v: formatDate(car.initiator.dateIssued) },
                { k: 'Due date', v: formatDate(car.initiator.replyDueDate) },
                { k: 'Date closed', v: car.dateClosed ? formatDate(car.dateClosed) : null },
              ]}
            />
          </Card>

          {/* -------------------------------- PRD 16 supporting files */}
          <Card
            title="Supporting files"
            subtitle={`${attachments.length} attached`}
            actions={
              (canRespond || isQms) && (
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
                        {file.fileSize} · {userName(file.uploadedBy)} · {formatDateTime(file.uploadDate)}
                      </p>
                    </div>
                    <ButtonUtility size="xs" color="tertiary" tooltip="Download" icon={Download01} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {canRespond && (
            <Callout tone="brand" icon={Clock} title="Action required from you">
              {daysLeft >= 0
                ? `Your response is due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`
                : `Your response is ${Math.abs(daysLeft)} days late.`}
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
            <Button
              color="primary"
              size="md"
              iconLeading={Check}
              isDisabled={!response.rootCause.trim() || !response.correctiveAction.trim()}
              onClick={submitResponse}
            >
              Submit to QMS
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <TextArea
            label="Root cause of the problem"
            isRequired={car.finding.ncType !== 'OFI'}
            hint="Reach the systemic cause — not only the immediate trigger."
            rows={4}
            value={response.rootCause}
            onChange={(value) => setResponse((current) => ({ ...current, rootCause: value }))}
          />

          <ContentDivider>Immediate action</ContentDivider>

          <TextArea
            label="Immediate action / correction"
            hint="What was done to contain the nonconformity."
            rows={3}
            value={response.immediateAction}
            onChange={(value) => setResponse((current) => ({ ...current, immediateAction: value }))}
          />
          <Input
            label="Target date of completion"
            type="date"
            value={response.immediateTarget}
            onChange={(value) => setResponse((current) => ({ ...current, immediateTarget: value }))}
          />

          <ContentDivider>Permanent corrective action</ContentDivider>

          <TextArea
            label="Permanent corrective action"
            isRequired
            hint="What prevents this from happening again."
            rows={4}
            value={response.correctiveAction}
            onChange={(value) => setResponse((current) => ({ ...current, correctiveAction: value }))}
          />
          <Input
            label="Target date of completion"
            type="date"
            value={response.correctiveTarget}
            onChange={(value) => setResponse((current) => ({ ...current, correctiveTarget: value }))}
          />

          <Callout tone="brand" icon={InfoCircle}>
            Submitting signs the response as <strong>{user.fullName}</strong> and moves the CAR to{' '}
            <strong>Under Review</strong> by the QMS Department.
          </Callout>
        </div>
      </AppDialog>

      <AppDialog
        isOpen={dialog === 'accept'}
        onClose={() => setDialog(null)}
        size="sm"
        icon={Shield01}
        iconColor="success"
        title="Accept response"
        subtitle={car.carNo}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button color="primary" size="md" iconLeading={Check} onClick={acceptReview}>
              Accept and move to verification
            </Button>
          </>
        }
      >
        <p className="text-sm text-tertiary">
          The root cause analysis and action plan are adequate. The CAR moves to{' '}
          <strong className="text-primary">For Verification</strong>, where closure of the countermeasure is
          checked.
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
              Return to {userName(car.recipient.userId)}
            </Button>
          </>
        }
      >
        <TextArea
          label="Reason and what is required"
          isRequired
          hint="This is sent to the responsible person as a notification."
          rows={5}
          value={reviewNote}
          onChange={setReviewNote}
          placeholder="e.g. The root cause describes the trigger, not the systemic cause. Please re-analyze and propose a control mechanism."
        />
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
            <Button
              color="primary"
              size="md"
              iconLeading={Shield01}
              isDisabled={!verify.notes.trim()}
              onClick={submitVerification}
            >
              Record verification
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextArea
            label="Notes and justification"
            isRequired
            rows={4}
            value={verify.notes}
            onChange={(value) => setVerify((current) => ({ ...current, notes: value }))}
          />
          <NativeSelect
            label="Disposition"
            value={verify.disposition}
            onChange={(event) => setVerify((current) => ({ ...current, disposition: event.target.value }))}
            options={DISPOSITIONS.map((value) => ({ value, label: value }))}
          />
          <Callout tone="brand" icon={InfoCircle}>
            Setting the disposition to <strong>CLOSED</strong> unlocks effectiveness validation, which formally
            closes the CAR.
          </Callout>
        </div>
      </AppDialog>

      <AppDialog
        isOpen={dialog === 'effectiveness'}
        onClose={() => setDialog(null)}
        size="md"
        icon={CheckCircle}
        iconColor="success"
        title="Validate effectiveness of the action plan"
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
              isDisabled={!effectiveness.notes.trim()}
              onClick={submitEffectiveness}
            >
              Record result
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextArea
            label="Notes and justification"
            isRequired
            rows={4}
            value={effectiveness.notes}
            onChange={(value) => setEffectiveness((current) => ({ ...current, notes: value }))}
            placeholder="Evidence that the corrective action held over the monitoring period."
          />
          <NativeSelect
            label="Result"
            value={effectiveness.result}
            onChange={(event) => setEffectiveness((current) => ({ ...current, result: event.target.value }))}
            options={EFFECTIVENESS_RESULTS.map((value) => ({ value, label: value }))}
          />
          <Callout tone={failing ? 'error' : 'success'} icon={failing ? AlertTriangle : CheckCircle}>
            {failing
              ? 'A failed result returns the CAR to the responsible person for further processing.'
              : 'The CAR will be marked Closed and the concerned users notified.'}
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
