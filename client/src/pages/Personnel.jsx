/* ============================================================================
   Personnel (Confirmed requirements #3, #11)
   ----------------------------------------------------------------------------
   The people behind a shared department account. They never sign in; they are
   the names chosen as responsible person on CARs and the addresses that CAR
   notifications are emailed to. A department account keeps its own list; QMS
   Admins and Dev can see and maintain every department's list.
   ========================================================================== */

import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Edit03, InfoCircle, Plus, UserCheck01, UserSquare, UserX01, Users01 } from '@untitledui/icons'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  AppDialog,
  AvatarLabelGroup,
  Button,
  ButtonUtility,
  Callout,
  DataTable,
  FilterBar,
  FormGrid,
  FormSpan,
  Input,
  MetricCard,
  NativeSelect,
  PageState,
  StatStrip,
  StatusBadge,
} from '@/components/ui'
import { ALL, CAR_STATUS, ORG_WIDE_ROLES, PERMISSION, PERSONNEL_STATUS } from '@/config/constants'
import { useAuth, useData } from '@/context/contexts'
import { matchesQuery, matchesValue } from '@/utils/filters'
import { initials, timestamp } from '@/utils/format'
import { isEmail } from '@/utils/validation'

const COLUMNS = [
  { id: 'person', label: 'Name', isRowHeader: true },
  { id: 'department', label: 'Department' },
  { id: 'employeeNo', label: 'Employee no.' },
  {
    id: 'cars',
    label: 'Open CARs',
    tooltip: 'CARs not yet closed where this person is named as the responsible person.',
  },
  { id: 'status', label: 'Status' },
  { id: 'actions', label: '', align: 'right' },
]

const blank = { fullName: '', position: '', employeeNo: '', email: '', departmentId: '' }

/** Add or edit one person. Mounted fresh for each open so its fields start from the record. */
function PersonnelDialog({ member, departmentId, departments, fixedDepartment, existing, onSave, onClose }) {
  const [form, setForm] = useState(() =>
    member
      ? { fullName: member.fullName, position: member.position, employeeNo: member.employeeNo || '', email: member.email, departmentId: member.departmentId }
      : { ...blank, departmentId },
  )
  const [errors, setErrors] = useState({})

  const set = (key) => (value) =>
    setForm((current) => ({ ...current, [key]: value?.target ? value.target.value : value }))

  const save = () => {
    const next = {}
    if (!form.fullName.trim()) next.fullName = 'Enter the person’s full name.'
    if (!form.position.trim()) next.position = 'Enter their position.'
    if (!form.departmentId) next.departmentId = 'Choose the department they belong to.'
    if (!isEmail(form.email)) next.email = 'Enter a valid email address — CAR notifications are sent here.'
    else if (
      existing.some(
        (person) =>
          person.id !== member?.id &&
          person.departmentId === form.departmentId &&
          person.email.toLowerCase() === form.email.trim().toLowerCase(),
      )
    )
      next.email = 'Someone in this department already uses that email address.'
    setErrors(next)
    if (Object.keys(next).length === 0) onSave(form)
  }

  return (
    <AppDialog
      isOpen
      onClose={onClose}
      size="md"
      icon={member ? Edit03 : Plus}
      title={member ? `Edit ${member.fullName}` : 'Add personnel'}
      subtitle="Personnel don’t sign in. They are named on CARs and receive the notification emails."
      footer={
        <>
          <Button color="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button color="primary" size="md" iconLeading={Check} onClick={save}>
            {member ? 'Save changes' : 'Add to list'}
          </Button>
        </>
      }
    >
      <FormGrid>
        <FormSpan>
          <Input
            label="Full name"
            isRequired
            isInvalid={Boolean(errors.fullName)}
            hint={errors.fullName}
            value={form.fullName}
            onChange={set('fullName')}
            placeholder="e.g. Carlo Mendoza"
          />
        </FormSpan>
        <Input
          label="Position"
          isRequired
          isInvalid={Boolean(errors.position)}
          hint={errors.position}
          value={form.position}
          onChange={set('position')}
          placeholder="e.g. Line Leader"
        />
        <Input
          label="Employee no."
          value={form.employeeNo}
          onChange={set('employeeNo')}
          placeholder="Optional"
          inputClassName="font-mono"
        />
        <FormSpan>
          <Input
            label="Email"
            type="email"
            isRequired
            isInvalid={Boolean(errors.email)}
            hint={errors.email || 'CAR notifications for this person are emailed here.'}
            value={form.email}
            onChange={set('email')}
            placeholder="name@company.com"
          />
        </FormSpan>
        {!fixedDepartment && !member && (
          <FormSpan>
            <NativeSelect
              label="Department"
              value={form.departmentId}
              onChange={set('departmentId')}
              hint={errors.departmentId}
              options={[
                { value: '', label: 'Select department…' },
                ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
              ]}
            />
          </FormSpan>
        )}
      </FormGrid>
    </AppDialog>
  )
}

