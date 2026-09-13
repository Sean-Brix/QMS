/* ============================================================================
   System Settings
   ----------------------------------------------------------------------------
   The rules the client wants configurable without a developer (Confirmed #18,
   #20, #27; follow-ups C3, G1, G3). Saving puts a change into effect at once —
   CAR numbering and deadlines, reminders, the password policy, report periods
   and branding all read the saved values — and writes each changed setting to
   the activity log. Document categories and CAR sources are master lists,
   edited in their own dialogs and saved as they go.
   ========================================================================== */

import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronDown,
  Edit03,
  InfoCircle,
  Plus,
  ReverseLeft,
  Shield01,
  Trash01,
} from '@untitledui/icons'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  AppDialog,
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  FormGrid,
  FormSpan,
  Input,
  NativeSelect,
  Section,
  StatusBadge,
  StatusTag,
  Tab,
  TabList,
  Tabs,
  TextArea,
  Toggle,
  cx,
} from '@/components/ui'
import { APP } from '@/config/appConfig'
import {
  CAR_SEQUENCE_RESET_OPTIONS,
  CAR_SOURCE_GROUPS,
  FILE_TYPE_OPTIONS,
  MASTER_STATUS,
} from '@/config/constants'
import { useAuth, useData } from '@/context/contexts'
import { TODAY, formatDate, formatDateTime, isoDate, pluralize, timestamp } from '@/utils/format'
import { WATERMARK_PLACEHOLDERS, documentsUsingTemplate, renderWatermark, unknownPlaceholders } from '@/utils/watermark'

const SECURITY_REQUIREMENTS = [
  'Secure authentication',
  'Password hashing',
  'Role-based access control',
  'Secure file upload',
  'Protected document access',
  'SQL injection protection',
  'Session management',
  'Audit logging',
  'Regular database backup',
  'Secure server configuration',
  'HTTPS/SSL',
  'Input validation',
]

const DATABASE_TABLES = [
  'users.json',
  'roles.json',
  'departments.json',
  'documents.json',
  'document_categories.json',
  'document_revisions.json',
  'cars.json',
  'car_sources.json',
  'car_statuses.json',
  'car_attachments.json',
  'personnel.json',
  'document_requests.json',
  'activity_logs.json',
  'notifications.json',
  'settings.json',
]

/* Which tab a setting lives on, by the first part of its key. */
const TABS = [
  { id: 'general', label: 'General', sections: ['organization', 'reporting', 'notifications'] },
  { id: 'car', label: 'CAR workflow', sections: ['car'] },
  { id: 'documents', label: 'Documents', sections: ['document'] },
  { id: 'security', label: 'Security & session', sections: ['session'] },
  { id: 'lists', label: 'Master lists', sections: [] },
]
const tabOf = (key) => TABS.find((tab) => tab.sections.includes(key.split('.')[0]))?.id

const sequenceLabel = (value) => CAR_SEQUENCE_RESET_OPTIONS.find((option) => option.value === value)?.label || value

/**
 * The simple settings: one value each. Validation, the activity-log wording
 * and the save all work from this list, so a new setting is one line here and
 * one row on the page.
 */
const FIELDS = [
  { key: 'organization.name', label: 'Organization name', kind: 'text' },
  { key: 'organization.standard', label: 'Standard', kind: 'text' },
  { key: 'organization.systemName', label: 'System name', kind: 'text' },
  { key: 'organization.shortName', label: 'Short name', kind: 'text' },
  { key: 'reporting.defaultPeriod', label: 'Default report period', kind: 'select' },
  { key: 'notifications.email', label: 'Email notifications', kind: 'bool' },
  { key: 'car.numberFormat', label: 'CAR number format', kind: 'text' },
  { key: 'car.sequenceReset', label: 'CAR sequence restarts', kind: 'select', optionLabel: sequenceLabel },
  { key: 'car.replyDueWorkingDays', label: 'CAR reply period', kind: 'int', min: 1, max: 30, unit: 'working days' },
  { key: 'car.dueSoonReminderDays', label: 'Reminder before a CAR deadline', kind: 'int', min: 0, max: 30, unit: 'days' },
  { key: 'car.autoFlagOverdue', label: 'Flag overdue CARs automatically', kind: 'bool' },
  { key: 'car.verificationOffsetDays', label: 'Verification after the target date', kind: 'int', min: 0, max: 30, unit: 'days' },
  { key: 'car.effectivenessMonths', label: 'Effectiveness check after close-out', kind: 'int', min: 1, max: 24, unit: 'months' },
  { key: 'car.nextInternalAudit', label: 'Next internal audit', kind: 'date' },
  { key: 'car.extendedMonitoringMonths', label: 'Extended monitoring interval', kind: 'int', min: 1, max: 12, unit: 'months' },
  { key: 'document.dynamicWatermark', label: 'Watermark new documents by default', kind: 'bool' },
  {
    key: 'document.defaultWatermarkTemplateId',
    label: 'Default watermark template',
    kind: 'select',
    optionLabel: (value, context) => context.templates.find((template) => template.id === value)?.name || value,
  },
  { key: 'document.reviewReminderDays', label: 'Document review reminder', kind: 'int', min: 0, max: 180, unit: 'days' },
  { key: 'document.maxFileSizeMB', label: 'Maximum upload size', kind: 'int', min: 1, max: 500, unit: 'MB' },
  { key: 'session.idleTimeoutMinutes', label: 'Idle timeout', kind: 'int', min: 5, max: 480, unit: 'minutes' },
  { key: 'session.maxFailedLoginAttempts', label: 'Maximum failed sign-in attempts', kind: 'int', min: 1, max: 20, unit: 'attempts' },
  { key: 'session.passwordMinLength', label: 'Minimum password length', kind: 'int', min: 6, max: 64, unit: 'characters' },
  { key: 'session.passwordRequiresLetterAndNumber', label: 'Passwords need a letter and a number', kind: 'bool' },
  { key: 'session.forcePasswordChangeOnFirstLogin', label: 'Force a password change at first sign-in', kind: 'bool' },
]
const FIELD = Object.fromEntries(FIELDS.map((field) => [field.key, field]))

/* ---------------------------------------------------------------- helpers */

const clone = (value) => JSON.parse(JSON.stringify(value))
const getPath = (object, key) => key.split('.').reduce((value, part) => value?.[part], object)
const omit = (object, key) => Object.fromEntries(Object.entries(object).filter(([name]) => name !== key))

