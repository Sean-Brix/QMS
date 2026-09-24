/* ============================================================================
   Document request detail — one Document Review / Change Notice and its decision.
   ----------------------------------------------------------------------------
   Originator : edits and resubmits a returned request, or cancels an open one
   QMS Admin  : starts the review, returns it, disapproves it, or approves it —
                approval publishes the change to the repository
   A QMS Admin never decides a request their own account raised.
   Every version of the document is listed, with the one this request proposes
   on top, and any of them can be opened for a closer look.
   ========================================================================== */

import { useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  Clock,
  Edit03,
  Eye,
  FileCheck02,
  InfoCircle,
  Printer,
  RefreshCcw01,
  ReverseLeft,
  Send01,
  Shield01,
  XCircle,
} from '@untitledui/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  ActivityFeed,
  AppDialog,
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  ContentDivider,
  FileTypeIcon,
  FormGrid,
  FormSpan,
  Input,
  KeyValue,
  NativeSelect,
  PageState,
  Section,
  StatusBadge,
  StatusTag,
  TextArea,
  cx,
} from '@/components/ui'
import { DOCUMENT_RULES } from '@/config/appConfig'
import {
  ACCOUNT_STATUS,
  DOC_LEVELS,
  DOC_STATUS,
  NOTIFICATION_TYPE,
  PERMISSION,
  PROCESS_TYPE,
  REQUEST_OPEN_STATUSES,
  REQUEST_QMS_QUEUE_STATUSES,
  REQUEST_STATUS,
  REQUEST_TYPE,
  RETENTION_PERIODS,
  docLevelLabel,
} from '@/config/constants'
import { ROUTES, path } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { TODAY, daysBetween, formatDate, formatDateTime, isoDate, timestamp } from '@/utils/format'
import { isReviewLate, limitText, requestLabel, reviewLimitFor } from '@/utils/requests'
import { WATERMARK_SAMPLE, renderWatermark, watermarkTemplateById } from '@/utils/watermark'

