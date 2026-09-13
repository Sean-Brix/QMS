/* ============================================================================
   New document request — the Document Review / Change Notice (F-DCC-001) online.
   ----------------------------------------------------------------------------
   Laid out in the order of the paper form: the notice, the document, the
   originator and the reason, and the department head's review. The approval
   and DCC blocks are completed by a QMS Admin on the request itself.
   The same screen edits a request that was returned for revision.
   ========================================================================== */

import { useState } from 'react'
import { AlertTriangle, ArrowLeft, InfoCircle, ReverseLeft, Send01 } from '@untitledui/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Callout,
  Card,
  ChoiceRow,
  FileTypeIcon,
  FileUpload,
  FormGrid,
  FormSpan,
  Input,
  KeyValue,
  NativeSelect,
  PageState,
  Section,
  TextArea,
  cx,
} from '@/components/ui'
import { DOCUMENT_RULES } from '@/config/appConfig'
import {
  DOC_LEVELS,
  DOC_STATUS,
  NOTIFICATION_TYPE,
  ORG_WIDE_ROLES,
  PROCESS_TYPE,
  PROCESS_TYPE_LIST,
  REQUEST_OPEN_STATUSES,
  REQUEST_STATUS,
  REQUEST_TYPE,
  REQUEST_TYPE_HINT,
  REQUEST_TYPE_LIST,
  RETENTION_PERIODS,
} from '@/config/constants'
import { ROUTES, path } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { TODAY, formatDate, isoDate, timestamp } from '@/utils/format'
import { limitText, requestLabel, reviewDueDateFor, reviewLimitFor } from '@/utils/requests'

const isNumbered = (revision) => /^\d+$/.test(String(revision ?? ''))
const nextRevision = (revision) => (isNumbered(revision) ? String(Number(revision) + 1) : '')

/** The document fields a request starts with: taken from the chosen document, or blank for a new one. */
function documentFields(type, doc, departmentId) {
  if (type === REQUEST_TYPE.NEW || !doc) {
    return {
      documentId: '',
      title: '',
      documentCode: '',
      proposedRevisionNo: type === REQUEST_TYPE.NEW ? '0' : '',
      pageAffected:
        type === REQUEST_TYPE.NEW ? 'All (new document)' : type === REQUEST_TYPE.OBSOLETE ? 'Whole document' : '',
      level: '',
      categoryId: '',
      departmentId: type === REQUEST_TYPE.NEW ? departmentId || '' : '',
      retentionPeriod: RETENTION_PERIODS[2],
      description: '',
    }
  }
  return {
    documentId: doc.id,
    title: doc.title,
    documentCode: doc.code,
    proposedRevisionNo: type === REQUEST_TYPE.REVISE ? nextRevision(doc.revisionNo) : '',
    pageAffected: type === REQUEST_TYPE.OBSOLETE ? 'Whole document' : '',
    level: String(doc.level),
    categoryId: doc.categoryId,
    departmentId: doc.departmentId,
    retentionPeriod: doc.retentionPeriod,
    description: doc.description,
  }
}