function withPath(object, key, value) {
  const [head, ...rest] = key.split('.')
  return { ...object, [head]: rest.length ? withPath(object[head] || {}, rest.join('.'), value) : value }
}

function numberFormatProblem(format) {
  const text = String(format).trim()
  for (const token of ['{SRC}', '{YY}', '{ZZZ}']) {
    if (text.split(token).length !== 2) return `Use ${token} exactly once.`
  }
  const rest = text.replace('{SRC}', '').replace('{YY}', '').replace('{ZZZ}', '')
  if (/[{}]/.test(rest)) return 'Only {SRC}, {YY} and {ZZZ} can be used as placeholders.'
  if (!/^[A-Za-z0-9\-/_. ]*$/.test(rest)) return 'Separate the parts with letters, digits, hyphens, slashes, dots or underscores.'
  return null
}

function fieldProblem(field, raw) {
  const text = String(raw ?? '').trim()
  if (field.kind === 'int') {
    if (!/^\d+$/.test(text)) return 'Enter a whole number.'
    const value = Number(text)
    if (value < field.min || value > field.max) return `Enter a number from ${field.min} to ${field.max}.`
  }
  if (field.kind === 'text' && !text) return 'This can’t be empty.'
  if (field.key === 'car.numberFormat') return numberFormatProblem(text)
  if (field.key === 'car.nextInternalAudit' && text && text < isoDate(TODAY)) {
    return 'Pick a date from today on, or leave it empty.'
  }
  return null
}

function coerce(field, raw) {
  if (field.kind === 'int') return Number(String(raw).trim())
  if (field.kind === 'text') return String(raw ?? '').trim()
  if (field.kind === 'date') return raw || null
  return raw
}

function display(field, value, context) {
  if (value === null || value === undefined || value === '') return 'not set'
  switch (field.kind) {
    case 'bool':
      return value ? 'on' : 'off'
    case 'int':
      return `${value}${field.unit ? ` ${field.unit}` : ''}`
    case 'date':
      return formatDate(value)
    case 'select':
      return field.optionLabel ? field.optionLabel(value, context) : String(value)
    default:
      return `“${value}”`
  }
}

/* ------------------------------------------------ DRCN review-time table */

const levelsText = (levels) => `Level ${levels.join(levels.length > 2 ? ', ' : ' & ')}`
const sameGroup = (a, b) => Boolean(a?.documents && b?.documents) && a.processType === b.processType && a.levels.join() === b.levels.join()

function conditionText(row) {
  const days = `${row.maxDays} day${row.maxDays === 1 ? '' : 's'}`
  if (row.documents) {
    const [from, to] = row.documents
    const count = to == null ? `${from} and above` : from === to ? `${from} document${from === 1 ? '' : 's'}` : `${from} to ${to}`
    return `${count} = max of ${days}`
  }
  return row.processType === 'B-Urgent' ? `Urgent document: max of ${days}` : `Max of ${days}`
}

/**
 * The table as edited: day limits, and the upper document count of each band
 * but the last. A band starts one above the band before it, so the bands can
 * never overlap or leave a gap. Only a changed row gets new wording, so the
 * form's own wording survives on the rest.
 */
function normalizeLimits(draftRows, savedRows) {
  const problems = {}
  const rows = draftRows.map((row, index) => {
    const text = String(row.maxDays).trim()
    const maxDays = Number(text)
    if (!/^\d+$/.test(text) || maxDays < 1 || maxDays > 30) problems[`${index}.maxDays`] = 'From 1 to 30 days.'
    return { ...row, maxDays, documents: row.documents ? [...row.documents] : undefined }
  })

  rows.forEach((row, index) => {
    if (!row.documents) return
    const from = sameGroup(rows[index - 1], row) ? rows[index - 1].documents[1] + 1 : 1
    const last = !sameGroup(row, rows[index + 1])
    let to = null
    if (!last) {
      const text = String(draftRows[index].documents[1] ?? '').trim()
      to = Number(text)
      if (!/^\d+$/.test(text) || to < from) {
        problems[`${index}.to`] = `At least ${from}.`
        to = from
      }
    }
    row.documents = [from, to]
  })

  rows.forEach((row, index) => {
    const saved = savedRows[index]
    if (!saved || saved.maxDays !== row.maxDays || JSON.stringify(saved.documents ?? null) !== JSON.stringify(row.documents ?? null)) {
      row.condition = conditionText(row)
    }
  })

  return { rows, problems }
}

function normalizeTemplates(draftTemplates) {
  const problems = {}
  const rows = draftTemplates.map((template) => ({ ...template, name: template.name.trim(), template: template.template.trim() }))
  rows.forEach((template, index) => {
    if (!template.name) problems[`${index}.name`] = 'Name the template.'
    else if (rows.some((other, earlier) => earlier < index && other.name.toLowerCase() === template.name.toLowerCase())) {
      problems[`${index}.name`] = 'Another template has this name.'
    }
    const unknown = unknownPlaceholders(template.template)
    if (!template.template) problems[`${index}.template`] = 'Enter the watermark text.'
    else if (unknown.length) problems[`${index}.template`] = `Unknown placeholder ${unknown.map((token) => `{${token}}`).join(', ')}.`
  })
  return { rows, problems }
}

function describeTemplates(before, after) {
  const parts = []
  for (const template of after) {
    const old = before.find((item) => item.id === template.id)
    if (!old) parts.push(`added “${template.name}”`)
    else if (old.name !== template.name || old.template !== template.template) parts.push(`changed “${template.name}” to ${template.template}`)
  }
  for (const old of before) if (!after.some((item) => item.id === old.id)) parts.push(`removed “${old.name}”`)
  return `Watermark templates: ${parts.join('; ')}.`
}

/**
 * Everything a save needs, worked out from the saved settings and the draft:
 * the problems to fix, the settings that would be saved, and one change entry
 * per setting for the activity log.
 */
