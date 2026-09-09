/* ============================================================================
   Issue CAR (PRD 10 — CAR Form sections 10.1–10.5, 11 — auto numbering)
   ----------------------------------------------------------------------------
   The initiator fills the finding, the recipient and the problem description.
   Root cause and action plan (10.6–10.9) are completed by the recipient on the
   CAR detail page; verification (10.10) by the QMS Department.
   ========================================================================== */

import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, Clock, InfoCircle } from '@untitledui/icons'
import { useNavigate } from 'react-router-dom'

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
  CAR_STATUS,
  NC_TYPES,
  NOTIFICATION_TYPE,
  OFI_TYPES,
  REISSUE_REASONS,
  YES_NO,
} from '@/config/constants'
import { ROUTES, path } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { TODAY, formatDate } from '@/utils/format'

const iso = (date) => date.toISOString().slice(0, 10)
const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

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

export default function IssueCar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { carSources, departments, users, deptName, userName, addCar, addAttachment, log, notify, nextCarNumber } =
    useData()

  const carNo = useMemo(() => nextCarNumber(), [nextCarNumber])

  const [form, setForm] = useState({
    source: 'IQA',
    sourceOther: '',
    deviation: '',
    isoClause: '',
    ncType: 'Minor NC',
    ofiType: OFI_TYPES[0],
    reasonForReissue: '',
    recurrenceCount: 0,
    recipientId: '',
    recipientDept: '',
    dateIssued: iso(TODAY),
    replyDueDate: iso(addDays(TODAY, CAR_RULES.replyDueDays)),
    description: '',
    mayOccurElsewhere: 'No',
    identifiedInRBT: 'No',
  })
  const [errors, setErrors] = useState({})
  const [files, setFiles] = useState([])

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

  /* A finding is answered by someone other than the person who raised it. */
  const eligible = users.filter((person) => person.status === 'Active' && person.id !== user.id)
  const recipientCandidates = form.recipientDept
    ? eligible.filter((person) => person.departmentId === form.recipientDept)
    : eligible
  const departmentIsEmpty = Boolean(form.recipientDept) && recipientCandidates.length === 0

  const validate = () => {
    const next = {}
    if (!form.deviation.trim()) next.deviation = 'State the deviation from the standard.'
    if (form.source === 'OTH' && !form.sourceOther.trim())
      next.sourceOther = 'Specify the other identified nonconformity.'
    if (!form.recipientDept) next.recipientDept = 'Select the concerned department or section.'
    else if (departmentIsEmpty)
      next.recipientDept = `${deptName(form.recipientDept)} has no active user to receive a CAR.`
    if (!form.recipientId && !departmentIsEmpty) next.recipientId = 'Select the responsible person.'
    if (!form.description.trim()) next.description = 'Describe the problem in detail.'
    if (!form.dateIssued) next.dateIssued = 'Set the date the CAR is issued.'
    if (!form.replyDueDate) next.replyDueDate = 'Set a reply due date.'
    else if (form.dateIssued && form.replyDueDate < form.dateIssued)
      next.replyDueDate = 'The reply due date cannot fall before the date issued.'
    else if (form.replyDueDate < iso(TODAY))
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
    const car = {
      id,
      carNo,
      status: CAR_STATUS.ACTIVE,
      source: form.source,
      sourceOther: form.source === 'OTH' ? form.sourceOther : null,
      finding: {
        deviation: form.deviation,
        isoClause: form.isoClause,
        ncType: form.ncType,
        ofiType: isOfi ? form.ofiType : null,
        reasonForReissue: form.reasonForReissue || null,
        recurrenceCount: Number(form.recurrenceCount) || 0,
      },
      initiator: {
        userId: user.id,
        departmentId: user.departmentId,
        dateIssued: form.dateIssued,
        replyDueDate: form.replyDueDate,
        signature: user.fullName,
      },
      recipient: {
        userId: form.recipientId,
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
      immediateAction: { action: '', responsibleId: null, targetDate: null, signature: null },
      correctiveAction: { action: '', responsibleId: null, targetDate: null, signature: null },
      verification: {
        closure: { notes: '', verifiedBy: null, approvedBy: null, verificationDate: null, disposition: 'OPEN' },
        effectiveness: { notes: '', validatedBy: null, approvedBy: null, result: null, date: null },
      },
      revision: { notes: '', returnedBy: null, returnedAt: null, dueDate: null, stage: null },
      dateClosed: null,
      attachments: [],
    }

    addCar(car)

    /* Filename, uploader, upload date/time and file type are recorded against
       the CAR (PRD 16). No bytes are stored — this is the UI phase. */
    const stamp = TODAY.toISOString().slice(0, 19)
    files.forEach((file, position) => {
      addAttachment({
        id: `ATT-${Date.now()}-${position}`,
        carId: id,
        fileName: file.name,
        fileType: file.type || 'FILE',
        fileSize: getReadableFileSize(file.size),
        uploadedBy: user.id,
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
      `CAR issued to ${deptName(form.recipientDept)} (${form.source} source).`,
    )
    notify(
      form.recipientId,
      NOTIFICATION_TYPE.CAR_ISSUED,
      `${carNo} issued to your department`,
      `${form.deviation.slice(0, 140)} Reply due ${formatDate(form.replyDueDate)}.`,
      { type: 'car', id },
    )
    navigate(path.car(id))
  }

  return (
    <Page>
      <PageHeader
        title="Issue Corrective Action Report"
        subtitle="Raise a nonconformity or opportunity for improvement. The CAR number is generated automatically on submission."
        actions={
          <>
            <Button color="secondary" size="md" iconLeading={ArrowLeft} onClick={() => navigate(ROUTES.cars)}>
              Cancel
            </Button>
            <Button color="primary" size="md" iconLeading={Check} onClick={submit}>
              Issue CAR
            </Button>
          </>
        }
      />

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
                hint="Auto-generated on submission (PRD 11)."
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
                  label="Source"
                  value={form.source}
                  onChange={set('source')}
                  options={carSources.map((item) => ({ value: item.code, label: `${item.code} — ${item.name}` }))}
                />
              </FormSpan>

              {form.source === 'OTH' && (
                <FormSpan>
                  <Input
                    label="Specify other identified NC"
                    isRequired
                    isInvalid={Boolean(errors.sourceOther)}
                    hint={errors.sourceOther}
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

              <Input
                label="ISO standard / clause"
                value={form.isoClause}
                onChange={set('isoClause')}
                placeholder="e.g. 7.1.5.2 Measurement traceability"
              />

              <Input
                label="No. of recurrence"
                type="number"
                min="0"
                value={String(form.recurrenceCount)}
                onChange={set('recurrenceCount')}
                hint="How many times this finding has been raised before."
              />

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

              <FormSpan>
                <NativeSelect
                  label="Reason for re-issue"
                  hint="Only when re-issuing a previously closed or unanswered CAR."
                  value={form.reasonForReissue}
                  onChange={set('reasonForReissue')}
                  options={[
                    { value: '', label: 'Not a re-issue' },
                    ...REISSUE_REASONS.map((reason) => ({ value: reason, label: reason })),
                  ]}
                />
              </FormSpan>
            </FormGrid>
          </Section>

          {/* --------------------------- 10.3 / 10.4 Initiator and recipient */}
          <Section no="3" title="Initiator and recipient">
            <FormGrid>
              <Input label="Initiator" value={user.fullName} isReadOnly />
              <Input label="Initiator department / section" value={deptName(user.departmentId)} isReadOnly />

              <NativeSelect
                label="Concerned department / section"
                value={form.recipientDept}
                onChange={(event) =>
                  setForm((current) => ({ ...current, recipientDept: event.target.value, recipientId: '' }))
                }
                hint={errors.recipientDept}
                options={[
                  { value: '', label: 'Select department…' },
                  ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
                ]}
              />

              <NativeSelect
                label="Responsible person"
                value={form.recipientId}
                onChange={set('recipientId')}
                disabled={departmentIsEmpty}
                hint={
                  departmentIsEmpty
                    ? `${deptName(form.recipientDept)} has no active user who can receive this CAR. Activate an account for the section, or route the CAR elsewhere.`
                    : errors.recipientId || 'You cannot route a CAR to yourself.'
                }
                options={[
                  { value: '', label: departmentIsEmpty ? 'No active user in this section' : 'Select person…' },
                  ...recipientCandidates.map((person) => ({
                    value: person.id,
                    label: `${person.fullName} — ${person.position}`,
                  })),
                ]}
              />

              <FormSpan>
                <Input
                  label="Reply due date"
                  type="date"
                  isRequired
                  isInvalid={Boolean(errors.replyDueDate)}
                  hint={errors.replyDueDate || `Default is ${CAR_RULES.replyDueDays} days from the date issued.`}
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
              <SummaryRow label="Issued by" value={user.fullName} sub={deptName(user.departmentId)} />
              <SummaryRow
                label="Routed to"
                value={form.recipientId ? userName(form.recipientId) : 'Not selected'}
                sub={form.recipientDept ? deptName(form.recipientDept) : '—'}
              />
              <SummaryRow label="Reply due" value={formatDate(form.replyDueDate)} />
              <SummaryRow
                label="Supporting files"
                value={files.length === 0 ? 'None attached' : `${files.length} file${files.length === 1 ? '' : 's'}`}
                sub={files.length ? files.map((f) => f.name).join(', ') : undefined}
              />
            </div>

            <ContentDivider className="my-5" />

            <Button color="primary" size="lg" iconLeading={Check} className="w-full" onClick={submit}>
              Issue CAR
            </Button>
          </Card>

          <Callout tone="brand" icon={InfoCircle} title="What happens next">
            The CAR is created with status <strong>Active</strong> and the responsible person is notified. They
            complete the root cause analysis and action plan, then submit it to the QMS Department for review.
          </Callout>

          <Callout tone="warning" icon={Clock} title="Overdue handling">
            The system flags this CAR as Overdue automatically once the reply due date passes without a
            submitted response.
          </Callout>
        </div>
      </div>
    </Page>
  )
}