export default function NewRequest() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    documents,
    documentCategories,
    departments,
    documentRequests,
    documentRevisions,
    categoryName,
    deptName,
    userName,
    personById,
    personnelForDepartment,
    requestForUser,
    openRequestForDocument,
    addRequest,
    patchRequest,
    nextRequestNumber,
    qmsUsers,
    log,
    notify,
  } = useData()

  const editing = id ? requestForUser(user, id) : null
  const canEdit = Boolean(editing) && editing.status === REQUEST_STATUS.RETURNED && editing.originator.accountId === user.id

  /* The originator and the reviewer are people from the requesting account's own department. */
  const people = user.departmentId ? personnelForDepartment(user.departmentId) : []
  const self = people.find((person) => person.fullName === user.fullName)

  const [form, setForm] = useState(() => {
    if (editing) {
      return {
        type: editing.type,
        processType: editing.processType,
        documentId: editing.documentId || '',
        title: editing.title,
        documentCode: editing.documentCode,
        proposedRevisionNo: editing.proposedRevisionNo || '',
        pageAffected: editing.pageAffected || '',
        level: String(editing.level),
        levelSpecify: editing.levelSpecify || '',
        categoryId: editing.categoryId,
        departmentId: editing.departmentId,
        retentionPeriod: editing.proposed?.retentionPeriod || RETENTION_PERIODS[2],
        description: editing.proposed?.description || '',
        reason: editing.reason,
        originatorId: editing.originator.personnelId || '',
        reviewerId: editing.reviewer?.personnelId || '',
        reviewedOn: editing.reviewer?.date || isoDate(TODAY),
        fileName: editing.fileName || '',
        restoresRevisionId: editing.restoresRevisionId || null,
      }
    }
    /* Opened from a document page: "Request revision" / "Request obsoletion". */
    const type = REQUEST_TYPE_LIST.includes(params.get('type')) ? params.get('type') : REQUEST_TYPE.NEW
    const requested = documents.find(
      (doc) => doc.id === params.get('document') && doc.status === DOC_STATUS.ACTIVE && !openRequestForDocument(doc.id),
    )
    /* "Restore this revision" raises a revision that brings back an older file,
       keeping every revision in between on record (follow-up B10). */
    const restored =
      requested && type === REQUEST_TYPE.REVISE && ORG_WIDE_ROLES.includes(user.role)
        ? documentRevisions.find(
            (revision) =>
              revision.id === params.get('restore') &&
              revision.documentId === requested.id &&
              revision.status === DOC_STATUS.OBSOLETE,
          )
        : null
    return {
      type,
      processType: PROCESS_TYPE.REGULAR,
      ...documentFields(type, requested, user.departmentId),
      ...(restored ? { pageAffected: 'Whole document' } : {}),
      levelSpecify: '',
      reason: restored ? `Restore revision ${restored.revisionNo}: ` : '',
      originatorId: self?.id || '',
      reviewerId: '',
      reviewedOn: isoDate(TODAY),
      fileName: restored?.fileName || '',
      restoresRevisionId: restored?.id || null,
    }
  })
  const [errors, setErrors] = useState({})

  if (id && !canEdit) {
    return (
      <Page>
        <PageState
          icon={AlertTriangle}
          title="This request can’t be edited"
          text={
            editing
              ? 'Only the account that raised a request can change it, and only once it has been returned for revision.'
              : 'This request does not exist or is outside your access.'
          }
          action={
            <Button color="secondary" onClick={() => navigate(editing ? path.request(editing.id) : ROUTES.requests)}>
              {editing ? 'Back to the request' : 'Back to requests'}
            </Button>
          }
        />
      </Page>
    )
  }

  const isNew = form.type === REQUEST_TYPE.NEW
  const isRevise = form.type === REQUEST_TYPE.REVISE
  const isObsolete = form.type === REQUEST_TYPE.OBSOLETE
  const target = documents.find((doc) => doc.id === form.documentId) || null

  /* A document with an undecided request can't be given a second one. */
  const hasOtherOpenRequest = (doc) => Boolean(openRequestForDocument(doc.id)) && doc.id !== editing?.documentId
  const activeDocuments = documents.filter((doc) => doc.status === DOC_STATUS.ACTIVE)
  const eligible = activeDocuments.filter((doc) => !hasOtherOpenRequest(doc)).sort((a, b) => a.code.localeCompare(b.code))
  const heldBack = activeDocuments.length - eligible.length

  const revisionLocked = isNew || isObsolete || isNumbered(target?.revisionNo)
  const rule = reviewLimitFor({ processType: form.processType, level: form.level })
  const dueIfSubmittedToday = reviewDueDateFor({ processType: form.processType, level: form.level }, TODAY)
  const originator = personById(form.originatorId)
  const reviewer = personById(form.reviewerId)
  const controlNo = editing ? editing.controlNo : nextRequestNumber()
  const restoredRevision = form.restoresRevisionId
    ? documentRevisions.find((revision) => revision.id === form.restoresRevisionId)
    : null

  /** React Aria fields hand back the value; native selects hand back an event. */
  const set = (key) => (value) =>
    setForm((current) => ({ ...current, [key]: value?.target ? value.target.value : value }))

  const chooseType = (type) =>
    setForm((current) => ({
      ...current,
      type,
      ...documentFields(type, null, user.departmentId),
      restoresRevisionId: null,
    }))

  const chooseDocument = (event) => {
    const doc = documents.find((item) => item.id === event.target.value)
    setForm((current) => ({
      ...current,
      ...documentFields(current.type, doc, user.departmentId),
      restoresRevisionId: null,
    }))
  }

  const personOptions = [
    { value: '', label: 'Select person…' },
    ...people.map((person) => ({ value: person.id, label: `${person.fullName} — ${person.position}` })),
  ]

  const validate = () => {
    const next = {}
    if (!isNew && !target) next.documentId = `Choose the document to ${isObsolete ? 'make obsolete' : 'revise'}.`
    if (!isObsolete && !form.title.trim()) next.title = 'Enter the document title.'

    if (isNew) {
      const code = form.documentCode.trim().toUpperCase()
      const inUse = documents.find((doc) => doc.code.toUpperCase() === code)
      const proposedElsewhere = documentRequests.find(
        (request) =>
          request.id !== editing?.id &&
          request.type === REQUEST_TYPE.NEW &&
          REQUEST_OPEN_STATUSES.includes(request.status) &&
          request.documentCode.toUpperCase() === code,
      )
      if (!code) next.documentCode = 'Enter the document number.'
      else if (inUse) next.documentCode = `${code} is already used by “${inUse.title}”. Document numbers are unique across the company.`
      else if (proposedElsewhere) next.documentCode = `${code} is already proposed in ${proposedElsewhere.controlNo}.`
      if (!form.categoryId) next.categoryId = 'Choose a category.'
      if (!form.departmentId) next.departmentId = 'Choose the department that owns the document.'
    }

    if (isRevise && !form.proposedRevisionNo.trim()) next.proposedRevisionNo = 'Enter the new revision.'
    if (isRevise && !form.pageAffected.trim()) next.pageAffected = 'Say which pages or sections change.'
    if (!form.level) next.level = 'Choose the document level.'
    else if (Number(form.level) === 3 && !form.levelSpecify.trim())
      next.levelSpecify = 'Specify the kind of supporting document.'
    if (!isObsolete && !form.fileName) next.fileName = `Attach the draft ${isNew ? 'document' : 'revision'}.`
    if (!form.reason.trim()) next.reason = 'Give the reason for the review or change.'
    if (people.length && !form.originatorId) next.originatorId = 'Choose the process owner raising this request.'
    if (people.length > 1 && !form.reviewerId)
      next.reviewerId = 'Choose the department head or immediate superior who reviewed it.'
    else if (form.reviewerId && form.reviewerId === form.originatorId)
      next.reviewerId = 'The review has to come from someone other than the originator.'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = () => {
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const stamp = timestamp()
    const level = Number(form.level)
    const fields = {
      type: form.type,
      documentId: isNew ? null : target.id,
      documentCode: isNew ? form.documentCode.trim().toUpperCase() : target.code,
      title: isObsolete ? target.title : form.title.trim(),
      currentRevisionNo: isNew ? null : target.revisionNo,
      proposedRevisionNo: isObsolete ? null : form.proposedRevisionNo.trim(),
      pageAffected: form.pageAffected.trim(),
      level,
      levelSpecify: level === 3 ? form.levelSpecify.trim() : null,
      processType: form.processType,
      /* One notice covers one document until the client confirms multi-document notices. */
      documentCount: 1,
      categoryId: isNew ? form.categoryId : target.categoryId,
      departmentId: isNew ? form.departmentId : target.departmentId,
      reason: form.reason.trim(),
      originator: {
        accountId: user.id,
        personnelId: form.originatorId || null,
        position: originator?.position || user.position || null,
      },
      reviewer: form.reviewerId
        ? { personnelId: form.reviewerId, position: reviewer?.position || null, date: form.reviewedOn }
        : null,
      proposed: isObsolete ? null : { retentionPeriod: form.retentionPeriod, description: form.description.trim() },
      fileName: isObsolete ? null : form.fileName,
      restoresRevisionId: form.restoresRevisionId || null,
      /* Submitting hands the endorsed notice to QMS, so the review clock starts now. */
      submittedAt: stamp,
      receivedAt: stamp,
      reviewDueDate: reviewDueDateFor({ processType: form.processType, level }, stamp),
    }
    const performer = form.originatorId || null
    const reviewers = qmsUsers.filter((admin) => admin.id !== user.id)
    const due = formatDate(fields.reviewDueDate)

    if (editing) {
      patchRequest(
        editing.id,
        { ...fields, status: REQUEST_STATUS.SUBMITTED, reviewedBy: null },
        { at: stamp, action: 'Resubmitted', by: user.id, personnelId: performer, notes: '' },
      )
      log(
        user,
        'Resubmitted Document Request',
        'Document',
        { type: 'request', id: editing.id, label: requestLabel({ ...editing, ...fields }) },
        `Resubmitted after revision; decision due ${due}.`,
        performer,
      )
      for (const admin of reviewers) {
        notify(
          admin.id,
          NOTIFICATION_TYPE.DOC_REQUEST_SUBMITTED,
          `${editing.controlNo} resubmitted for review`,
          `${form.type} — ${fields.documentCode} ${fields.title}. Decision due ${due}.`,
          { type: 'request', id: editing.id },
        )
      }
      navigate(path.request(editing.id))
      return
    }

    const request = {
      id: `REQ-${Date.now()}`,
      controlNo,
      status: REQUEST_STATUS.SUBMITTED,
      ...fields,
      reviewedBy: null,
      returned: null,
      approval: null,
      dcc: null,
      cancelled: null,
      history: [{ at: stamp, action: 'Submitted', by: user.id, personnelId: performer, notes: '' }],
    }
    addRequest(request)
    log(
      user,
      'Submitted Document Request',
      'Document',
      { type: 'request', id: request.id, label: requestLabel(request) },
      `${form.type} request for ${fields.documentCode} ${fields.title}; decision due ${due}.`,
      performer,
    )
    const from = user.departmentId ? deptName(user.departmentId) : user.fullName
    for (const admin of reviewers) {
      notify(
        admin.id,
        NOTIFICATION_TYPE.DOC_REQUEST_SUBMITTED,
        `${controlNo} submitted for review`,
        `${from}: ${form.type} — ${fields.documentCode} ${fields.title}. Decision due ${due}.`,
        { type: 'request', id: request.id },
      )
    }
    navigate(path.request(request.id))
  }

  const revisionHint = isNew
    ? 'A new document starts at revision 0.'
    : isRevise && target
      ? revisionLocked
        ? `Follows revision ${target.revisionNo}.`
        : `External document — enter the issuer’s new revision (currently ${target.revisionNo}).`
      : undefined

  return (
    <Page>
      <PageHeader
        title={editing ? `Edit ${editing.controlNo}` : 'New document request'}
        subtitle={
          editing
            ? 'Make the changes asked for, then resubmit. The review clock restarts when QMS receives it again.'
            : 'The Document Review / Change Notice, online. A QMS Admin reviews it, and approval publishes the change to the repository.'
        }
        actions={
          <>
            <Button
              color="secondary"
              size="md"
              iconLeading={ArrowLeft}
              onClick={() => navigate(editing ? path.request(editing.id) : ROUTES.requests)}
            >
              Cancel
            </Button>
            <Button color="primary" size="md" iconLeading={Send01} onClick={submit}>
              {editing ? 'Resubmit request' : 'Submit request'}
            </Button>
          </>
        }
      />

      {editing?.returned && (
        <Callout
          tone="warning"
          icon={ReverseLeft}
          title={`Returned for revision by ${userName(editing.returned.by)} on ${formatDate(editing.returned.at)}`}
        >
          {editing.returned.notes}
        </Callout>
      )}

      {restoredRevision && (
        <Callout tone="brand" icon={ReverseLeft} title={`Restoring revision ${restoredRevision.revisionNo}`}>
          The file of revision {restoredRevision.revisionNo} ({restoredRevision.fileName}, effective{' '}
          {formatDate(restoredRevision.effectiveDate)}) is released as the next revision. Every revision in between
          stays on record, and another QMS Admin approves the restore.
        </Callout>
      )}

      {Object.keys(errors).length > 0 && (
        <Callout tone="error" icon={AlertTriangle} title="Some fields need attention">
          {Object.values(errors).join(' ')}
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" bodyClassName="flex flex-col gap-8 py-6">
          {/* ----------------------------------------------------------- notice */}
          <Section title="Notice" subtitle="What this notice is for, and how quickly it has to be decided.">
            <FormGrid>
              <Input
                label="DRCN control no."
                value={controlNo}
                isReadOnly
                inputClassName="font-mono"
                hint={editing ? undefined : 'Assigned when the request is submitted.'}
              />
              <Input label="Date issued" value={formatDate(editing ? editing.submittedAt : TODAY)} isReadOnly />

              <FormSpan>
                <ChoiceRow
                  label="This notice is given for"
                  isRequired
                  options={REQUEST_TYPE_LIST}
                  value={form.type}
                  onChange={chooseType}
                  isDisabled={Boolean(editing)}
                  hint={REQUEST_TYPE_HINT[form.type]}
                />
              </FormSpan>

              <FormSpan>
                <ChoiceRow
                  label="Process type"
                  isRequired
                  options={PROCESS_TYPE_LIST}
                  value={form.processType}
                  onChange={set('processType')}
                  hint={
                    form.processType === PROCESS_TYPE.URGENT
                      ? 'An urgent document is decided within one working day, whatever its level.'
                      : 'A regular document’s review time depends on its level.'
                  }
                />
              </FormSpan>
            </FormGrid>
          </Section>

          {/* --------------------------------------------------------- document */}
          <Section title="Document">
            <FormGrid>
              {!isNew && (
                <FormSpan>
                  <NativeSelect
                    label={isObsolete ? 'Document to make obsolete' : 'Document to revise'}
                    value={form.documentId}
                    onChange={chooseDocument}
                    disabled={Boolean(editing)}
                    hint={
                      errors.documentId ||
                      (heldBack
                        ? `${heldBack} ACTIVE document${heldBack === 1 ? ' has' : 's have'} an open request already and ${heldBack === 1 ? 'is' : 'are'} not listed.`
                        : 'Only ACTIVE documents can be revised or made obsolete.')
                    }
                    options={[
                      { value: '', label: 'Select document…' },
                      ...eligible.map((doc) => ({
                        value: doc.id,
                        label: `${doc.code} — ${doc.title} (rev ${doc.revisionNo})`,
                      })),
                    ]}
                  />
                </FormSpan>
              )}

              <FormSpan>
                <Input
                  label="Document title"
                  isRequired={!isObsolete}
                  isReadOnly={isObsolete}
                  isInvalid={Boolean(errors.title)}
                  hint={errors.title}
                  value={form.title}
                  onChange={set('title')}
                  placeholder="e.g. Line Clearance Checklist"
                />
              </FormSpan>

              <Input
                label="Document no."
                isRequired={isNew}
                isReadOnly={!isNew}
                isInvalid={Boolean(errors.documentCode)}
                hint={errors.documentCode || (isNew ? 'Unique across the company, e.g. F-PRD-004.' : undefined)}
                value={form.documentCode}
                onChange={set('documentCode')}
                inputClassName="font-mono"
              />

              <Input
                label={isObsolete ? 'Current revision' : isNew ? 'Revision no.' : 'New revision no.'}
                isRequired={isRevise}
                isReadOnly={revisionLocked}
                isInvalid={Boolean(errors.proposedRevisionNo)}
                hint={errors.proposedRevisionNo || revisionHint}
                value={isObsolete ? target?.revisionNo || '' : form.proposedRevisionNo}
                onChange={set('proposedRevisionNo')}
                inputClassName="font-mono"
              />

              <FormSpan>
                <Input
                  label="Page affected"
                  isRequired={isRevise}
                  isInvalid={Boolean(errors.pageAffected)}
                  hint={errors.pageAffected}
                  value={form.pageAffected}
                  onChange={set('pageAffected')}
                  placeholder="e.g. Page 3, section 5.2"
                />
              </FormSpan>

              <NativeSelect
                label="Document level"
                value={form.level}
                onChange={set('level')}
                disabled={isObsolete}
                hint={errors.level}
                options={[
                  { value: '', label: 'Select level…' },
                  ...DOC_LEVELS.map(({ value, label }) => ({ value: String(value), label: `Level ${value} — ${label}` })),
                ]}
              />

              {Number(form.level) === 3 ? (
                <Input
                  label="Specify supporting document"
                  isRequired
                  isInvalid={Boolean(errors.levelSpecify)}
                  hint={errors.levelSpecify}
                  value={form.levelSpecify}
                  onChange={set('levelSpecify')}
                  placeholder="e.g. Visual aid, work instruction"
                />
              ) : (
                <div className="hidden md:block" />
              )}

              {isNew ? (
                <>
                  <NativeSelect
                    label="Category"
                    value={form.categoryId}
                    onChange={set('categoryId')}
                    hint={errors.categoryId}
                    options={[
                      { value: '', label: 'Select category…' },
                      ...documentCategories
                        .filter((category) => category.status !== 'Inactive' || category.id === form.categoryId)
                        .map((category) => ({ value: category.id, label: category.name })),
                    ]}
                  />
                  <NativeSelect
                    label="Department / Section"
                    value={form.departmentId}
                    onChange={set('departmentId')}
                    hint={errors.departmentId || 'The department that owns the document.'}
                    options={[
                      { value: '', label: 'Select department…' },
                      ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
                    ]}
                  />
                </>
              ) : (
                <>
                  <Input label="Category" value={form.categoryId ? categoryName(form.categoryId) : ''} isReadOnly />
                  <Input
                    label="Department / Section"
                    value={form.departmentId ? deptName(form.departmentId) : ''}
                    isReadOnly
                  />
                </>
              )}

              {!isObsolete && (
                <>
                  <NativeSelect
                    label="Retention period"
                    value={form.retentionPeriod}
                    onChange={set('retentionPeriod')}
                    options={RETENTION_PERIODS.map((period) => ({ value: period, label: period }))}
                  />
                  <div className="hidden md:block" />
                  <FormSpan>
                    <TextArea
                      label="Description"
                      rows={2}
                      value={form.description}
                      onChange={set('description')}
                      placeholder="Purpose and scope of the document."
                    />
                  </FormSpan>
                </>
              )}
            </FormGrid>

            {!isObsolete && (
              <div className="flex flex-col gap-3">
                {form.fileName ? (
                  <div className="flex items-center gap-3 rounded-lg p-3 ring-1 ring-secondary">
                    <FileTypeIcon fileName={form.fileName} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-primary">{form.fileName}</p>
                      <p className="text-xs text-tertiary">Draft {isNew ? 'document' : 'revision'}</p>
                    </div>
                    <Button color="link-gray" size="sm" onClick={() => setForm((current) => ({ ...current, fileName: '', restoresRevisionId: null }))}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <FileUpload.Root>
                    <FileUpload.DropZone
                      accept={DOCUMENT_RULES.allowedFileTypes.map((type) => `.${type.toLowerCase()}`).join(',')}
                      hint={`Draft ${isNew ? 'document' : 'revision'} — ${DOCUMENT_RULES.allowedFileTypes.join(', ')}, up to ${DOCUMENT_RULES.maxFileSizeMB} MB.`}
                      onDropFiles={(files) => {
                        const file = Array.from(files)[0]
                        if (file) setForm((current) => ({ ...current, fileName: file.name }))
                      }}
                    />
                  </FileUpload.Root>
                )}
                {errors.fileName && <p className="text-sm text-error-primary">{errors.fileName}</p>}
              </div>
            )}
          </Section>

          {/* ------------------------------------------------------- originator */}
          <Section title="Originator (process owner)">
            <FormGrid>
              <Input label="Submitting account" value={user.fullName} isReadOnly />
              <Input
                label="Department / Section"
                value={user.departmentId ? deptName(user.departmentId) : '—'}
                isReadOnly
              />
              {people.length > 0 && (
                <>
                  <NativeSelect
                    label="Name"
                    value={form.originatorId}
                    onChange={set('originatorId')}
                    hint={errors.originatorId || 'The person who owns the process this document covers.'}
                    options={personOptions}
                  />
                  <Input label="Position" value={originator?.position || ''} isReadOnly />
                </>
              )}
              <FormSpan>
                <TextArea
                  label="Reason for review / change"
                  isRequired
                  rows={4}
                  isInvalid={Boolean(errors.reason)}
                  hint={errors.reason}
                  value={form.reason}
                  onChange={set('reason')}
                  placeholder="What prompted the change and what it achieves. Cite the CAR, audit finding or process change if there is one."
                />
              </FormSpan>
            </FormGrid>
          </Section>

          {/* ----------------------------------------------------------- review */}
          {people.length > 0 && (
            <Section title="Review" subtitle="Immediate superior or concerned department head, before the request goes to QMS.">
              <FormGrid>
                <NativeSelect
                  label="Reviewed by"
                  value={form.reviewerId}
                  onChange={set('reviewerId')}
                  hint={errors.reviewerId}
                  options={personOptions}
                />
                <Input label="Position" value={reviewer?.position || ''} isReadOnly />
                <Input label="Date reviewed" type="date" value={form.reviewedOn} onChange={set('reviewedOn')} />
              </FormGrid>
            </Section>
          )}
        </Card>

        {/* ------------------------------------------------------------ side rail */}
        <div className="flex flex-col gap-4">
          <Card title="Review time limit" subtitle="From the table on the Document Review / Change Notice">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-display-xs font-semibold text-primary">{rule ? limitText(rule) : 'Choose a level'}</p>
                <p className="text-sm text-tertiary">
                  {rule
                    ? `A decision is due by ${formatDate(dueIfSubmittedToday)} if this is submitted today.`
                    : 'The limit depends on the process type and the document level.'}
                </p>
              </div>

              <ul className="flex flex-col gap-1.5">
                {DOCUMENT_RULES.drcnReviewLimits.map((limit) => {
                  const current = limit === rule
                  return (
                    <li
                      key={`${limit.processType}-${limit.condition}`}
                      className={cx(
                        'flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-sm ring-1 ring-inset',
                        current ? 'bg-brand-primary_alt ring-brand' : 'ring-secondary',
                      )}
                    >
                      <span className="min-w-0">
                        <span className={cx('block font-medium', current ? 'text-primary' : 'text-secondary')}>
                          {limit.processType} · Level {limit.levels.join(limit.levels.length > 2 ? ', ' : ' & ')}
                        </span>
                        <span className="block text-tertiary">{limit.condition}</span>
                      </span>
                      <span className={cx('shrink-0 font-mono', current ? 'font-semibold text-brand-secondary' : 'text-tertiary')}>
                        {limit.maxDays}d
                      </span>
                    </li>
                  )
                })}
              </ul>

              <p className="text-xs text-tertiary">
                Counted in working days from the day QMS receives the request. Each request covers one document.
              </p>
            </div>
          </Card>

          <Card title="Summary">
            <KeyValue
              items={[
                { k: 'Notice', v: `${form.type}${form.processType === PROCESS_TYPE.URGENT ? ' · urgent' : ''}` },
                {
                  k: 'Document',
                  v: form.documentCode ? `${form.documentCode}${form.title ? ` — ${form.title}` : ''}` : null,
                },
                { k: 'Originator', v: originator?.fullName || (people.length ? null : user.fullName) },
                { k: 'Reviewed by', v: reviewer?.fullName },
              ]}
            />
            <Button color="primary" size="lg" iconLeading={Send01} className="mt-5 w-full" onClick={submit}>
              {editing ? 'Resubmit request' : 'Submit request'}
            </Button>
          </Card>

          <Callout tone="brand" icon={InfoCircle} title="What happens next">
            A QMS Admin reviews the request within the limit above. They can return it for revision, disapprove it, or
            approve it — and approval publishes the change straight to the repository.
          </Callout>
        </div>
      </div>
    </Page>
  )
}