function prepare(saved, draft) {
  const errors = {}
  const changes = []
  let next = clone(saved)

  const templates = normalizeTemplates(draft.document.watermarkTemplates)
  for (const field of FIELDS) {
    const raw = getPath(draft, field.key)
    const problem = fieldProblem(field, raw)
    if (problem) errors[field.key] = problem
    const value = coerce(field, raw)
    const before = getPath(saved, field.key)
    if (JSON.stringify(before) !== JSON.stringify(value)) {
      changes.push({
        label: field.label,
        details: `${field.label} changed from ${display(field, before, { templates: saved.document.watermarkTemplates })} to ${display(field, value, { templates: templates.rows })}.`,
      })
      next = withPath(next, field.key, value)
    }
  }

  for (const [key, problem] of Object.entries(templates.problems)) errors[`document.watermarkTemplates.${key}`] = problem
  if (!templates.rows.some((template) => template.id === draft.document.defaultWatermarkTemplateId)) {
    errors['document.defaultWatermarkTemplateId'] = 'Choose one of the templates below.'
  }
  if (JSON.stringify(templates.rows) !== JSON.stringify(saved.document.watermarkTemplates)) {
    changes.push({ label: 'Watermark templates', details: describeTemplates(saved.document.watermarkTemplates, templates.rows) })
    next = withPath(next, 'document.watermarkTemplates', templates.rows)
  }

  const limits = normalizeLimits(draft.document.drcnReviewLimits, saved.document.drcnReviewLimits)
  for (const [key, problem] of Object.entries(limits.problems)) errors[`document.drcnReviewLimits.${key}`] = problem
  if (JSON.stringify(limits.rows) !== JSON.stringify(saved.document.drcnReviewLimits)) {
    const changed = limits.rows.filter((row, index) => JSON.stringify(row) !== JSON.stringify(saved.document.drcnReviewLimits[index]))
    changes.push({
      label: 'Review time limits',
      details: `Review time limits: ${changed.map((row) => `${row.processType} ${levelsText(row.levels)}, ${row.condition}`).join('; ')}.`,
    })
    next = withPath(next, 'document.drcnReviewLimits', limits.rows)
  }

  const types = FILE_TYPE_OPTIONS.filter((type) => draft.document.allowedFileTypes.includes(type))
  if (!types.length) errors['document.allowedFileTypes'] = 'Allow at least one file type.'
  if (JSON.stringify(types) !== JSON.stringify(saved.document.allowedFileTypes)) {
    changes.push({
      label: 'Allowed file types',
      details: `Allowed file types changed from ${saved.document.allowedFileTypes.join(', ')} to ${types.join(', ') || 'none'}.`,
    })
    next = withPath(next, 'document.allowedFileTypes', types)
  }

  return { errors, changes, next, limitRows: limits.rows }
}

/* ------------------------------------------------------------ page parts */

/**
 * One settings row: what the setting is on the left, the control on the right.
 * This is the shape Untitled UI uses for settings screens, and it keeps every
 * control on this page aligned to the same column.
 */
function SettingRow({ label, hint, children, className }) {
  return (
    <div
      className={cx(
        'flex flex-col gap-2 border-b border-secondary py-4 first:pt-0 last:border-b-0 last:pb-0 md:flex-row md:items-start md:gap-8',
        className,
      )}
    >
      <div className="md:w-72 md:shrink-0">
        <p className="text-sm font-semibold text-primary">{label}</p>
        {hint && <p className="mt-0.5 text-sm text-tertiary">{hint}</p>}
      </div>
      <div className="min-w-0 flex-1 md:max-w-md">{children}</div>
    </div>
  )
}

/** A reference-data row: a code chip, a name and a description. */
function ReferenceRow({ code, name, description, tone }) {
  return (
    <div className="flex items-start gap-3 border-b border-secondary py-3 last:border-b-0">
      <span className="shrink-0">
        {tone ? (
          <StatusTag status={code} />
        ) : (
          <Badge size="sm" color="gray" type="modern" className="font-mono">
            {code}
          </Badge>
        )}
      </span>
      <div className="min-w-0 flex-1">
        {name && <p className="text-sm font-semibold text-primary">{name}</p>}
        <p className="text-sm text-tertiary">{description}</p>
      </div>
    </div>
  )
}

function FieldError({ children }) {
  return children ? <p className="mt-1.5 text-sm text-error-primary">{children}</p> : null
}

function ConfirmDelete({ title, text, onConfirm, onClose }) {
  return (
    <AppDialog
      isOpen
      onClose={onClose}
      size="sm"
      icon={Trash01}
      iconColor="error"
      title={title}
      subtitle={text}
      footer={
        <>
          <Button color="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button color="primary-destructive" size="md" iconLeading={Trash01} onClick={onConfirm}>
            Delete
          </Button>
        </>
      }
    />
  )
}

/** A row in a master list: code, name and details, and its actions. */
function MasterRow({ code, title, inactive, badges, details, actions }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
      <Badge size="sm" color="gray" type="modern" className="shrink-0 self-start font-mono sm:self-center">
        {code}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-primary">
          {title}
          {inactive && <StatusBadge status={MASTER_STATUS.INACTIVE} />}
          {badges}
        </p>
        <p className="text-sm text-tertiary">{details}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
    </li>
  )
}

/* ------------------------------------------------------ document categories */

function CategoryDialog({ category, categories, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    code: category?.code || '',
    name: category?.name || '',
    description: category?.description || '',
  }))
  const [errors, setErrors] = useState({})
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }))

  const save = () => {
    const code = form.code.trim().toUpperCase()
    const name = form.name.trim()
    const others = categories.filter((item) => item.id !== category?.id)
    const next = {}
    if (!/^[A-Z]{2,5}$/.test(code)) next.code = 'Two to five letters.'
    else if (others.some((item) => item.code === code)) next.code = 'Another category uses this code.'
    if (!name) next.name = 'Name the category.'
    else if (others.some((item) => item.name.toLowerCase() === name.toLowerCase())) next.name = 'Another category has this name.'
    setErrors(next)
    if (Object.keys(next).length === 0) onSave({ code, name, description: form.description.trim() })
  }

  return (
    <AppDialog
      isOpen
      onClose={onClose}
      size="md"
      icon={category ? Edit03 : Plus}
      title={category ? `Edit ${category.name}` : 'Add document category'}
      subtitle="Categories are the repository’s tabs. Renaming one renames it on every document in it."
      footer={
        <>
          <Button color="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button color="primary" size="md" iconLeading={Check} onClick={save}>
            {category ? 'Save category' : 'Add category'}
          </Button>
        </>
      }
    >
      <FormGrid>
        <Input
          label="Code"
          isRequired
          value={form.code}
          onChange={set('code')}
          isInvalid={Boolean(errors.code)}
          hint={errors.code || 'Two to five letters, e.g. WI.'}
          inputClassName="font-mono uppercase"
        />
        <Input
          label="Name"
          isRequired
          value={form.name}
          onChange={set('name')}
          isInvalid={Boolean(errors.name)}
          hint={errors.name}
          placeholder="e.g. Work Instructions"
        />
        <FormSpan>
          <TextArea label="Description" rows={2} value={form.description} onChange={set('description')} placeholder="Optional" />
        </FormSpan>
      </FormGrid>
    </AppDialog>
  )
}