export default function Personnel() {
  const { user, can } = useAuth()
  const { personnel, departments, cars, deptName, addPersonnel, patchPersonnel, log } = useData()

  const orgWide = ORG_WIDE_ROLES.includes(user.role)
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)

  /* A department account only ever sees its own people. */
  const scope = orgWide ? personnel : personnel.filter((person) => person.departmentId === user.departmentId)

  const canManage = (person) =>
    can(PERMISSION.PERSONNEL_MANAGE) && (orgWide || person.departmentId === user.departmentId)

  const openCars = useMemo(() => {
    const counts = {}
    for (const car of cars) {
      const id = car.recipient.personnelId
      if (id && car.status !== CAR_STATUS.CLOSED) counts[id] = (counts[id] || 0) + 1
    }
    return counts
  }, [cars])

  const rows = useMemo(
    () =>
      scope
        .filter(
          (person) =>
            matchesQuery(person, query, ['fullName', 'position', 'email', 'employeeNo']) &&
            matchesValue(person.departmentId, department) &&
            matchesValue(person.status, status),
        )
        .sort((a, b) => deptName(a.departmentId).localeCompare(deptName(b.departmentId)) || a.fullName.localeCompare(b.fullName)),
    [scope, query, department, status, deptName],
  )

  const active = scope.filter((person) => person.status === PERSONNEL_STATUS.ACTIVE).length
  const withOpenCars = scope.filter((person) => openCars[person.id]).length
  const hasFilters = query || department !== ALL || status !== ALL

  const record = (person, departmentId = person.departmentId) => ({
    type: 'personnel',
    id: person.id,
    label: `${person.fullName} (${deptName(departmentId)})`,
  })

  const save = (form) => {
    const fields = {
      fullName: form.fullName.trim(),
      position: form.position.trim(),
      employeeNo: form.employeeNo.trim() || null,
      email: form.email.trim(),
    }
    if (editing === 'new') {
      const member = {
        id: `PER-${Date.now()}`,
        departmentId: orgWide ? form.departmentId : user.departmentId,
        ...fields,
        status: PERSONNEL_STATUS.ACTIVE,
        avatarUrl: null,
        avatarColor: '#475467',
        addedBy: user.id,
        addedAt: timestamp(),
      }
      addPersonnel(member)
      log(user, 'Personnel Added', 'User', record(member), `${member.position} added to the personnel list.`)
    } else {
      patchPersonnel(editing.id, fields)
      log(user, 'Personnel Updated', 'User', record({ ...editing, ...fields }), 'Personnel details updated.')
    }
    setEditing(null)
  }

  const toggle = () => {
    const activating = confirm.status !== PERSONNEL_STATUS.ACTIVE
    patchPersonnel(confirm.id, { status: activating ? PERSONNEL_STATUS.ACTIVE : PERSONNEL_STATUS.INACTIVE })
    log(
      user,
      activating ? 'Personnel Activated' : 'Personnel Deactivated',
      'User',
      record(confirm),
      activating ? 'Available again as a responsible person.' : 'No longer offered as a responsible person; existing records kept.',
    )
    setConfirm(null)
  }

  const renderCell = (person, columnId) => {
    switch (columnId) {
      case 'person':
        return (
          <AvatarLabelGroup
            size="md"
            src={person.avatarUrl}
            initials={initials(person.fullName)}
            title={person.fullName}
            subtitle={`${person.position} · ${person.email}`}
          />
        )
      case 'department':
        return <span className="block min-w-0">{deptName(person.departmentId)}</span>
      case 'employeeNo':
        return person.employeeNo ? (
          <span className="font-mono whitespace-nowrap">{person.employeeNo}</span>
        ) : (
          <span className="text-quaternary">—</span>
        )
      case 'cars':
        return <span className="font-mono">{openCars[person.id] || 0}</span>
      case 'status':
        return <StatusBadge status={person.status} />
      case 'actions':
        return canManage(person) ? (
          <div className="flex items-center justify-end gap-1">
            <ButtonUtility size="xs" color="tertiary" tooltip="Edit" icon={Edit03} onClick={() => setEditing(person)} />
            <ButtonUtility
              size="xs"
              color="tertiary"
              tooltip={person.status === PERSONNEL_STATUS.ACTIVE ? 'Deactivate' : 'Activate'}
              icon={person.status === PERSONNEL_STATUS.ACTIVE ? UserX01 : UserCheck01}
              onClick={() => setConfirm(person)}
            />
          </div>
        ) : null
      default:
        return null
    }
  }

  const columns = orgWide ? COLUMNS : COLUMNS.filter((column) => column.id !== 'department')
  const deactivating = confirm?.status === PERSONNEL_STATUS.ACTIVE

  return (
    <Page>
      <PageHeader
        title="Personnel"
        subtitle={
          orgWide
            ? 'The people behind each department account. They are named as responsible persons on CARs and receive the notification emails.'
            : `Everyone who works under the ${deptName(user.departmentId)} account. Keep this list current — it is who a CAR can be assigned to.`
        }
        actions={
          can(PERMISSION.PERSONNEL_MANAGE) && (
            <Button color="primary" size="md" iconLeading={Plus} onClick={() => setEditing('new')}>
              Add personnel
            </Button>
          )
        }
      />

      <StatStrip columns={3}>
        <MetricCard label="On the list" value={scope.length} hint="Active and inactive" icon={Users01} />
        <MetricCard label="Active" value={active} hint="Can be assigned CARs" icon={UserCheck01} color="success" />
        <MetricCard label="Responsible for open CARs" value={withOpenCars} hint="At least one CAR not closed" icon={UserSquare} color="warning" />
      </StatStrip>

      <Callout tone="gray" icon={InfoCircle} title="Personnel don’t have their own sign-in">
        {orgWide
          ? 'Each department signs in with one shared account. When that account submits a response, it picks who did the work from this list, so the activity log names both.'
          : `Everyone listed signs in as ${user.fullName}. When you submit a CAR response you pick who prepared it, so the activity log names that person.`}
      </Callout>

      <div className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
        <FilterBar
          search={{ value: query, onChange: setQuery, placeholder: 'Search name, position, email or employee no.' }}
          filters={[
            ...(orgWide
              ? [
                  {
                    label: 'departments',
                    value: department,
                    onChange: setDepartment,
                    options: [
                      { value: ALL, label: 'All departments' },
                      ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
                    ],
                  },
                ]
              : []),
            {
              label: 'statuses',
              value: status,
              onChange: setStatus,
              options: [
                { value: ALL, label: 'All statuses' },
                ...Object.values(PERSONNEL_STATUS).map((value) => ({ value, label: value })),
              ],
            },
          ]}
          active={Boolean(hasFilters)}
          onReset={() => {
            setQuery('')
            setDepartment(ALL)
            setStatus(ALL)
          }}
        />

        {rows.length === 0 ? (
          <PageState
            icon={Users01}
            title={scope.length === 0 ? 'No personnel listed yet' : 'No personnel found'}
            text={
              scope.length === 0
                ? 'Add the people in this department so CARs can be assigned to them.'
                : 'No one matches the current search and filters.'
            }
          />
        ) : (
          <DataTable ariaLabel="Personnel" columns={columns} rows={rows} renderCell={renderCell} size="md" />
        )}
      </div>

      {editing && (
        <PersonnelDialog
          member={editing === 'new' ? null : editing}
          departmentId={orgWide ? (department === ALL ? '' : department) : user.departmentId}
          departments={departments}
          fixedDepartment={!orgWide}
          existing={personnel}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}

      <AppDialog
        isOpen={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        size="sm"
        icon={deactivating ? UserX01 : UserCheck01}
        iconColor={deactivating ? 'warning' : 'success'}
        title={deactivating ? 'Deactivate personnel' : 'Activate personnel'}
        subtitle={confirm ? `${confirm.fullName} — ${deptName(confirm.departmentId)}` : ''}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button color="primary" size="md" iconLeading={deactivating ? UserX01 : UserCheck01} onClick={toggle}>
              {deactivating ? 'Deactivate' : 'Activate'}
            </Button>
          </>
        }
      >
        {confirm && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-tertiary">
              {deactivating
                ? `${confirm.fullName} will no longer be offered as a responsible person on new CARs. CARs and records that already name them are kept.`
                : `${confirm.fullName} can be assigned CARs again.`}
            </p>
            {deactivating && openCars[confirm.id] > 0 && (
              <Callout tone="warning" icon={AlertTriangle}>
                They are still responsible for {openCars[confirm.id]} open CAR{openCars[confirm.id] === 1 ? '' : 's'}.
                Those CARs keep their name until someone else takes them over.
              </Callout>
            )}
          </div>
        )}
      </AppDialog>
    </Page>
  )
}