/** How each step in a request's history reads and looks. */
const HISTORY = {
  Submitted: { icon: Send01, color: 'brand', phrase: 'submitted the request' },
  'Review started': { icon: Eye, color: 'gray', phrase: 'started the review' },
  'Returned for revision': { icon: ReverseLeft, color: 'warning', phrase: 'returned it for revision' },
  Resubmitted: { icon: RefreshCcw01, color: 'brand', phrase: 'resubmitted it' },
  Approved: { icon: CheckCircle, color: 'success', phrase: 'approved it' },
  Disapproved: { icon: XCircle, color: 'error', phrase: 'disapproved it' },
  Cancelled: { icon: XCircle, color: 'gray', phrase: 'cancelled it' },
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

/** A year after an ISO date — the default next review of a published document. */
function yearAfter(value) {
  const date = new Date(`${value}T09:00:00`)
  date.setFullYear(date.getFullYear() + 1)
  return isoDate(date)
}

export default function RequestDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, can } = useAuth()
  const {
    requestForUser,
    documents,
    documentRevisions,
    documentRequests,
    revisionsForDocument,
    revisionsForUser,
    documentForUser,
    documentCategories,
    departments,
    categoryName,
    deptName,
    userName,
    userById,
    departmentAccount,
    patchRequest,
    publishRequest,
    log,
    notify,
  } = useData()

  const request = requestForUser(user, id)
  const [dialog, setDialog] = useState(null)
  const [notes, setNotes] = useState('')
  const [approval, setApproval] = useState(null)
  const [approvalErrors, setApprovalErrors] = useState({})
  const [viewingId, setViewingId] = useState(null)

  if (!request) {
    return (
      <Page>
        <PageState
          icon={FileCheck02}
          title="Request not found"
          text="This document request does not exist or is outside your access."
          action={
            <Button color="secondary" onClick={() => navigate(ROUTES.requests)}>
              Back to requests
            </Button>
          }
        />
      </Page>
    )
  }

  /* Only link to a document this account can open — an obsolete one is archived for QMS Admins. */
  const linkedDocument = request.documentId ? documentForUser(user, request.documentId) : null
  const restoredRevision = request.restoresRevisionId
    ? documentRevisions.find((revision) => revision.id === request.restoresRevisionId)
    : null
  const rule = reviewLimitFor(request)
  const late = isReviewLate(request)
  const inQueue = REQUEST_QMS_QUEUE_STATUSES.includes(request.status)
  const daysLeft = daysBetween(TODAY, request.reviewDueDate)
  const isNew = request.type === REQUEST_TYPE.NEW
  const isObsolete = request.type === REQUEST_TYPE.OBSOLETE
  const originatorAccount = userById(request.originator.accountId)
  const record = { type: 'request', id: request.id, label: requestLabel(request) }

  /* Separation of duties: a QMS Admin never decides a request their own account raised. */
  const isOriginator = request.originator.accountId === user.id
  const reviews = can(PERMISSION.DOC_REQUEST_REVIEW)
  const canStart = reviews && !isOriginator && request.status === REQUEST_STATUS.SUBMITTED
  const canDecide = reviews && !isOriginator && request.status === REQUEST_STATUS.UNDER_REVIEW
  const ownRequest = reviews && isOriginator && inQueue
  const canResubmit = isOriginator && request.status === REQUEST_STATUS.RETURNED
  const canCancel = isOriginator && REQUEST_OPEN_STATUSES.includes(request.status)

  const closeDialog = () => {
    setDialog(null)
    setNotes('')
  }

  const historyEntry = (action, text = '') => ({ at: timestamp(), action, by: user.id, personnelId: null, notes: text })

  /* ---------------------------------------------------------------- actions */

  const startReview = () => {
    patchRequest(request.id, { status: REQUEST_STATUS.UNDER_REVIEW, reviewedBy: user.id }, historyEntry('Review started'))
    log(user, 'Started Request Review', 'Document', record, `Review started; decision due ${formatDate(request.reviewDueDate)}.`)
  }

  const returnRequest = () => {
    const text = notes.trim()
    patchRequest(
      request.id,
      { status: REQUEST_STATUS.RETURNED, returned: { notes: text, by: user.id, at: timestamp() } },
      historyEntry('Returned for revision', text),
    )
    log(user, 'Returned Document Request', 'Document', record, text)
    notify(
      request.originator.accountId,
      NOTIFICATION_TYPE.DOC_REQUEST_RETURNED,
      `${request.controlNo} returned for revision`,
      text,
      { type: 'request', id: request.id },
    )
    closeDialog()
  }

  const disapprove = () => {
    const text = notes.trim()
    patchRequest(
      request.id,
      {
        status: REQUEST_STATUS.DISAPPROVED,
        approval: {
          decision: 'Disapproved',
          approvedBy: user.id,
          signatory: user.fullName,
          position: user.position,
          remarks: text,
          date: isoDate(TODAY),
        },
        dcc: { disposition: 'Not published', effectiveDate: null },
      },
      historyEntry('Disapproved', text),
    )
    log(user, 'Disapproved Document Request', 'Document', record, text)
    notify(
      request.originator.accountId,
      NOTIFICATION_TYPE.DOC_REQUEST_DISAPPROVED,
      `${request.controlNo} disapproved`,
      text,
      { type: 'request', id: request.id },
    )
    closeDialog()
  }

  const cancel = () => {
    const text = notes.trim()
    patchRequest(
      request.id,
      { status: REQUEST_STATUS.CANCELLED, cancelled: { reason: text, by: user.id, at: timestamp() } },
      historyEntry('Cancelled', text),
    )
    log(user, 'Cancelled Document Request', 'Document', record, text || 'Withdrawn by the originator.')
    closeDialog()
  }

  const openApprove = () => {
    const effectiveDate = isoDate(TODAY)
    setApproval({
      title: request.title,
      level: String(request.level),
      categoryId: request.categoryId,
      departmentId: request.departmentId,
      revisionNo: isObsolete ? request.currentRevisionNo : request.proposedRevisionNo,
      effectiveDate,
      reviewDate: yearAfter(effectiveDate),
      retentionPeriod: request.proposed?.retentionPeriod || linkedDocument?.retentionPeriod || RETENTION_PERIODS[2],
      description: request.proposed?.description ?? linkedDocument?.description ?? '',
      watermark: linkedDocument ? linkedDocument.watermark : DOCUMENT_RULES.dynamicWatermark,
      watermarkTemplateId: watermarkTemplateById(linkedDocument?.watermarkTemplateId)
        ? linkedDocument.watermarkTemplateId
        : DOCUMENT_RULES.defaultWatermarkTemplateId,
      signatory: user.fullName,
      position: user.position || '',
      remarks: '',
    })
    setApprovalErrors({})
    setDialog('approve')
  }

  const setField = (key) => (value) =>
    setApproval((current) => ({ ...current, [key]: value?.target ? value.target.value : value }))

  const approve = () => {
    const next = {}
    if (!approval.effectiveDate) next.effectiveDate = 'Set the effective date.'
    if (!isObsolete) {
      if (!approval.title.trim()) next.title = 'Enter the document title.'
      if (!approval.reviewDate) next.reviewDate = 'Set the next review date.'
      else if (approval.reviewDate <= approval.effectiveDate)
        next.reviewDate = 'The next review has to fall after the effective date.'
      if (isNew && documents.some((doc) => doc.code.toUpperCase() === request.documentCode.toUpperCase()))
        next.code = `${request.documentCode} has been taken by another document since this request was raised. Return the request so the originator can choose a new number.`
    }
    if (!approval.signatory.trim()) next.signatory = 'Name the authorized signatory.'
    setApprovalErrors(next)
    if (Object.keys(next).length) return

    const title = isObsolete ? request.title : approval.title.trim()
    const { documentId, disposition } = publishRequest(request, {
      actor: user,
      effectiveDate: approval.effectiveDate,
      approval: {
        signatory: approval.signatory.trim(),
        position: approval.position.trim() || null,
        remarks: approval.remarks.trim(),
      },
      metadata: {
        ...approval,
        title,
        description: approval.description.trim(),
        restoresRevisionNo: restoredRevision?.revisionNo,
      },
    })

    const documentRecord = { type: 'document', id: documentId, label: `${request.documentCode} ${title}` }
    log(user, 'Approved Document Request', 'Document', record, `${disposition}; effective ${formatDate(approval.effectiveDate)}.`)
    if (isNew) {
      log(user, 'Uploaded Document', 'Document', documentRecord, `Published from ${request.controlNo}.`)
    } else if (isObsolete) {
      log(
        user,
        'Archived Document',
        'Document',
        documentRecord,
        `Marked obsolete from ${request.controlNo}; retained for ${approval.retentionPeriod}.`,
      )
    } else {
      log(
        user,
        'Revised Document',
        'Document',
        documentRecord,
        `Revision ${approval.revisionNo} released from ${request.controlNo}${
          restoredRevision ? `, restoring the file of revision ${restoredRevision.revisionNo}` : ''
        }; previous revision retained as obsolete.`,
      )
    }
    notify(
      request.originator.accountId,
      NOTIFICATION_TYPE.DOC_REQUEST_APPROVED,
      `${request.controlNo} approved`,
      `${disposition}, effective ${formatDate(approval.effectiveDate)}.`,
      { type: 'request', id: request.id },
    )
    /* The department that owns the document hears about a change someone else raised. */
    const owner = departmentAccount(isObsolete ? request.departmentId : approval.departmentId)
    if (owner && owner.status === ACCOUNT_STATUS.ACTIVE && owner.id !== request.originator.accountId) {
      notify(
        owner.id,
        NOTIFICATION_TYPE.DOCUMENT_CHANGED,
        isObsolete
          ? `${request.documentCode} made obsolete`
          : isNew
            ? `${request.documentCode} published`
            : `${request.documentCode} revision ${approval.revisionNo} released`,
        `${title}: ${disposition.charAt(0).toLowerCase()}${disposition.slice(1)}, effective ${formatDate(approval.effectiveDate)} (${request.controlNo}).`,
        { type: 'request', id: request.id },
      )
    }
    setDialog(null)
  }

  /* The DRCN calls for a CAR when a review runs past its limit. The system only
     prepares one; QMS decides whether to issue it. */
  const issueCarForLateReview = () => {
    const qmsDepartment = departments.find((dept) => dept.code === 'QMS')
    const query = new URLSearchParams({
      source: 'QSD',
      department: qmsDepartment?.id || '',
      deviation: `${request.controlNo} was not decided within the maximum review time of ${limitText(rule)} (due ${formatDate(request.reviewDueDate)}).`,
      description: `${request.type} request for ${request.documentCode} ${request.title}, received ${formatDateTime(request.receivedAt)}. The Document Review / Change Notice requires a CAR when the maximum review time is not met.`,
    })
    navigate(`${ROUTES.carIssue}?${query}`)
  }

  /* ------------------------------------------------------------ versions */

  /* Departments see the ACTIVE revision only; QMS Admins and Dev see every one. */
  const allRevisions = request.documentId ? revisionsForDocument(request.documentId) : []
  const revisions = request.documentId ? revisionsForUser(user, request.documentId) : []
  const earlierHidden = allRevisions.length > revisions.length
  /* Until it is approved, the version this request would release sits on top as a proposal. */
  const proposed =
    !isObsolete && !allRevisions.some((revision) => revision.requestId === request.id)
      ? {
          id: 'proposed',
          proposed: true,
          revisionNo: request.proposedRevisionNo,
          effectiveDate: null,
          revisedBy: request.originator.accountId,
          revisionDate: request.submittedAt,
          changeSummary: request.reason,
          fileName: request.fileName,
          restoredFrom: request.restoresRevisionId || null,
        }
      : null
  const versions = proposed ? [proposed, ...revisions] : revisions
  const viewingIndex = versions.findIndex((version) => version.id === viewingId)
  const viewing = viewingIndex >= 0 ? versions[viewingIndex] : null
  const requestById = (requestId) => documentRequests.find((item) => item.id === requestId) || null
  const revisionById = (revisionId) => documentRevisions.find((item) => item.id === revisionId) || null

  const versionBadges = (version) => (
    <>
      {version.proposed ? (
        <StatusBadge
          status={request.status}
          label={REQUEST_OPEN_STATUSES.includes(request.status) ? 'Proposed' : 'Not released'}
        />
      ) : (
        <StatusBadge status={version.status} />
      )}
      {(version.proposed || version.requestId === request.id) && (
        <Badge size="sm" color="brand">
          This request
        </Badge>
      )}
      {!version.proposed && version.id === request.restoresRevisionId && (
        <Badge size="sm" color="blue">
          Being restored
        </Badge>
      )}
    </>
  )

  const versionItems = versions.map((version) => {
    const restoredFrom = version.restoredFrom ? revisionById(version.restoredFrom) : null
    const viaRequest = version.requestId && version.requestId !== request.id ? requestById(version.requestId) : null
    return {
      id: version.id,
      icon: version.proposed ? Edit03 : RefreshCcw01,
      color: version.proposed ? 'brand' : version.status === DOC_STATUS.ACTIVE ? 'success' : 'gray',
      title: (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-primary">Revision {version.revisionNo}</span>
          <span>{version.effectiveDate ? `effective ${formatDate(version.effectiveDate)}` : 'not yet effective'}</span>
          {versionBadges(version)}
        </span>
      ),
      description: version.changeSummary,
      meta: [
        userName(version.revisedBy),
        formatDateTime(version.revisionDate),
        version.fileName,
        viaRequest?.controlNo,
        restoredFrom && `restores revision ${restoredFrom.revisionNo}`,
      ]
        .filter(Boolean)
        .join(' · '),
      action: (
        <Button color="link-color" size="sm" iconLeading={Eye} onClick={() => setViewingId(version.id)}>
          View version
        </Button>
      ),
    }
  })

  const historyItems = [...(request.history || [])].reverse().map((entry, position) => {
    const meta = HISTORY[entry.action] || { icon: InfoCircle, color: 'gray', phrase: entry.action.toLowerCase() }
    return {
      id: `${entry.at}-${position}`,
      icon: meta.icon,
      color: meta.color,
      title: (
        <>
          <span className="font-semibold text-primary">{userName(entry.personnelId || entry.by)}</span> {meta.phrase}
        </>
      ),
      description: entry.notes || undefined,
      meta: entry.personnelId ? `${formatDateTime(entry.at)} · via ${userName(entry.by)}` : formatDateTime(entry.at),
    }
  })

  const urgent = request.processType === PROCESS_TYPE.URGENT

  return (
    <Page>
      <PageHeader
        title={request.controlNo}
        subtitle={`${request.type} request · ${request.documentCode} ${request.title}`}
        actions={
          <>
            <Button color="secondary" size="md" iconLeading={ArrowLeft} onClick={() => navigate(ROUTES.requests)}>
              Back
            </Button>
            <Button color="secondary" size="md" iconLeading={Printer} onClick={() => window.print()}>
              Print
            </Button>
            {canCancel && (
              <Button color="secondary" size="md" iconLeading={XCircle} onClick={() => setDialog('cancel')}>
                Cancel request
              </Button>
            )}
            {canResubmit && (
              <Button color="primary" size="md" iconLeading={Edit03} onClick={() => navigate(path.requestEdit(request.id))}>
                Edit and resubmit
              </Button>
            )}
            {canStart && (
              <Button color="primary" size="md" iconLeading={Eye} onClick={startReview}>
                Start review
              </Button>
            )}
            {canDecide && (
              <>
                <Button color="secondary" size="md" iconLeading={ReverseLeft} onClick={() => setDialog('return')}>
                  Return for revision
                </Button>
                <Button color="secondary-destructive" size="md" iconLeading={XCircle} onClick={() => setDialog('disapprove')}>
                  Disapprove
                </Button>
                <Button color="primary" size="md" iconLeading={Check} onClick={openApprove}>
                  Approve and publish
                </Button>
              </>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={request.status} size="md" />
          <Badge size="sm" color="gray" type="modern">
            {request.type}
          </Badge>
          <Badge size="sm" color={urgent ? 'error' : 'gray'} type={urgent ? 'pill-color' : 'modern'}>
            {request.processType}
          </Badge>
          <Badge size="sm" color="gray" type="modern">
            Level {request.level}
          </Badge>
          {late && (
            <Badge size="sm" color="error">
              Past review limit
            </Badge>
          )}
        </div>
      </PageHeader>

      {/* ----------------------------------------------------------- callouts */}
      {late && (
        <Callout
          tone="error"
          icon={AlertTriangle}
          title="Past the maximum review time"
          actions={
            can(PERMISSION.CAR_ISSUE) && (
              <Button color="secondary" size="sm" onClick={issueCarForLateReview}>
                Issue CAR for the late review
              </Button>
            )
          }
        >
          The limit of {limitText(rule)} ended on {formatDate(request.reviewDueDate)}, {plural(Math.abs(daysLeft), 'day')}{' '}
          ago. The form calls for a CAR when a review limit isn’t met; the system leaves that decision to QMS.
        </Callout>
      )}

      {request.status === REQUEST_STATUS.RETURNED && request.returned && (
        <Callout
          tone="warning"
          icon={ReverseLeft}
          title={`Returned for revision by ${userName(request.returned.by)} on ${formatDate(request.returned.at)}`}
        >
          {request.returned.notes}
        </Callout>
      )}

      {request.status === REQUEST_STATUS.DISAPPROVED && request.approval && (
        <Callout
          tone="error"
          icon={XCircle}
          title={`Disapproved by ${userName(request.approval.approvedBy)} on ${formatDate(request.approval.date)}`}
        >
          {request.approval.remarks}
        </Callout>
      )}

      {request.status === REQUEST_STATUS.CANCELLED && request.cancelled && (
        <Callout
          tone="gray"
          icon={XCircle}
          title={`Cancelled by ${userName(request.cancelled.by)} on ${formatDate(request.cancelled.at)}`}
        >
          {request.cancelled.reason || 'No reason was given.'}
        </Callout>
      )}

      {request.status === REQUEST_STATUS.APPROVED && request.dcc && (
        <Callout
          tone="success"
          icon={CheckCircle}
          title={request.dcc.disposition}
          actions={
            linkedDocument && (
              <Link to={path.document(linkedDocument.id)} className="text-sm font-semibold hover:underline">
                Open {linkedDocument.code}
              </Link>
            )
          }
        >
          Approved by {userName(request.approval?.approvedBy)} on {formatDate(request.approval?.date)}, effective{' '}
          {formatDate(request.dcc.effectiveDate)}.
        </Callout>
      )}

      {ownRequest && (
        <Callout tone="gray" icon={Shield01} title="Another QMS Admin has to decide this one">
          Your account raised this request, so the review and the decision have to come from someone else.
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Card bodyClassName="flex flex-col gap-8 py-6">
            <Section title="Notice">
              <KeyValue
                items={[
                  { k: 'DRCN control no.', v: request.controlNo, mono: true },
                  { k: 'Date issued', v: formatDate(request.submittedAt) },
                  { k: 'This notice is given for', v: request.type },
                  { k: 'Process type', v: request.processType },
                  { k: 'Maximum review time', v: rule ? `${limitText(rule)} — ${rule.condition}` : null },
                ]}
              />
            </Section>

            <Section title="Document">
              <KeyValue
                items={[
                  { k: 'Document title', v: request.title },
                  {
                    k: 'Document no.',
                    v: linkedDocument ? (
                      <Link to={path.document(linkedDocument.id)} className="font-mono text-brand-secondary hover:underline">
                        {request.documentCode}
                      </Link>
                    ) : (
                      <span className="font-mono">{request.documentCode}</span>
                    ),
                  },
                  {
                    k: 'Revision no.',
                    v: isObsolete
                      ? request.currentRevisionNo
                      : isNew
                        ? request.proposedRevisionNo
                        : `${request.currentRevisionNo} → ${request.proposedRevisionNo}`,
                  },
                  { k: 'Page affected', v: request.pageAffected },
                  ...(restoredRevision
                    ? [{ k: 'Restores', v: `Revision ${restoredRevision.revisionNo} — ${restoredRevision.fileName}` }]
                    : []),
                  {
                    k: 'Document level',
                    v: `${docLevelLabel(request.level)}${request.levelSpecify ? ` (${request.levelSpecify})` : ''}`,
                  },
                  { k: 'Category', v: categoryName(request.categoryId) },
                  { k: 'Department / Section', v: deptName(request.departmentId) },
                  ...(request.proposed ? [{ k: 'Retention period', v: request.proposed.retentionPeriod }] : []),
                  ...(request.fileName
                    ? [
                        {
                          k: 'Draft file',
                          v: (
                            <span className="inline-flex min-w-0 items-center gap-2">
                              <FileTypeIcon fileName={request.fileName} size={24} />
                              <span className="truncate">{request.fileName}</span>
                            </span>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </Section>

            <Section title="Originator (process owner)">
              <KeyValue
                items={[
                  { k: 'Name', v: userName(request.originator.personnelId || request.originator.accountId) },
                  { k: 'Position', v: request.originator.position },
                  {
                    k: 'Department / Section',
                    v: originatorAccount?.departmentId ? deptName(originatorAccount.departmentId) : null,
                  },
                  ...(request.originator.personnelId
                    ? [{ k: 'Submitted from account', v: originatorAccount?.fullName }]
                    : []),
                  { k: 'Reason for review / change', v: request.reason },
                ]}
              />
            </Section>

            <Section title="Review" subtitle="Immediate superior or concerned department head">
              <KeyValue
                items={[
                  { k: 'Name', v: request.reviewer ? userName(request.reviewer.personnelId) : null },
                  { k: 'Position', v: request.reviewer?.position },
                  { k: 'Date', v: request.reviewer?.date ? formatDate(request.reviewer.date) : null },
                ]}
              />
            </Section>

            <Section title="Approval" subtitle="Decided by a QMS Admin">
              <KeyValue
                items={[
                  { k: 'Decision', v: request.approval ? <StatusTag status={request.approval.decision} /> : null },
                  { k: 'Decided by', v: request.approval ? userName(request.approval.approvedBy) : null },
                  { k: 'Authorized signatory', v: request.approval?.signatory },
                  { k: 'Position', v: request.approval?.position },
                  { k: 'Date', v: request.approval?.date ? formatDate(request.approval.date) : null },
                  { k: 'Remarks', v: request.approval?.remarks },
                ]}
              />
            </Section>

            <Section title="For DCC remarks">
              <KeyValue
                items={[
                  { k: 'Disposition', v: request.dcc?.disposition },
                  { k: 'Effective date', v: request.dcc?.effectiveDate ? formatDate(request.dcc.effectiveDate) : null },
                ]}
              />
            </Section>
          </Card>

          {/* ------------------------------------------------------ revision history */}
          <Card
            title="Revision history"
            subtitle={
              isNew
                ? `A new document has no earlier versions; revision ${request.proposedRevisionNo} will be its first.`
                : earlierHidden
                  ? 'The current approved revision. Earlier revisions are kept on record for QMS Admins.'
                  : `Every version of ${request.documentCode}, newest first. Earlier versions stay on record as obsolete.`
            }
          >
            {versionItems.length ? (
              <ActivityFeed items={versionItems} />
            ) : (
              <PageState icon={Clock} size="sm" title="No revision history recorded" />
            )}
          </Card>
        </div>

        {/* ------------------------------------------------------------ side rail */}
        <div className="flex flex-col gap-4">
          <Card title="Review time">
            {inQueue ? (
              <div className="mb-4">
                <p className={cx('text-display-xs font-semibold', late ? 'text-error-primary' : 'text-primary')}>
                  {late
                    ? `${plural(Math.abs(daysLeft), 'day')} late`
                    : daysLeft === 0
                      ? 'Due today'
                      : `${plural(daysLeft, 'day')} left`}
                </p>
                <p className="text-sm text-tertiary">Decision due by {formatDate(request.reviewDueDate)}</p>
              </div>
            ) : (
              <p className="mb-4 text-sm text-tertiary">
                {request.status === REQUEST_STATUS.RETURNED
                  ? 'Paused while the request is with the originator. The clock restarts when it is resubmitted.'
                  : 'The review is finished.'}
              </p>
            )}
            <KeyValue
              items={[
                { k: 'Received', v: formatDateTime(request.receivedAt) },
                { k: 'Limit', v: limitText(rule) },
                { k: 'Due', v: formatDate(request.reviewDueDate) },
                { k: 'Reviewed by', v: request.reviewedBy ? userName(request.reviewedBy) : null },
              ]}
            />
          </Card>

          <Card title="History" subtitle={plural(request.history?.length || 0, 'step')}>
            {historyItems.length ? (
              <ActivityFeed items={historyItems} />
            ) : (
              <PageState icon={InfoCircle} size="sm" title="No history recorded" />
            )}
          </Card>

          {linkedDocument && (
            <Card title="Controlled document">
              <div className="flex items-center gap-3">
                <FileTypeIcon fileName={linkedDocument.fileName} fileType={linkedDocument.fileType} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-primary">
                    {linkedDocument.code} — {linkedDocument.title}
                  </p>
                  <p className="text-xs text-tertiary">
                    Revision {linkedDocument.revisionNo} · {linkedDocument.status}
                  </p>
                </div>
              </div>
              <Button
                color="secondary"
                size="sm"
                className="mt-4 w-full"
                onClick={() => navigate(path.document(linkedDocument.id))}
              >
                Open document
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* ============================== dialogs =============================== */}

      <AppDialog
        isOpen={Boolean(viewing)}
        onClose={() => setViewingId(null)}
        size="md"
        icon={viewing?.proposed ? Edit03 : RefreshCcw01}
        iconColor={viewing?.proposed ? 'brand' : viewing?.status === DOC_STATUS.ACTIVE ? 'success' : 'gray'}
        title={viewing ? `Revision ${viewing.revisionNo}` : ''}
        subtitle={`${request.documentCode} ${request.title} · version ${versions.length - viewingIndex} of ${versions.length}`}
        footer={
          <>
            <Button
              color="secondary"
              size="md"
              iconLeading={ArrowLeft}
              isDisabled={viewingIndex >= versions.length - 1}
              onClick={() => setViewingId(versions[viewingIndex + 1].id)}
            >
              Older
            </Button>
            <Button
              color="secondary"
              size="md"
              iconTrailing={ArrowRight}
              isDisabled={viewingIndex <= 0}
              onClick={() => setViewingId(versions[viewingIndex - 1].id)}
            >
              Newer
            </Button>
            <Button color="primary" size="md" onClick={() => setViewingId(null)}>
              Close
            </Button>
          </>
        }
      >
        {viewing && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">{versionBadges(viewing)}</div>
            {viewing.fileName && (
              <div className="flex items-center gap-3 rounded-lg p-3 ring-1 ring-secondary">
                <FileTypeIcon fileName={viewing.fileName} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-primary">{viewing.fileName}</p>
                  <p className="text-xs text-tertiary">
                    {viewing.proposed ? 'Draft attached to this request' : 'Retained copy of this revision'}
                  </p>
                </div>
              </div>
            )}
            <KeyValue
              items={[
                { k: 'Revision no.', v: viewing.revisionNo, mono: true },
                {
                  k: 'Effective date',
                  v: viewing.effectiveDate ? formatDate(viewing.effectiveDate) : 'Set when a QMS Admin approves the request',
                },
                { k: viewing.proposed ? 'Proposed by' : 'Revised by', v: userName(viewing.revisedBy) },
                { k: viewing.proposed ? 'Submitted' : 'Revision date', v: formatDateTime(viewing.revisionDate) },
                { k: viewing.proposed ? 'Reason for change' : 'Change summary', v: viewing.changeSummary },
                ...(viewing.restoredFrom
                  ? [{ k: 'Restores', v: `Revision ${revisionById(viewing.restoredFrom)?.revisionNo}` }]
                  : []),
                ...(viewing.requestId
                  ? [
                      {
                        k: 'Released via',
                        v:
                          viewing.requestId === request.id ? (
                            <span className="font-mono">{request.controlNo}</span>
                          ) : (
                            <Link
                              to={path.request(viewing.requestId)}
                              className="font-mono text-brand-secondary hover:underline"
                            >
                              {requestById(viewing.requestId)?.controlNo}
                            </Link>
                          ),
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        )}
      </AppDialog>

      <AppDialog
        isOpen={dialog === 'return'}
        onClose={closeDialog}
        size="md"
        icon={ReverseLeft}
        iconColor="warning"
        title="Return for revision"
        subtitle={request.controlNo}
        footer={
          <>
            <Button color="secondary" size="md" onClick={closeDialog}>
              Cancel
            </Button>
            <Button color="primary" size="md" iconLeading={ReverseLeft} isDisabled={!notes.trim()} onClick={returnRequest}>
              Return to {originatorAccount?.fullName || 'the originator'}
            </Button>
          </>
        }
      >
        <TextArea
          label="What needs to change"
          isRequired
          rows={5}
          value={notes}
          onChange={setNotes}
          hint="Sent to the originator. The review clock stops until they resubmit."
          placeholder="e.g. Add the drawing number and revision to each photo."
        />
      </AppDialog>

      <AppDialog
        isOpen={dialog === 'disapprove'}
        onClose={closeDialog}
        size="md"
        icon={XCircle}
        iconColor="error"
        title="Disapprove request"
        subtitle={request.controlNo}
        footer={
          <>
            <Button color="secondary" size="md" onClick={closeDialog}>
              Cancel
            </Button>
            <Button color="primary-destructive" size="md" iconLeading={XCircle} isDisabled={!notes.trim()} onClick={disapprove}>
              Disapprove
            </Button>
          </>
        }
      >
        <TextArea
          label="Reason for disapproval"
          isRequired
          rows={5}
          value={notes}
          onChange={setNotes}
          hint="Recorded as the approval remarks and sent to the originator. A disapproved request is closed; a fresh request is needed to try again."
        />
      </AppDialog>

      <AppDialog
        isOpen={dialog === 'cancel'}
        onClose={closeDialog}
        size="sm"
        icon={XCircle}
        iconColor="warning"
        title="Cancel request"
        subtitle={request.controlNo}
        footer={
          <>
            <Button color="secondary" size="md" onClick={closeDialog}>
              Keep request
            </Button>
            <Button color="primary-destructive" size="md" iconLeading={XCircle} onClick={cancel}>
              Cancel request
            </Button>
          </>
        }
      >
        <TextArea
          label="Reason"
          rows={3}
          value={notes}
          onChange={setNotes}
          hint="Optional. The request stays on record as cancelled."
        />
      </AppDialog>

      <AppDialog
        isOpen={dialog === 'approve' && Boolean(approval)}
        onClose={() => setDialog(null)}
        size="lg"
        icon={CheckCircle}
        iconColor="success"
        title={isObsolete ? 'Approve and archive' : 'Approve and publish'}
        subtitle={`${request.controlNo} — ${request.type} ${request.documentCode}`}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button color="primary" size="md" iconLeading={Check} onClick={approve}>
              {isObsolete ? 'Approve and archive' : 'Approve and publish'}
            </Button>
          </>
        }
      >
        {approval && (
          <div className="flex flex-col gap-5">
            {approvalErrors.code && (
              <Callout tone="error" icon={AlertTriangle}>
                {approvalErrors.code}
              </Callout>
            )}

            <Callout tone="brand" icon={InfoCircle}>
              {isNew
                ? `${request.documentCode} is published as a new ACTIVE document at revision ${approval.revisionNo}.`
                : isObsolete
                  ? `${request.documentCode} is marked obsolete and archived for its retention period of ${approval.retentionPeriod}. Nothing is deleted.`
                  : `Revision ${approval.revisionNo} of ${request.documentCode} becomes ACTIVE${
                      restoredRevision ? ` with the file of revision ${restoredRevision.revisionNo}` : ''
                    }, and revision ${request.currentRevisionNo} is kept as obsolete.`}
            </Callout>

            <ContentDivider>For DCC remarks</ContentDivider>
            <FormGrid>
              <Input
                label="Effective date"
                type="date"
                isRequired
                isInvalid={Boolean(approvalErrors.effectiveDate)}
                hint={approvalErrors.effectiveDate}
                value={approval.effectiveDate}
                onChange={setField('effectiveDate')}
              />
              {!isObsolete && (
                <Input
                  label="Next review date"
                  type="date"
                  isRequired
                  isInvalid={Boolean(approvalErrors.reviewDate)}
                  hint={approvalErrors.reviewDate}
                  value={approval.reviewDate}
                  onChange={setField('reviewDate')}
                />
              )}
            </FormGrid>

            {!isObsolete && (
              <>
                <ContentDivider>Document record</ContentDivider>
                <FormGrid>
                  <FormSpan>
                    <Input
                      label="Document title"
                      isRequired
                      isInvalid={Boolean(approvalErrors.title)}
                      hint={approvalErrors.title}
                      value={approval.title}
                      onChange={setField('title')}
                    />
                  </FormSpan>
                  <Input label="Document no." value={request.documentCode} isReadOnly inputClassName="font-mono" />
                  <Input label="Revision no." value={approval.revisionNo} isReadOnly inputClassName="font-mono" />
                  <NativeSelect
                    label="Document level"
                    value={approval.level}
                    onChange={setField('level')}
                    options={DOC_LEVELS.map(({ value, label }) => ({ value: String(value), label: `Level ${value} — ${label}` }))}
                  />
                  <NativeSelect
                    label="Retention period"
                    value={approval.retentionPeriod}
                    onChange={setField('retentionPeriod')}
                    options={RETENTION_PERIODS.map((period) => ({ value: period, label: period }))}
                  />
                  {isNew && (
                    <>
                      <NativeSelect
                        label="Category"
                        value={approval.categoryId}
                        onChange={setField('categoryId')}
                        options={documentCategories
                          .filter((category) => category.status !== 'Inactive' || category.id === approval.categoryId)
                          .map((category) => ({ value: category.id, label: category.name }))}
                      />
                      <NativeSelect
                        label="Department / Section"
                        value={approval.departmentId}
                        onChange={setField('departmentId')}
                        options={departments.map((dept) => ({ value: dept.id, label: dept.name }))}
                      />
                    </>
                  )}
                  <FormSpan>
                    <TextArea label="Description" rows={2} value={approval.description} onChange={setField('description')} />
                  </FormSpan>
                </FormGrid>
                <Checkbox
                  label="Apply a dynamic watermark to downloaded copies"
                  hint="Each document can carry its own watermark template."
                  isSelected={approval.watermark}
                  onChange={setField('watermark')}
                />
                {approval.watermark && (
                  <NativeSelect
                    label="Watermark template"
                    value={approval.watermarkTemplateId}
                    onChange={setField('watermarkTemplateId')}
                    hint={`Stamped as: ${renderWatermark(watermarkTemplateById(approval.watermarkTemplateId)?.template, {
                      ...WATERMARK_SAMPLE,
                      DOC_CODE: request.documentCode,
                      REVISION: approval.revisionNo,
                    })}`}
                    options={DOCUMENT_RULES.watermarkTemplates.map((template) => ({ value: template.id, label: template.name }))}
                  />
                )}
              </>
            )}

            <ContentDivider>Approval</ContentDivider>
            <FormGrid>
              <Input
                label="Authorized signatory"
                isRequired
                isInvalid={Boolean(approvalErrors.signatory)}
                hint={approvalErrors.signatory || 'Recorded on the notice as the approving signature.'}
                value={approval.signatory}
                onChange={setField('signatory')}
              />
              <Input label="Position" value={approval.position} onChange={setField('position')} />
              <FormSpan>
                <TextArea
                  label="Remarks"
                  rows={3}
                  value={approval.remarks}
                  onChange={setField('remarks')}
                  placeholder="Optional"
                />
              </FormSpan>
            </FormGrid>
          </div>
        )}
      </AppDialog>
    </Page>
  )
}