/** Kept collapsed: the client asked for categories to sit in a discreet corner of Settings (Confirmed #20). */
function CategoriesPanel() {
  const { user } = useAuth()
  const { documentCategories, documents, documentRequests, addCategory, patchCategory, removeCategory, log } = useData()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const documentCount = (category) => documents.filter((doc) => doc.categoryId === category.id).length
  const used = (category) =>
    documentCount(category) + documentRequests.filter((request) => request.categoryId === category.id).length
  const active = documentCategories.filter((category) => category.status !== MASTER_STATUS.INACTIVE)
  const record = (category) => ({ type: 'category', id: category.id, label: `${category.code} ${category.name}` })

  const save = (fields) => {
    if (editing === 'new') {
      const category = { id: `CAT-${Date.now()}`, ...fields, icon: 'folder', status: MASTER_STATUS.ACTIVE }
      addCategory(category)
      log(user, 'Added Category', 'Settings', record(category), `Added the ${category.name} category.`)
    } else {
      patchCategory(editing.id, fields)
      log(
        user,
        'Updated Category',
        'Settings',
        record({ ...editing, ...fields }),
        editing.name !== fields.name ? `Renamed from ${editing.name} to ${fields.name}.` : 'Category details updated.',
      )
    }
    setEditing(null)
  }

  const toggle = (category) => {
    const activating = category.status === MASTER_STATUS.INACTIVE
    patchCategory(category.id, { status: activating ? MASTER_STATUS.ACTIVE : MASTER_STATUS.INACTIVE })
    log(
      user,
      activating ? 'Activated Category' : 'Deactivated Category',
      'Settings',
      record(category),
      activating ? 'Offered for new documents again.' : 'Kept on its documents; no longer offered for new ones.',
    )
  }

  const confirmDelete = () => {
    removeCategory(deleting.id)
    log(user, 'Deleted Category', 'Settings', record(deleting), 'Removed; no document or request had used it.')
    setDeleting(null)
  }

  return (
    <Section
      title="Document categories"
      subtitle="The repository’s category tabs."
      actions={
        <Button
          color="secondary"
          size="sm"
          iconTrailing={(props) => <ChevronDown {...props} className={cx(props.className, open && 'rotate-180')} />}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          {open ? 'Hide categories' : 'Manage categories'}
        </Button>
      }
    >
      {!open ? (
        <div className="flex flex-wrap gap-2">
          {active.map((category) => (
            <Badge key={category.id} size="sm" color="gray" type="modern">
              {category.name}
            </Badge>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="divide-y divide-secondary rounded-xl ring-1 ring-secondary">
            {documentCategories.map((category) => {
              const inactive = category.status === MASTER_STATUS.INACTIVE
              return (
                <MasterRow
                  key={category.id}
                  code={category.code}
                  title={category.name}
                  inactive={inactive}
                  details={`${category.description || 'No description'} · ${pluralize(documentCount(category), 'document')}`}
                  actions={
                    <>
                      <Button size="sm" color="secondary" iconLeading={Edit03} onClick={() => setEditing(category)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        color="tertiary"
                        isDisabled={!inactive && active.length === 1}
                        onClick={() => toggle(category)}
                      >
                        {inactive ? 'Activate' : 'Deactivate'}
                      </Button>
                      {used(category) === 0 && (
                        <Button size="sm" color="tertiary" iconLeading={Trash01} onClick={() => setDeleting(category)}>
                          Delete
                        </Button>
                      )}
                    </>
                  }
                />
              )
            })}
          </ul>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-tertiary">
              An inactive category stays on its documents but can’t be chosen for new ones. Only a category no document
              or request has used can be deleted.
            </p>
            <Button size="sm" color="secondary" iconLeading={Plus} className="shrink-0" onClick={() => setEditing('new')}>
              Add category
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <CategoryDialog
          category={editing === 'new' ? null : editing}
          categories={documentCategories}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDelete
          title={`Delete ${deleting.name}?`}
          text="No document or request uses this category. Deleting it can’t be undone."
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </Section>
  )
}

/* ------------------------------------------------------------ CAR sources */

function SourceDialog({ source, sources, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    code: source?.code || '',
    name: source?.name || '',
    description: source?.description || '',
    group: source?.group || CAR_SOURCE_GROUPS[0],
    requiresSpecify: Boolean(source?.requiresSpecify),
  }))
  const [errors, setErrors] = useState({})
  const set = (key) => (value) =>
    setForm((current) => ({ ...current, [key]: value?.target ? value.target.value : value }))

  const save = () => {
    const code = form.code.trim().toUpperCase()
    const name = form.name.trim()
    const others = sources.filter((item) => item.code !== source?.code)
    const next = {}
    if (!source) {
      if (!/^[A-Z]{3}$/.test(code)) next.code = 'Three letters, like IQA.'
      else if (sources.some((item) => item.code === code)) next.code = 'Another source uses this code.'
    }
    if (!name) next.name = 'Name the source.'
    else if (others.some((item) => item.name.toLowerCase() === name.toLowerCase())) next.name = 'Another source has this name.'
    setErrors(next)
    if (Object.keys(next).length === 0) {
      onSave({ code: source ? source.code : code, name, description: form.description.trim(), group: form.group, requiresSpecify: form.requiresSpecify })
    }
  }

  return (
    <AppDialog
      isOpen
      onClose={onClose}
      size="md"
      icon={source ? Edit03 : Plus}
      title={source ? `Edit ${source.code}` : 'Add CAR source'}
      subtitle="Where a finding came from. The code starts every CAR number from this source."
      footer={
        <>
          <Button color="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button color="primary" size="md" iconLeading={Check} onClick={save}>
            {source ? 'Save source' : 'Add source'}
          </Button>
        </>
      }
    >
      <FormGrid>
        <Input
          label="Code"
          isRequired={!source}
          isReadOnly={Boolean(source)}
          value={form.code}
          onChange={set('code')}
          isInvalid={Boolean(errors.code)}
          hint={errors.code || (source ? 'Part of every CAR number from this source, so it can’t change.' : 'Three letters. It can’t change once saved.')}
          inputClassName="font-mono uppercase"
        />
        <NativeSelect
          label="Group"
          value={form.group}
          onChange={set('group')}
          options={CAR_SOURCE_GROUPS.map((group) => ({ value: group, label: group }))}
        />
        <FormSpan>
          <Input
            label="Name"
            isRequired
            value={form.name}
            onChange={set('name')}
            isInvalid={Boolean(errors.name)}
            hint={errors.name}
            placeholder="e.g. Supplier Audit Finding"
          />
        </FormSpan>
        <FormSpan>
          <TextArea label="Description" rows={2} value={form.description} onChange={set('description')} placeholder="Optional" />
        </FormSpan>
        <FormSpan>
          <Checkbox
            label="Ask the issuer to specify"
            hint="Like OTH and QSD: the CAR can’t be issued until the issuer describes the source."
            isSelected={form.requiresSpecify}
            onChange={set('requiresSpecify')}
          />
        </FormSpan>
      </FormGrid>
    </AppDialog>
  )
}

function CarSourcesPanel() {
  const { user } = useAuth()
  const { carSources, cars, addCarSource, patchCarSource, removeCarSource, log } = useData()
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const carCount = (source) => cars.filter((car) => car.source === source.code).length
  const active = carSources.filter((source) => source.status !== MASTER_STATUS.INACTIVE)
  const record = (source) => ({ type: 'source', id: source.code, label: `${source.code} ${source.name}` })

  const save = (fields) => {
    if (editing === 'new') {
      addCarSource({ ...fields, status: MASTER_STATUS.ACTIVE })
      log(user, 'Added CAR Source', 'Settings', record(fields), `${fields.name}, in the ${fields.group} group.`)
    } else {
      patchCarSource(editing.code, fields)
      const changed = ['name', 'description', 'group', 'requiresSpecify']
        .filter((key) => editing[key] !== fields[key])
        .map((key) => (key === 'requiresSpecify' ? (fields.requiresSpecify ? 'now asks to specify' : 'no longer asks to specify') : `${key} updated`))
      log(user, 'Updated CAR Source', 'Settings', record(fields), changed.length ? `${changed.join('; ')}.` : 'No changes.')
    }
    setEditing(null)
  }

  const toggle = (source) => {
    const activating = source.status === MASTER_STATUS.INACTIVE
    patchCarSource(source.code, { status: activating ? MASTER_STATUS.ACTIVE : MASTER_STATUS.INACTIVE })
    log(
      user,
      activating ? 'Activated CAR Source' : 'Deactivated CAR Source',
      'Settings',
      record(source),
      activating ? 'Offered when issuing a CAR again.' : 'Kept on its CARs; no longer offered when issuing one.',
    )
  }

  const confirmDelete = () => {
    removeCarSource(deleting.code)
    log(user, 'Deleted CAR Source', 'Settings', record(deleting), 'Removed; no CAR had used it.')
    setDeleting(null)
  }

  return (
    <Section
      title="CAR sources"
      subtitle="Where a finding came from. A source that CARs use can be deactivated, but not deleted."
      actions={
        <Button size="sm" color="secondary" iconLeading={Plus} onClick={() => setEditing('new')}>
          Add source
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {CAR_SOURCE_GROUPS.map((group) => (
          <div key={group} className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-wide text-quaternary uppercase">{group}</p>
            <ul className="divide-y divide-secondary rounded-xl ring-1 ring-secondary">
              {carSources
                .filter((source) => (source.group || CAR_SOURCE_GROUPS[0]) === group)
                .map((source) => {
                  const inactive = source.status === MASTER_STATUS.INACTIVE
                  const count = carCount(source)
                  return (
                    <MasterRow
                      key={source.code}
                      code={source.code}
                      title={source.name}
                      inactive={inactive}
                      badges={
                        source.requiresSpecify && (
                          <Badge size="sm" color="gray" type="modern">
                            Asks to specify
                          </Badge>
                        )
                      }
                      details={`${source.description || 'No description'} · ${pluralize(count, 'CAR')}`}
                      actions={
                        <>
                          <Button size="sm" color="secondary" iconLeading={Edit03} onClick={() => setEditing(source)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            color="tertiary"
                            isDisabled={!inactive && active.length === 1}
                            onClick={() => toggle(source)}
                          >
                            {inactive ? 'Activate' : 'Deactivate'}
                          </Button>
                          {count === 0 && (
                            <Button size="sm" color="tertiary" iconLeading={Trash01} onClick={() => setDeleting(source)}>
                              Delete
                            </Button>
                          )}
                        </>
                      }
                    />
                  )
                })}
            </ul>
          </div>
        ))}
      </div>

      {editing && (
        <SourceDialog
          source={editing === 'new' ? null : editing}
          sources={carSources}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDelete
          title={`Delete ${deleting.code}?`}
          text="No CAR uses this source. Deleting it can’t be undone."
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------- page */

export default function Settings() {
  const { user } = useAuth()
  const { settings, carSources, carStatuses, documents, nextCarNumber, saveSettings, log } = useData()
  const [tab, setTab] = useState('general')
  const [draft, setDraft] = useState(() => clone(settings))
  const [errors, setErrors] = useState({})
  const [savedNote, setSavedNote] = useState(null)

  const { errors: problems, changes, next, limitRows } = prepare(settings, draft)
  const dirty = changes.length > 0
  const errorCount = Object.keys(errors).length

  const update = (key, value, errorKey = key) => {
    setDraft((current) => withPath(current, key, value))
    setErrors((current) => (current[errorKey] ? omit(current, errorKey) : current))
    setSavedNote(null)
  }

  const save = () => {
    setErrors(problems)
    const keys = Object.keys(problems)
    if (keys.length) {
      setTab(tabOf(keys[0]) || tab)
      setSavedNote(null)
      return
    }
    saveSettings(next)
    for (const change of changes) {
      log(user, 'Changed Setting', 'Settings', { type: 'setting', label: change.label }, change.details)
    }
    setDraft(clone(next))
    setSavedNote({ count: changes.length, at: timestamp() })
  }

  const discard = () => {
    setDraft(clone(settings))
    setErrors({})
    setSavedNote(null)
  }

  /* ---------------------------------------------------------------- inputs */
  const textInput = (key, { hint, ...props } = {}) => (
    <Input
      aria-label={FIELD[key].label}
      value={String(getPath(draft, key) ?? '')}
      onChange={(value) => update(key, value)}
      isInvalid={Boolean(errors[key])}
      hint={errors[key] || hint}
      {...props}
    />
  )

  const numberInput = (key) => (
    <>
      <div className="flex items-center gap-3">
        <div className="w-28">
          <Input
            type="number"
            aria-label={FIELD[key].label}
            value={String(getPath(draft, key) ?? '')}
            onChange={(value) => update(key, value)}
            isInvalid={Boolean(errors[key])}
          />
        </div>
        {FIELD[key].unit && <span className="text-sm text-tertiary">{FIELD[key].unit}</span>}
      </div>
      <FieldError>{errors[key]}</FieldError>
    </>
  )

  const toggleInput = (key) => (
    <Toggle aria-label={FIELD[key].label} isSelected={Boolean(getPath(draft, key))} onChange={(value) => update(key, value)} />
  )

  const selectInput = (key, options) => (
    <>
      <NativeSelect
        aria-label={FIELD[key].label}
        value={getPath(draft, key) ?? ''}
        onChange={(event) => update(key, event.target.value)}
        options={options}
      />
      <FieldError>{errors[key]}</FieldError>
    </>
  )

  /* ----------------------------------------------------- CAR number preview */
  const activeSources = carSources.filter((source) => source.status !== MASTER_STATUS.INACTIVE)
  const formatProblem = problems['car.numberFormat']
  const previewRules = { ...draft.car, numberFormat: String(draft.car.numberFormat).trim() }

  /* ------------------------------------------------------------ watermarks */
  const templates = draft.document.watermarkTemplates
  const defaultTemplateId = draft.document.defaultWatermarkTemplateId

  const setTemplate = (index, field) => (value) =>
    update(
      'document.watermarkTemplates',
      templates.map((template, position) => (position === index ? { ...template, [field]: value } : template)),
      `document.watermarkTemplates.${index}.${field}`,
    )

  const addTemplate = () => {
    const highest = templates.reduce((max, template) => Math.max(max, Number(/^WM-(\d+)$/.exec(template.id)?.[1] || 0)), 0)
    update('document.watermarkTemplates', [
      ...templates,
      { id: `WM-${String(highest + 1).padStart(2, '0')}`, name: '', template: '{DEPARTMENT} | {PERSONNEL} | {DATETIME} | CONTROLLED COPY' },
    ])
  }

  const removeTemplate = (index) =>
    update(
      'document.watermarkTemplates',
      templates.filter((_, position) => position !== index),
    )

  /* ---------------------------------------------------------- DRCN limits */
  const limits = draft.document.drcnReviewLimits
  const setLimit = (index, field) => (value) =>
    update(
      'document.drcnReviewLimits',
      limits.map((row, position) => {
        if (position !== index) return row
        return field === 'to' ? { ...row, documents: [row.documents[0], value] } : { ...row, maxDays: value }
      }),
      `document.drcnReviewLimits.${index}.${field}`,
    )

  const fileTypes = draft.document.allowedFileTypes

  const tabErrors = (id) => Object.keys(errors).filter((key) => tabOf(key) === id).length

  return (
    <Page>
      <PageHeader
        title="System Settings"
        subtitle="The rules behind the repository and the CAR workflow. Saved changes take effect straight away and are recorded in the activity log."
        actions={
          <>
            {dirty && <span className="text-sm text-tertiary">{pluralize(changes.length, 'unsaved change')}</span>}
            {dirty && (
              <Button color="secondary" size="md" iconLeading={ReverseLeft} onClick={discard}>
                Discard
              </Button>
            )}
            <Button color="primary" size="md" iconLeading={Check} isDisabled={!dirty} onClick={save}>
              Save changes
            </Button>
          </>
        }
      >
        <Tabs selectedKey={tab} onSelectionChange={setTab}>
          <TabList type="button-border" size="sm" className="overflow-x-auto">
            {TABS.map((item) => (
              <Tab key={item.id} id={item.id} label={item.label} badge={tabErrors(item.id) || undefined} />
            ))}
          </TabList>
        </Tabs>
      </PageHeader>

      {errorCount > 0 && (
        <Callout tone="error" icon={AlertTriangle} title="Nothing was saved">
          {pluralize(errorCount, 'setting')} {errorCount === 1 ? 'needs' : 'need'} fixing first — the tabs with a count
          show where.
        </Callout>
      )}

      {savedNote && (
        <Callout tone="success" icon={CheckCircle} title={`Saved ${pluralize(savedNote.count, 'change')}`}>
          In effect from {formatDateTime(savedNote.at)} and recorded in the activity log.
        </Callout>
      )}

      {tab === 'general' && (
        <Card bodyClassName="flex flex-col gap-8 py-6">
          <Section title="Organization" subtitle="Shown on the sign-in page, in the sidebar and on reports.">
            <div>
              <SettingRow label="Organization name">{textInput('organization.name')}</SettingRow>
              <SettingRow label="Standard">{textInput('organization.standard')}</SettingRow>
              <SettingRow label="System name">{textInput('organization.systemName')}</SettingRow>
              <SettingRow label="Short name" hint="Shown in the sidebar.">
                {textInput('organization.shortName')}
              </SettingRow>
            </div>
          </Section>

          <Section title="Reports">
            <div>
              <SettingRow label="Default report period" hint="The period the Reports page opens on.">
                {selectInput(
                  'reporting.defaultPeriod',
                  draft.reporting.periods.map((value) => ({ value, label: value })),
                )}
              </SettingRow>
            </div>
          </Section>

          <Section title="Notifications">
            <div>
              <SettingRow label="In-app notifications" hint="Always on — the notification centre is the system of record.">
                <Toggle isSelected isDisabled aria-label="In-app notifications" />
              </SettingRow>
              <SettingRow label="Email notifications" hint={settings.notifications.emailNote}>
                {toggleInput('notifications.email')}
              </SettingRow>
            </div>
          </Section>

          <Section title="About">
            <div className="flex flex-wrap gap-2">
              <Badge size="sm" color="gray" type="modern">
                {APP.fullName}
              </Badge>
              <Badge size="sm" color="gray" type="modern">
                {APP.version}
              </Badge>
              <Badge size="sm" color="gray" type="modern">
                Prototype data: /database
              </Badge>
            </div>
          </Section>
        </Card>
      )}

      {tab === 'car' && (
        <Card bodyClassName="flex flex-col gap-8 py-6">
          <Section title="CAR numbers" subtitle="Generated when a CAR is issued.">
            <div>
              <SettingRow
                label="Number format"
                hint="{SRC} source code, {YY} two-digit year, {ZZZ} sequence 001–999 — each used once."
              >
                {textInput('car.numberFormat', { inputClassName: 'font-mono' })}
              </SettingRow>
              <SettingRow label="Sequence restarts" hint={settings.car.sequenceResetNote}>
                {selectInput('car.sequenceReset', CAR_SEQUENCE_RESET_OPTIONS)}
              </SettingRow>
              <SettingRow label="Preview" hint="The number the next CAR from each active source would get.">
                {formatProblem ? (
                  <p className="text-sm text-error-primary">{formatProblem}</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="font-mono text-display-xs font-semibold text-primary">
                      {nextCarNumber(activeSources[0]?.code || 'IQA', previewRules)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {activeSources.map((source) => (
                        <Badge key={source.code} size="sm" color="gray" type="modern" className="font-mono">
                          {nextCarNumber(source.code, previewRules)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </SettingRow>
            </div>
          </Section>

          <Section title="Reply and reminders">
            <div>
              <SettingRow
                label="Reply period"
                hint="Working days (Monday to Friday) from the date issued. Public holidays are not excluded yet."
              >
                {numberInput('car.replyDueWorkingDays')}
              </SettingRow>
              <SettingRow
                label="Reminder before a deadline"
                hint="Days before any CAR deadline that whoever owns the stage is reminded. 0 reminds on the day."
              >
                {numberInput('car.dueSoonReminderDays')}
              </SettingRow>
              <SettingRow label="Flag overdue automatically" hint="Mark a CAR overdue once the deadline of its current stage passes.">
                {toggleInput('car.autoFlagOverdue')}
              </SettingRow>
            </div>
          </Section>

          <Section title="Verification and effectiveness">
            <div>
              <SettingRow
                label="Verification after the target date"
                hint="The CAR form says a day after the target completion date. Counted in calendar days until the client confirms (follow-up E7)."
              >
                {numberInput('car.verificationOffsetDays')}
              </SettingRow>
              <SettingRow
                label="Effectiveness check after close-out"
                hint="Or at the next internal audit, whichever comes first."
              >
                {numberInput('car.effectivenessMonths')}
              </SettingRow>
              <SettingRow label="Next internal audit" hint="Leave empty when no audit is scheduled.">
                {textInput('car.nextInternalAudit', { type: 'date' })}
              </SettingRow>
              <SettingRow
                label="Extended monitoring interval"
                hint="Time between checks on a CAR kept under extended monitoring."
              >
                {numberInput('car.extendedMonitoringMonths')}
              </SettingRow>
            </div>

            <Callout tone="gray" icon={InfoCircle} title="When a change applies" className="mt-4">
              Saved values apply to every date worked out from then on, and to overdue flags and reminders straight away.
              A date already set on a CAR — its reply, verification or effectiveness due date — keeps its value.
            </Callout>
          </Section>

          <Section title="CAR statuses" subtitle="Set by the workflow, so they are not editable here.">
            <div>
              {carStatuses.map((status) => (
                <ReferenceRow key={status.key} code={status.key} description={status.description} tone />
              ))}
            </div>
          </Section>
        </Card>
      )}

      {tab === 'documents' && (
        <Card bodyClassName="flex flex-col gap-8 py-6">
          <Section
            title="Dynamic watermark"
            subtitle="A QMS Admin chooses, per document, whether downloads are watermarked and with which template."
          >
            <div>
              <SettingRow
                label="Watermark new documents by default"
                hint="Pre-ticks the watermark when a new document is approved. Each document keeps its own choice."
              >
                {toggleInput('document.dynamicWatermark')}
              </SettingRow>
              <SettingRow label="Default template" hint="For watermarked documents that don’t name a template of their own.">
                {selectInput(
                  'document.defaultWatermarkTemplateId',
                  templates.map((template) => ({ value: template.id, label: template.name || 'Untitled template' })),
                )}
              </SettingRow>
            </div>

            <div className="flex flex-col gap-3">
              <ul className="flex flex-col gap-3">
                {templates.map((template, index) => {
                  const usedBy = documentsUsingTemplate(documents, template.id, defaultTemplateId).length
                  const isDefault = template.id === defaultTemplateId
                  const locked = isDefault || usedBy > 0 || templates.length === 1
                  return (
                    <li key={template.id} className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-secondary">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex flex-wrap items-center gap-2 text-sm text-tertiary">
                          <Badge size="sm" color="gray" type="modern" className="font-mono">
                            {template.id}
                          </Badge>
                          {isDefault && (
                            <Badge size="sm" color="brand">
                              Default
                            </Badge>
                          )}
                          {pluralize(usedBy, 'document')}
                        </span>
                        <Button
                          size="sm"
                          color="tertiary"
                          iconLeading={Trash01}
                          isDisabled={locked}
                          onClick={() => removeTemplate(index)}
                        >
                          Remove
                        </Button>
                      </div>
                      <Input
                        label="Name"
                        value={template.name}
                        onChange={setTemplate(index, 'name')}
                        isInvalid={Boolean(errors[`document.watermarkTemplates.${index}.name`])}
                        hint={errors[`document.watermarkTemplates.${index}.name`]}
                      />
                      <Input
                        label="Watermark text"
                        value={template.template}
                        onChange={setTemplate(index, 'template')}
                        inputClassName="font-mono"
                        isInvalid={Boolean(errors[`document.watermarkTemplates.${index}.template`])}
                        hint={errors[`document.watermarkTemplates.${index}.template`]}
                      />
                      <p className="rounded-lg border border-dashed border-primary p-3 font-mono text-xs wrap-break-word text-tertiary">
                        {renderWatermark(template.template) || 'Nothing to stamp yet'}
                      </p>
                    </li>
                  )
                })}
              </ul>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-sm text-tertiary">
                  Previews use sample values. A template in use, or set as the default, can’t be removed.
                </p>
                <Button size="sm" color="secondary" iconLeading={Plus} className="shrink-0" onClick={addTemplate}>
                  Add template
                </Button>
              </div>

              <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 rounded-xl bg-secondary p-4 sm:grid-cols-2">
                {WATERMARK_PLACEHOLDERS.map((item) => (
                  <div key={item.token} className="flex items-baseline gap-2 text-sm">
                    <dt className="shrink-0 font-mono text-primary">{`{${item.token}}`}</dt>
                    <dd className="text-tertiary">{item.label}</dd>
                  </div>
                ))}
                <div className="flex items-baseline gap-2 text-sm sm:col-span-2">
                  <dt className="shrink-0 text-primary">Anything else</dt>
                  <dd className="text-tertiary">is stamped as written, such as CONTROLLED COPY.</dd>
                </div>
              </dl>
            </div>
          </Section>

          <Section
            title="Review time limits"
            subtitle="The maximum review time from the Document Review / Change Notice, counted in working days (follow-up B6)."
          >
            <div className="overflow-x-auto rounded-xl ring-1 ring-secondary">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-secondary bg-secondary">
                    {['Process type', 'Document level', 'Documents per request', 'Maximum review time'].map((label) => (
                      <th key={label} scope="col" className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-tertiary">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {limits.map((row, index) => {
                    const shown = limitRows[index]
                    const last = !sameGroup(limits[index], limits[index + 1])
                    const toError = errors[`document.drcnReviewLimits.${index}.to`]
                    const daysError = errors[`document.drcnReviewLimits.${index}.maxDays`]
                    return (
                      <tr key={`${row.processType}-${row.levels.join()}-${index}`} className="border-b border-secondary align-top last:border-b-0">
                        <td className="px-4 py-3 font-medium whitespace-nowrap text-primary">{row.processType}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-secondary">{levelsText(row.levels)}</td>
                        <td className="px-4 py-3 text-secondary">
                          {!row.documents ? (
                            'Any'
                          ) : last ? (
                            `${shown.documents[0]} and above`
                          ) : (
                            <>
                              <span className="flex items-center gap-2 whitespace-nowrap">
                                {shown.documents[0]} to
                                <span className="w-20">
                                  <Input
                                    type="number"
                                    size="sm"
                                    aria-label={`Upper document count, ${row.processType} ${levelsText(row.levels)}`}
                                    value={String(row.documents[1] ?? '')}
                                    onChange={setLimit(index, 'to')}
                                    isInvalid={Boolean(toError)}
                                  />
                                </span>
                              </span>
                              <FieldError>{toError}</FieldError>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2 whitespace-nowrap text-tertiary">
                            <span className="w-20">
                              <Input
                                type="number"
                                size="sm"
                                aria-label={`Maximum review days, ${row.processType} ${levelsText(row.levels)}`}
                                value={String(row.maxDays ?? '')}
                                onChange={setLimit(index, 'maxDays')}
                                isInvalid={Boolean(daysError)}
                              />
                            </span>
                            working days
                          </span>
                          <FieldError>{daysError}</FieldError>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-tertiary">
              A new limit applies to requests received from then on; a request already received keeps its due date.
            </p>
          </Section>

          <Section title="Files and review">
            <div>
              <SettingRow label="Review reminder" hint="Days before a document’s review date that QMS and its department are reminded.">
                {numberInput('document.reviewReminderDays')}
              </SettingRow>
              <SettingRow label="Maximum upload size">{numberInput('document.maxFileSizeMB')}</SettingRow>
              <SettingRow label="Allowed file types" hint="For drafts attached to requests and evidence attached to CARs.">
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {FILE_TYPE_OPTIONS.map((type) => (
                    <Checkbox
                      key={type}
                      label={type}
                      isSelected={fileTypes.includes(type)}
                      onChange={(selected) =>
                        update(
                          'document.allowedFileTypes',
                          selected ? [...fileTypes, type] : fileTypes.filter((item) => item !== type),
                        )
                      }
                    />
                  ))}
                </div>
                <FieldError>{errors['document.allowedFileTypes']}</FieldError>
              </SettingRow>
            </div>

            <Callout tone="success" icon={InfoCircle} className="mt-4">
              Previous versions are always retained and the last approved version is marked{' '}
              <strong>{settings.document.activeLabel}</strong>.
            </Callout>
          </Section>

          <CategoriesPanel />
        </Card>
      )}

      {tab === 'security' && (
        <Card bodyClassName="flex flex-col gap-8 py-6">
          <Section title="Passwords" subtitle="A moderate policy, as agreed with the client. It applies the next time a password is set.">
            <div>
              <SettingRow label="Minimum password length">{numberInput('session.passwordMinLength')}</SettingRow>
              <SettingRow label="Require a letter and a number">{toggleInput('session.passwordRequiresLetterAndNumber')}</SettingRow>
              <SettingRow
                label="Force a password change at first sign-in"
                hint="Off by agreement: an account keeps its handed-over password until the holder changes it."
              >
                {toggleInput('session.forcePasswordChangeOnFirstLogin')}
              </SettingRow>
            </div>
          </Section>

          <Section title="Sessions" subtitle="Recorded here now; enforced by the server in the implementation phase.">
            <div>
              <SettingRow label="Idle timeout" hint="Before an inactive session ends.">
                {numberInput('session.idleTimeoutMinutes')}
              </SettingRow>
              <SettingRow label="Maximum failed sign-in attempts" hint="Before the account is locked.">
                {numberInput('session.maxFailedLoginAttempts')}
              </SettingRow>
            </div>
          </Section>

          <Section title="Security requirements" subtitle="PRD 22">
            <div className="flex flex-wrap gap-2">
              {SECURITY_REQUIREMENTS.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary ring-1 ring-secondary ring-inset"
                >
                  <Shield01 className="size-3.5 text-fg-quaternary" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>

            <Callout tone="warning" icon={AlertTriangle} title="Prototype scope" className="mt-4">
              This build covers UI and UX only. Authentication, hashing, transport security and server-side
              authorization are implemented in the backend phase.
            </Callout>
          </Section>
        </Card>
      )}

      {tab === 'lists' && (
        <Card bodyClassName="flex flex-col gap-8 py-6">
          <Callout tone="gray" icon={InfoCircle}>
            Changes to master lists save as you make them and are recorded in the activity log. Document categories are
            managed on the Documents tab.
          </Callout>

          <CarSourcesPanel />

          <Section title="Temporary database">
            <p className="text-sm text-tertiary">
              Each table is a JSON file under <code className="font-mono text-primary">/database</code>. Replacing
              this folder with a real API only requires rewriting{' '}
              <code className="font-mono text-primary">src/data/db.js</code>.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {DATABASE_TABLES.map((file) => (
                <Badge key={file} size="sm" color="gray" type="modern" className="font-mono">
                  {file}
                </Badge>
              ))}
            </div>
          </Section>
        </Card>
      )}
    </Page>
  )
}
