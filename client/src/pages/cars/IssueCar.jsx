/* ============================================================================
   Issue CAR (PRD 10 — CAR Form sections 10.1–10.5, 11 — auto numbering)
   ----------------------------------------------------------------------------
   The initiator fills the finding, the recipient and the problem description.
   A CAR is delivered to the concerned department's account and names the
   responsible person from that department's personnel list. Root cause and
   action plan (10.6–10.9) are completed by the recipient on the CAR detail
   page; verification (10.10) by the QMS Admins.

   The same screen re-issues a CAR: a QMS Admin continues an existing finding
   under a new CAR that links back to the original (Overview: re-issuance).
   ========================================================================== */

import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, Clock, InfoCircle, RefreshCcw01 } from '@untitledui/icons'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Callout,
  Card,
  ChoiceRow,
  ContentDivider,
  FileUpload,
  FormGrid,
  FormSpan,
  Input,
  NativeSelect,
  resolveFileIconType,
  Section,
  TextArea,
  getReadableFileSize,
} from '@/components/ui'
import { CAR_RULES, DOCUMENT_RULES } from '@/config/appConfig'
import {
  CAR_SOURCE_GROUPS,
  CAR_STATUS,
  MASTER_STATUS,
  NC_TYPES,
  NOTIFICATION_TYPE,
  OFI_TYPES,
  PERMISSION,
  REISSUE_REASON_HINT,
  YES_NO,
} from '@/config/constants'
import { ROUTES, path } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { BLANK_CLOSURE, BLANK_EFFECTIVENESS, reissueReasonsFor } from '@/utils/cars'
import { TODAY, addWorkingDays, formatDate, isoDate, timestamp } from '@/utils/format'

/** One line of the side-rail summary. */
function SummaryRow({ label, value, sub }) {
  return (
    <div>
      <p className="text-sm font-medium text-tertiary">{label}</p>
      <p className="text-sm font-semibold text-primary">{value}</p>
      {sub && <p className="text-sm text-tertiary">{sub}</p>}
    </div>
  )
}

/** Select options for a list of personnel, led by a placeholder. */
const personOptions = (people, placeholder) => [
  { value: '', label: placeholder },
  ...people.map((person) => ({ value: person.id, label: `${person.fullName} — ${person.position}` })),
]

export default function IssueCar() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, can, isDepartment } = useAuth()
  const {
    carSources,
    departments,
    deptName,
    userName,
    personById,
    personnelForDepartment,
    receivingAccounts,
    carForUser,
    sourceById,
    addCar,
    patchCar,
    addAttachment,
    log,
    notify,
    nextCarNumber,
  } = useData()

  /* Re-issuing: only a QMS Admin continues a finding, and only for a reason that applies right now. */
  const original = params.get('reissue') && can(PERMISSION.CAR_REVIEW) ? carForUser(user, params.get('reissue')) : null
  const reissueReasons = original ? reissueReasonsFor(original) : []
  const reissuing = reissueReasons.length > 0
  /* The reply period is fixed at 5 working days for departments (follow-up D7). */
  const canSetDueDate = can(PERMISSION.CAR_REVIEW)

  const [form, setForm] = useState(() => {
    /* Another screen can open this form pre-filled — a late document review offers "Issue CAR". */
    const base = {
      source: carSources.some((item) => item.code === params.get('source')) ? params.get('source') : 'IQA',
      sourceOther: '',
      deviation: params.get('deviation') || '',
      isoClause: '',
      ncType: 'Minor NC',
      ofiType: OFI_TYPES[0],
      reasonForReissue: '',
      recurrenceCount: 0,
      issuerPersonnelId: '',
      recipientDept: departments.some((dept) => dept.id === params.get('department')) ? params.get('department') : '',
      recipientAccountId: '',
      recipientPersonnelId: '',
      dateIssued: isoDate(TODAY),
      replyDueDate: isoDate(addWorkingDays(TODAY, CAR_RULES.replyDueWorkingDays)),
      description: params.get('description') || '',
      mayOccurElsewhere: 'No',
      identifiedInRBT: 'No',
    }
    if (!reissuing) return base

    const dept = original.recipient.departmentId
    const stillListed = personnelForDepartment(dept).some((person) => person.id === original.recipient.personnelId)
    const stillReceives = receivingAccounts(dept).some(
      (account) => account.id === original.recipient.userId && account.id !== user.id,
    )
    return {
      ...base,
      source: original.source,
      sourceOther: original.sourceOther || '',
      deviation: original.finding.deviation,
      isoClause: original.finding.isoClause || '',
      ncType: original.finding.ncType,
      ofiType: original.finding.ofiType || OFI_TYPES[0],
      reasonForReissue: reissueReasons.includes(params.get('reason')) ? params.get('reason') : reissueReasons[0],
      /* Counted along the chain of re-issues; QMS can adjust it (follow-up D6). */
      recurrenceCount: (Number(original.finding.recurrenceCount) || 0) + 1,
      recipientDept: dept,
      recipientAccountId: stillReceives ? original.recipient.userId : '',
      recipientPersonnelId: stillListed ? original.recipient.personnelId : '',
      description: original.problem.description,
      mayOccurElsewhere: original.problem.mayOccurElsewhere,
      identifiedInRBT: original.problem.identifiedInRBT,
    }
  })
  const [errors, setErrors] = useState({})
  const [files, setFiles] = useState([])

  /* The control number carries the source, so it follows the source selection. */
  const carNo = useMemo(() => nextCarNumber(form.source), [nextCarNumber, form.source])

  const selectedSource = sourceById(form.source)
  /* The CAR form groups its sources: system findings first, then material and
     service. A deactivated source is only listed when it is already chosen, as
     on a re-issue of a CAR raised under it. */
  const sourceOptions = CAR_SOURCE_GROUPS.flatMap((group) =>
    carSources
      .filter((item) => (item.group || CAR_SOURCE_GROUPS[0]) === group)
      .filter((item) => item.status !== MASTER_STATUS.INACTIVE || item.code === form.source)
      .map((item) => ({ value: item.code, label: `${item.code} — ${item.name}` })),
  )

  const addFiles = (dropped) =>
    setFiles((current) => [
      ...current,
      ...Array.from(dropped).map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        size: file.size,
        type: (file.name.split('.').pop() || '').toUpperCase(),
      })),
    ])

  const removeFile = (key) => setFiles((current) => current.filter((f) => f.key !== key))

  /** React Aria fields hand back the value; native selects hand back an event. */
  const set = (key) => (value) =>
    setForm((current) => ({ ...current, [key]: value?.target ? value.target.value : value }))

  const isOfi = form.ncType === 'OFI'

  /* A shared department account names the person raising the CAR. */
  const issuers = isDepartment ? personnelForDepartment(user.departmentId) : []
  const issuerName = isDepartment ? (form.issuerPersonnelId ? userName(form.issuerPersonnelId) : null) : user.fullName

  /* A CAR is delivered to the department's account — never back to the account raising it. */
  const allAccounts = form.recipientDept ? receivingAccounts(form.recipientDept) : []
  const accounts = allAccounts.filter((account) => account.id !== user.id)
  const recipientAccountId = accounts.length === 1 ? accounts[0].id : form.recipientAccountId
  const responsibles = form.recipientDept ? personnelForDepartment(form.recipientDept) : []
  const responsible = personById(form.recipientPersonnelId)

  const noAccount = Boolean(form.recipientDept) && accounts.length === 0
  const noPersonnel = Boolean(form.recipientDept) && !noAccount && responsibles.length === 0
  const noAccountMessage =
    allAccounts.length > 0
      ? 'You cannot issue a CAR to your own account.'
      : `${deptName(form.recipientDept)} has no active account to receive a CAR. Activate or create its account in User Management first.`

  const validate = () => {
    const next = {}
    if (!form.deviation.trim()) next.deviation = 'State the deviation from the standard.'
    if (selectedSource?.requiresSpecify && !form.sourceOther.trim())
      next.sourceOther = `Specify the ${selectedSource.name.toLowerCase()}.`
    if (reissuing && !(Number(form.recurrenceCount) >= 1)) next.recurrenceCount = 'A re-issue is at least recurrence 1.'
    if (isDepartment && !form.issuerPersonnelId) next.issuerPersonnelId = 'Choose who in your department is raising this CAR.'
    if (!form.recipientDept) next.recipientDept = 'Select the concerned department or section.'
    else if (noAccount) next.recipientDept = noAccountMessage
    else {
      if (!recipientAccountId) next.recipientAccountId = 'Choose which QMS Admin receives this CAR.'
      if (!form.recipientPersonnelId)
        next.recipientPersonnelId = noPersonnel
          ? `${deptName(form.recipientDept)} has no active personnel to name as responsible.`
          : 'Select the responsible person.'
    }
    if (!form.description.trim()) next.description = 'Describe the problem in detail.'
    if (!form.dateIssued) next.dateIssued = 'Set the date the CAR is issued.'
    if (!form.replyDueDate) next.replyDueDate = 'Set a reply due date.'
    else if (form.dateIssued && form.replyDueDate < form.dateIssued)
      next.replyDueDate = 'The reply due date cannot fall before the date issued.'
    else if (form.replyDueDate < isoDate(TODAY))
      next.replyDueDate = 'The reply due date has already passed — the CAR would be overdue on arrival.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = () => {
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const id = `CAR-${Date.now()}`
    const today = isoDate(TODAY)
    const issuerPersonnelId = isDepartment ? form.issuerPersonnelId : null
    const recurrenceCount = reissuing ? Math.max(1, Math.round(Number(form.recurrenceCount))) : 0
    const car = {
      id,
      carNo,
      status: CAR_STATUS.PENDING,
      source: form.source,
      sourceOther: selectedSource?.requiresSpecify ? form.sourceOther.trim() : null,
      reissuedFrom: reissuing ? original.id : null,
      finding: {
        deviation: form.deviation,
        isoClause: form.isoClause,
        ncType: form.ncType,
        ofiType: isOfi ? form.ofiType : null,
        reasonForReissue: reissuing ? form.reasonForReissue : null,
        recurrenceCount,
      },
      initiator: {
        userId: user.id,
        personnelId: issuerPersonnelId,
        departmentId: user.departmentId,
        dateIssued: form.dateIssued,
        replyDueDate: form.replyDueDate,
        signature: issuerName,
      },
      recipient: {
        userId: recipientAccountId,
        personnelId: form.recipientPersonnelId,
        departmentId: form.recipientDept,
        dateSubmitted: null,
        signature: null,
      },
      problem: {
        description: form.description,
        mayOccurElsewhere: form.mayOccurElsewhere,
        identifiedInRBT: form.identifiedInRBT,
      },
      rootCause: { explanation: '', analyzedBy: null, date: null },
      immediateActions: [],
      correctiveActions: [],
      comments: '',
      planAccepted: null,
      implementation: null,
      implementationDueDate: null,
      verificationDueDate: null,
      verification: { closure: BLANK_CLOSURE, effectiveness: BLANK_EFFECTIVENESS },
      closeOutDate: null,
      effectivenessDueDate: null,
      extendedMonitoring: null,
      revision: { notes: '', returnedBy: null, returnedAt: null, dueDate: null, stage: null },
      dateClosed: null,
      attachments: [],
      previousResponses: [],
      previousChecks: [],
      reissuedAs: null,
      closedReason: null,
    }

    addCar(car)

    /* Filename, uploader, upload date/time and file type are recorded against
       the CAR (PRD 16). No bytes are stored — this is the UI phase. */
    const stamp = timestamp()
    files.forEach((file, position) => {
      addAttachment({
        id: `ATT-${Date.now()}-${position}`,
        carId: id,
        fileName: file.name,
        fileType: file.type || 'FILE',
        fileSize: getReadableFileSize(file.size),
        uploadedBy: user.id,
        personnelId: issuerPersonnelId,
        uploadDate: stamp,
        category: 'Supporting document',
        note: 'Attached when the CAR was issued.',
      })
    })
    log(
      user,
      'Created/Issued CAR',
      'CAR',
      { type: 'car', id, label: carNo },
      `CAR issued to ${deptName(form.recipientDept)} (${form.source} source); ${responsible.fullName} named as responsible person.${
        reissuing ? ` Re-issue of ${original.carNo}: ${form.reasonForReissue}.` : ''
      }`,
      issuerPersonnelId,
    )
    notify(
      recipientAccountId,
      NOTIFICATION_TYPE.CAR_ISSUED,
      `${carNo} issued to ${deptName(form.recipientDept)}`,
      `${responsible.fullName} is named as the responsible person. ${form.deviation.slice(0, 120)} Reply due ${formatDate(form.replyDueDate)}.`,
      { type: 'car', id },
    )

    if (reissuing) {
      /* The original links forward; an open one is closed, since the finding now lives on in the new CAR. */
      patchCar(original.id, {
        reissuedAs: id,
        ...(original.status === CAR_STATUS.CLOSED
          ? {}
          : {
              status: CAR_STATUS.CLOSED,
              dateClosed: today,
              closedReason: `Closed and re-issued as ${carNo} — ${form.reasonForReissue.toLowerCase()}`,
            }),
      })
      log(
        user,
        'Re-issued CAR',
        'CAR',
        { type: 'car', id: original.id, label: original.carNo },
        `Re-issued as ${carNo}: ${form.reasonForReissue}. Recurrence ${recurrenceCount}.`,
      )
      notify(
        original.recipient.userId,
        NOTIFICATION_TYPE.CAR_REISSUED,
        `${original.carNo} re-issued as ${carNo}`,
        `Reason: ${form.reasonForReissue}. The finding continues under ${carNo}.`,
        { type: 'car', id },
      )
    }

    navigate(path.car(id))
  }

  return (
    <Page>
      <PageHeader
        title={reissuing ? `Re-issue ${original.carNo}` : 'Issue Corrective Action Report'}
        subtitle={
          reissuing
            ? 'The finding continues under a new CAR with its own number, linked to the original.'
            : 'Raise a nonconformity or opportunity for improvement. The CAR number is generated from the source, the year and the next number in sequence.'
        }
        actions={
          <>
            <Button
              color="secondary"
              size="md"
              iconLeading={ArrowLeft}
              onClick={() => navigate(reissuing ? path.car(original.id) : ROUTES.cars)}
            >
              Cancel
            </Button>
            <Button color="primary" size="md" iconLeading={reissuing ? RefreshCcw01 : Check} onClick={submit}>
              {reissuing ? 'Re-issue CAR' : 'Issue CAR'}
            </Button>
          </>
        }
      />

      {reissuing && (
        <Callout
          tone="brand"
          icon={RefreshCcw01}
          title={`Re-issuing ${original.carNo}`}
          actions={
            <Link to={path.car(original.id)} className="text-sm font-semibold hover:underline">
              Open {original.carNo}
            </Link>
          }
        >
          The finding, the concerned department and the problem description are copied from {original.carNo}.{' '}
          {original.status === CAR_STATUS.CLOSED
            ? `${original.carNo} stays closed and links to the new CAR.`
            : `${original.carNo} is closed as re-issued when you submit.`}
        </Callout>
      )}

      {Object.keys(errors).length > 0 && (
        <Callout tone="error" icon={AlertTriangle} title="Some required fields need attention">
          {Object.values(errors).join(' ')}
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" bodyClassName="flex flex-col gap-8 py-6">
          {/* -------------------------------------- 10.1 CAR ID and source */}
          <Section no="1" title="CAR identification and source">
            <FormGrid>
              <Input
                label="CAR number"
                value={carNo}
                isReadOnly
                hint="XXX-YY-ZZZ: source, year, sequence. Confirmed on submission."
                inputClassName="font-mono"
              />
              <Input
                label="Date issued"
                type="date"
                isRequired
                isInvalid={Boolean(errors.dateIssued)}
                hint={errors.dateIssued}
                value={form.dateIssued}
                onChange={set('dateIssued')}
              />

              <FormSpan>
                <NativeSelect
                  label="Source (classification)"
                  value={form.source}
                  onChange={set('source')}
                  hint={selectedSource ? `${selectedSource.group || 'System'} source — ${selectedSource.description}` : undefined}
                  options={sourceOptions}
                />
              </FormSpan>

              {selectedSource?.requiresSpecify && (
                <FormSpan>
                  <Input
                    label={`Specify the ${selectedSource.name.toLowerCase()}`}
                    isRequired
                    isInvalid={Boolean(errors.sourceOther)}
                    hint={errors.sourceOther || 'The CAR form asks for this for QMS system deviations and other NCs.'}
                    value={form.sourceOther}
                    onChange={set('sourceOther')}
                    placeholder="Describe the source"
                  />
                </FormSpan>
              )}
            </FormGrid>
          </Section>

          {/* ------------------------------ 10.2 Finding / Nonconformity */}
          <Section no="2" title="Finding / Nonconformity">
            <FormGrid>
              <FormSpan>
                <TextArea
                  label="Deviation from the standard"
                  isRequired
                  isInvalid={Boolean(errors.deviation)}
                  hint={errors.deviation}
                  rows={3}
                  value={form.deviation}
                  onChange={set('deviation')}
                  placeholder="State the requirement and how the observed condition departs from it."
                />
              </FormSpan>

              <FormSpan>
                <Input
                  label="ISO standard / clause"
                  value={form.isoClause}
                  onChange={set('isoClause')}
                  placeholder="e.g. 7.1.5.2 Measurement traceability"
                />
              </FormSpan>

              <FormSpan>
                <ChoiceRow
                  label="Type of NC"
                  isRequired
                  options={NC_TYPES}
                  value={form.ncType}
                  onChange={set('ncType')}
                />
              </FormSpan>

              {isOfi && (
                <FormSpan>
                  <ChoiceRow
                    label="Opportunity for improvement"
                    options={OFI_TYPES}
                    value={form.ofiType}
                    onChange={set('ofiType')}
                  />
                </FormSpan>
              )}

              {reissuing && (
                <>
                  <NativeSelect
                    label="Reason for re-issue"
                    value={form.reasonForReissue}
                    onChange={set('reasonForReissue')}
                    hint={REISSUE_REASON_HINT[form.reasonForReissue]}
                    options={reissueReasons.map((reason) => ({ value: reason, label: reason }))}
                  />
                  <Input
                    label="No. of recurrence"
                    type="number"
                    min="1"
                    isInvalid={Boolean(errors.recurrenceCount)}
                    hint={
                      errors.recurrenceCount ||
                      `${original.carNo} was recurrence ${original.finding.recurrenceCount || 0}. Adjust if earlier CARs outside the system count too.`
                    }
                    value={String(form.recurrenceCount)}
                    onChange={set('recurrenceCount')}
                  />
                </>
              )}
            </FormGrid>
          </Section>

          {/* --------------------------- 10.3 / 10.4 Initiator and recipient */}
          <Section no="3" title="Initiator and recipient">
            <FormGrid>
              <Input label="Initiator account" value={user.fullName} isReadOnly />
              <Input
                label="Initiator department / section"
                value={user.departmentId ? deptName(user.departmentId) : '—'}
                isReadOnly
              />

              {isDepartment && (
                <FormSpan>
                  <NativeSelect
                    label="Issued by"
                    value={form.issuerPersonnelId}
                    onChange={set('issuerPersonnelId')}
                    hint={
                      errors.issuerPersonnelId ||
                      (issuers.length === 0
                        ? 'Your personnel list is empty. Add your people on the Personnel page first.'
                        : 'The account is shared, so name the person raising this CAR. Their name is the initiator’s signature.')
                    }
                    options={personOptions(issuers, 'Select person…')}
                  />
                </FormSpan>
              )}

              <FormSpan>
                <ContentDivider className="my-1">Recipient</ContentDivider>
              </FormSpan>

              <NativeSelect
                label="Concerned department / section"
                value={form.recipientDept}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    recipientDept: event.target.value,
                    recipientAccountId: '',
                    recipientPersonnelId: '',
                  }))
                }
                hint={errors.recipientDept || (noAccount ? noAccountMessage : undefined)}
                options={[
                  { value: '', label: 'Select department…' },
                  ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
                ]}
              />

              {accounts.length > 1 ? (
                <NativeSelect
                  label="Receiving account"
                  value={form.recipientAccountId}
                  onChange={set('recipientAccountId')}
                  hint={errors.recipientAccountId || 'This department has no shared account; choose the QMS Admin who receives it.'}
                  options={[
                    { value: '', label: 'Select account…' },
                    ...accounts.map((account) => ({ value: account.id, label: account.fullName })),
                  ]}
                />
              ) : (
                <Input
                  label="Delivered to"
                  value={accounts[0]?.fullName || (form.recipientDept ? 'No account can receive it' : 'Select a department first')}
                  isReadOnly
                />
              )}

              <FormSpan>
                <NativeSelect
                  label="Responsible person"
                  value={form.recipientPersonnelId}
                  onChange={set('recipientPersonnelId')}
                  disabled={!form.recipientDept || noAccount || noPersonnel}
                  hint={
                    errors.recipientPersonnelId ||
                    (responsible
                      ? `Notified in the app and by email at ${responsible.email}.`
                      : noPersonnel
                        ? `${deptName(form.recipientDept)} has no active personnel listed. Ask the department to add them on its Personnel page.`
                        : 'The person in the department who answers this CAR.')
                  }
                  options={personOptions(
                    responsibles,
                    !form.recipientDept ? 'Select a department first' : noPersonnel ? 'No active personnel listed' : 'Select person…',
                  )}
                />
              </FormSpan>

              <FormSpan>
                <Input
                  label="Reply due date"
                  type="date"
                  isRequired
                  isReadOnly={!canSetDueDate}
                  isInvalid={Boolean(errors.replyDueDate)}
                  hint={
                    errors.replyDueDate ||
                    (canSetDueDate
                      ? `Default is ${CAR_RULES.replyDueWorkingDays} working days from today.`
                      : `${CAR_RULES.replyDueWorkingDays} working days from today. Only a QMS Admin can change it.`)
                  }
                  value={form.replyDueDate}
                  onChange={set('replyDueDate')}
                />
              </FormSpan>
            </FormGrid>
          </Section>

          {/* ------------------------- 10.5 Description of the problem */}
          <Section no="4" title="Description of the problem">
            <FormGrid>
              <FormSpan>
                <TextArea
                  label="Detailed description"
                  isRequired
                  isInvalid={Boolean(errors.description)}
                  hint={errors.description}
                  rows={5}
                  value={form.description}
                  onChange={set('description')}
                  placeholder="What was observed, where, when, and the extent of the nonconformity."
                />
              </FormSpan>

              <ChoiceRow
                label="Could the same problem occur in other departments or sections?"
                options={YES_NO}
                value={form.mayOccurElsewhere}
                onChange={set('mayOccurElsewhere')}
              />

              <ChoiceRow
                label="Identified in the RBT?"
                hint="Risk-Based Thinking register."
                options={YES_NO}
                value={form.identifiedInRBT}
                onChange={set('identifiedInRBT')}
              />
            </FormGrid>
          </Section>

          {/* -------------------------------------------- Supporting files */}
          <Section no="5" title="Supporting files">
            <FileUpload.Root>
              <FileUpload.DropZone
                accept={DOCUMENT_RULES.allowedFileTypes.map((type) => `.${type.toLowerCase()}`).join(',')}
                hint={`${DOCUMENT_RULES.allowedFileTypes.join(', ')} — filename, uploader, upload date/time and file type are recorded against this CAR.`}
                onDropFiles={addFiles}
              />

              {files.length > 0 && (
                <FileUpload.List>
                  {files.map((file) => (
                    <FileUpload.ListItemProgressBar
                      key={file.key}
                      name={file.name}
                      size={file.size}
                      progress={100}
                      type={resolveFileIconType({ fileName: file.name, fileType: file.type })}
                      onDelete={() => removeFile(file.key)}
                    />
                  ))}
                </FileUpload.List>
              )}
            </FileUpload.Root>
          </Section>
        </Card>

        {/* ------------------------------------------------------ side rail */}
        <div className="flex flex-col gap-4">
          <Card title="Summary">
            <div className="flex flex-col gap-4">
              <SummaryRow label="CAR number" value={<span className="font-mono">{carNo}</span>} />
              {reissuing && (
                <SummaryRow
                  label="Re-issue of"
                  value={<span className="font-mono">{original.carNo}</span>}
                  sub={`${form.reasonForReissue} · recurrence ${form.recurrenceCount}`}
                />
              )}
              <SummaryRow
                label="Issued by"
                value={issuerName || 'Not selected'}
                sub={isDepartment ? `${user.fullName} account` : deptName(user.departmentId)}
              />
              <SummaryRow
                label="Responsible person"
                value={responsible ? responsible.fullName : 'Not selected'}
                sub={
                  form.recipientDept
                    ? [deptName(form.recipientDept), responsible?.position].filter(Boolean).join(' · ')
                    : '—'
                }
              />
              <SummaryRow
                label="Reply due"
                value={formatDate(form.replyDueDate)}
                sub={`${CAR_RULES.replyDueWorkingDays} working days is the standard reply period`}
              />
              <SummaryRow
                label="Supporting files"
                value={files.length === 0 ? 'None attached' : `${files.length} file${files.length === 1 ? '' : 's'}`}
                sub={files.length ? files.map((f) => f.name).join(', ') : undefined}
              />
            </div>

            <ContentDivider className="my-5" />

            <Button
              color="primary"
              size="lg"
              iconLeading={reissuing ? RefreshCcw01 : Check}
              className="w-full"
              onClick={submit}
            >
              {reissuing ? 'Re-issue CAR' : 'Issue CAR'}
            </Button>
          </Card>

          <Callout tone="brand" icon={InfoCircle} title="What happens next">
            The CAR is created as <strong>Pending</strong>. The department’s account is notified and the responsible
            person is emailed. They submit the root cause analysis and action plan; once a QMS Admin accepts it, the
            actions are carried out, verified and checked for effectiveness.
          </Callout>

          <Callout tone="warning" icon={Clock} title="Overdue handling">
            Every stage has a deadline. The CAR is flagged overdue whenever the deadline of its current stage passes, and
            the people who own that stage are notified.
          </Callout>
        </div>
      </div>
    </Page>
  )
}
