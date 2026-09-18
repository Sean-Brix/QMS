/* ============================================================================
   User Management (PRD 7; Confirmed requirements #2, #4–#10)
   ----------------------------------------------------------------------------
   Individual QMS Admin accounts, one shared account per department, and Dev.
   Accounts are created with a temporary password to hand over, can be
   deactivated and reactivated, and are closed (archived) rather than deleted so
   their CARs, signatures and log entries stay attached to them.
   ========================================================================== */

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle,
  Copy01,
  InfoCircle,
  Key01,
  RefreshCw01,
  Shield01,
  UserCheck01,
  UserPlus01,
  UserX01,
  Users01,
} from '@untitledui/icons'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  AppDialog,
  AvatarLabelGroup,
  Badge,
  Button,
  ButtonUtility,
  Callout,
  DataTable,
  FilterBar,
  FormGrid,
  FormSpan,
  GoogleLogo,
  Input,
  KeyValue,
  MetricCard,
  NativeSelect,
  PageState,
  StatStrip,
  StatusBadge,
  TextArea,
} from '@/components/ui'
import { ACCOUNT_STATUS, ACCOUNT_STATUS_LIST, ALL, CAR_STATUS, ROLE, ROLE_LABEL } from '@/config/constants'
import { useAuth, useData } from '@/context/contexts'
import { matchesQuery, matchesValue } from '@/utils/filters'
import { formatDateTime, initials } from '@/utils/format'
import { temporaryPassword } from '@/utils/password'
import { isEmail, usernameProblem } from '@/utils/validation'

const COLUMNS = [
  { id: 'account', label: 'Account', isRowHeader: true },
  { id: 'role', label: 'Role' },
  { id: 'department', label: 'Department' },
  { id: 'signIn', label: 'Sign-in', hideBelow: 'lg' },
  { id: 'lastLogin', label: 'Last sign-in', hideBelow: 'xl' },
  { id: 'status', label: 'Status' },
  { id: 'actions', label: '', align: 'right' },
]

const ROLE_HINT = {
  [ROLE.DEPARTMENT]: 'One shared sign-in for the whole department. Its people are added to the personnel list afterwards.',
  [ROLE.QMS]: 'An individual account for one QMS Admin.',
  [ROLE.DEV]: 'A Lancerspec account for testing and support. Not for operational approvals.',
}

const EMPTY_IDENTITY = { fullName: '', username: '', email: '' }

/** The name, username and mailbox a new department account is offered. */
function suggestionFor(dept) {
  if (!dept) return EMPTY_IDENTITY
  const slug = dept.name.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return { fullName: `${dept.name} Department`, username: slug, email: `${slug}@company.com` }
}

/** Handover credentials, shown once after an account is created or its password is reset. */
function Credentials({ account, password }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Username: ${account.username}\nTemporary password: ${password}`)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <KeyValue
        items={[
          { k: 'Username', v: account.username, mono: true },
          { k: 'Temporary password', v: password, mono: true },
        ]}
      />
      <Button color="secondary" size="sm" iconLeading={copied ? Check : Copy01} className="self-start" onClick={copy}>
        {copied ? 'Copied' : 'Copy credentials'}
      </Button>
    </div>
  )
}

/** Create an account. Mounted fresh each time so every form starts empty with a new password. */
function CreateAccountDialog({ onClose }) {
  const { user, createAccount } = useAuth()
  const { users, departments, departmentAccount } = useData()

  const qmsDepartment = departments.find((dept) => dept.code === 'QMS')
  /* One shared account per department (#2); the QMS Department has individual admins instead. */
  const openDepartments = departments.filter((dept) => dept.id !== qmsDepartment?.id && !departmentAccount(dept.id))
  const roleOptions = [ROLE.DEPARTMENT, ROLE.QMS, ...(user.role === ROLE.DEV ? [ROLE.DEV] : [])]

  const [form, setForm] = useState(() => ({
    role: ROLE.DEPARTMENT,
    departmentId: '',
    position: '',
    ...EMPTY_IDENTITY,
    password: temporaryPassword(),
  }))
  const [errors, setErrors] = useState({})
  const [created, setCreated] = useState(null)

  const isDepartmentRole = form.role === ROLE.DEPARTMENT

  const set = (key) => (value) =>
    setForm((current) => ({ ...current, [key]: value?.target ? value.target.value : value }))

  const changeRole = (event) => {
    setForm((current) => ({ ...current, role: event.target.value, departmentId: '', position: '', ...EMPTY_IDENTITY }))
    setErrors({})
  }

  const chooseDepartment = (event) => {
    const departmentId = event.target.value
    setForm((current) => {
      const previous = suggestionFor(departments.find((dept) => dept.id === current.departmentId))
      const next = suggestionFor(departments.find((dept) => dept.id === departmentId))
      /* Refresh the suggestions, but never overwrite something typed by hand. */
      const keep = (key) => (current[key] && current[key] !== previous[key] ? current[key] : next[key])
      return { ...current, departmentId, fullName: keep('fullName'), username: keep('username'), email: keep('email') }
    })
  }

  const submit = () => {
    const next = {}
    if (isDepartmentRole && !form.departmentId) next.departmentId = 'Choose the department this account is for.'
    if (!form.fullName.trim()) next.fullName = isDepartmentRole ? 'Enter the account name.' : 'Enter the person’s full name.'
    const usernameError = usernameProblem(form.username, users)
    if (usernameError) next.username = usernameError
    if (!isEmail(form.email)) next.email = 'Enter a valid email address.'
    setErrors(next)
    if (Object.keys(next).length) return

    const departmentId = isDepartmentRole ? form.departmentId : form.role === ROLE.QMS ? qmsDepartment?.id : null
    setCreated(createAccount({ ...form, departmentId }))
  }

  if (created) {
    return (
      <AppDialog
        isOpen
        onClose={onClose}
        size="md"
        icon={CheckCircle}
        iconColor="success"
        title="Account created"
        subtitle={`${created.fullName} — ${ROLE_LABEL[created.role]}`}
        footer={
          <Button color="primary" size="md" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Credentials account={created} password={created.password} />
          <Callout tone="gray" icon={InfoCircle}>
            Hand these over directly. The account can sign in straight away and change its password from My Account —
            no change is forced.
          </Callout>
        </div>
      </AppDialog>
    )
  }

  return (
    <AppDialog
      isOpen
      onClose={onClose}
      size="lg"
      icon={UserPlus01}
      title="Create account"
      subtitle="The account gets a temporary password for you to hand over."
      footer={
        <>
          <Button color="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            size="md"
            iconLeading={UserPlus01}
            isDisabled={isDepartmentRole && openDepartments.length === 0}
            onClick={submit}
          >
            Create account
          </Button>
        </>
      }
    >
      <FormGrid>
        <FormSpan>
          <NativeSelect
            label="Role"
            value={form.role}
            onChange={changeRole}
            hint={ROLE_HINT[form.role]}
            options={roleOptions.map((role) => ({ value: role, label: ROLE_LABEL[role] }))}
          />
        </FormSpan>

        {isDepartmentRole && (
          <FormSpan>
            <NativeSelect
              label="Department"
              value={form.departmentId}
              onChange={chooseDepartment}
              disabled={openDepartments.length === 0}
              hint={
                errors.departmentId ||
                (openDepartments.length === 0
                  ? 'Every department already has a shared account. Close the old account first to replace it.'
                  : 'Only departments without an account are listed.')
              }
              options={[
                { value: '', label: openDepartments.length ? 'Select department…' : 'No department without an account' },
                ...openDepartments.map((dept) => ({ value: dept.id, label: dept.name })),
              ]}
            />
          </FormSpan>
        )}

        <FormSpan>
          <Input
            label={isDepartmentRole ? 'Account name' : 'Full name'}
            isRequired
            isInvalid={Boolean(errors.fullName)}
            hint={errors.fullName}
            value={form.fullName}
            onChange={set('fullName')}
            placeholder={isDepartmentRole ? 'e.g. Logistics Department' : 'e.g. Liza Ramos'}
          />
        </FormSpan>

        {!isDepartmentRole && (
          <FormSpan>
            <Input label="Position" value={form.position} onChange={set('position')} placeholder="e.g. QMS Document Controller" />
          </FormSpan>
        )}

        <Input
          label="Username"
          isRequired
          isInvalid={Boolean(errors.username)}
          hint={errors.username}
          value={form.username}
          onChange={set('username')}
          inputClassName="font-mono"
        />
        <Input
          label="Email"
          type="email"
          isRequired
          isInvalid={Boolean(errors.email)}
          hint={errors.email || (isDepartmentRole ? 'The department’s shared mailbox.' : undefined)}
          value={form.email}
          onChange={set('email')}
        />

        <FormSpan>
          <div className="flex items-start gap-2">
            <Input
              className="flex-1"
              label="Temporary password"
              value={form.password}
              isReadOnly
              inputClassName="font-mono"
              hint="Meets the password policy. You can copy it after the account is created."
            />
            <ButtonUtility
              size="md"
              color="secondary"
              tooltip="Generate another"
              icon={RefreshCw01}
              className="mt-6"
              onClick={() => setForm((current) => ({ ...current, password: temporaryPassword() }))}
            />
          </div>
        </FormSpan>
      </FormGrid>
    </AppDialog>
  )
}

export default function UserManagement() {
  const { user: currentUser, toggleAccount, archiveAccount, resetPassword } = useAuth()
  const { users, roles, departments, cars, deptName } = useData()

  const [query, setQuery] = useState('')
  const [role, setRole] = useState(ALL)
  const [department, setDepartment] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [creating, setCreating] = useState(false)
  const [confirmUser, setConfirmUser] = useState(null)
  const [permissionsOf, setPermissionsOf] = useState(null)
  const [reset, setReset] = useState(null)
  const [archiving, setArchiving] = useState(null)
  const [archiveReason, setArchiveReason] = useState('')

  const filtered = useMemo(
    () =>
      users.filter(
        (account) =>
          matchesQuery(account, query, ['fullName', 'username', 'email', 'position']) &&
          matchesValue(account.role, role) &&
          matchesValue(account.departmentId, department) &&
          matchesValue(account.status, status),
      ),
    [users, query, role, department, status],
  )

  const live = users.filter((account) => account.status !== ACCOUNT_STATUS.ARCHIVED)
  const canSignIn = live.filter((account) => account.status === ACCOUNT_STATUS.ACTIVE).length
  const hasFilters = query || role !== ALL || department !== ALL || status !== ALL

  const resetFilters = () => {
    setQuery('')
    setRole(ALL)
    setDepartment(ALL)
    setStatus(ALL)
  }

  /* Your own account is managed from My Account; closed accounts are final; and
     only Dev may change a Dev account. */
  const isLocked = (account) =>
    account.id === currentUser.id ||
    account.status === ACCOUNT_STATUS.ARCHIVED ||
    (account.role === ROLE.DEV && currentUser.role !== ROLE.DEV)

  const openCarsFor = (account) =>
    cars.filter((car) => car.recipient.userId === account.id && car.status !== CAR_STATUS.CLOSED).length

  const permissionRole = permissionsOf ? roles.find((item) => item.key === permissionsOf.role) : null

  const renderCell = (account, columnId) => {
    switch (columnId) {
      case 'account':
        return (
          <div className="flex items-center gap-2">
            <AvatarLabelGroup
              size="md"
              src={account.avatarUrl}
              initials={initials(account.fullName)}
              title={account.fullName}
              subtitle={`${account.username} · ${account.email}`}
            />
            {account.id === currentUser.id && (
              <Badge size="sm" color="brand">
                You
              </Badge>
            )}
          </div>
        )
      case 'role':
        return (
          <Badge size="sm" color="gray" type="modern">
            {ROLE_LABEL[account.role]}
          </Badge>
        )
      case 'department':
        return account.departmentId ? (
          <span className="block min-w-0">{deptName(account.departmentId)}</span>
        ) : (
          <span className="text-quaternary">—</span>
        )
      case 'signIn':
        return account.googleEmail ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={account.googleEmail}>
            <GoogleLogo colorful className="size-4" />
            Password or Google
          </span>
        ) : (
          <span className="whitespace-nowrap">Password</span>
        )
      case 'lastLogin':
        return (
          <span className="whitespace-nowrap">{account.lastLogin ? formatDateTime(account.lastLogin) : 'Never'}</span>
        )
      case 'status':
        return <StatusBadge status={account.status} />
      case 'actions':
        return (
          <div className="flex items-center justify-end gap-1">
            <ButtonUtility
              size="xs"
              color="tertiary"
              tooltip="View permissions"
              icon={Shield01}
              onClick={() => setPermissionsOf(account)}
            />
            {!isLocked(account) && (
              <>
                <ButtonUtility
                  size="xs"
                  color="tertiary"
                  tooltip="Reset password"
                  icon={Key01}
                  onClick={() => setReset({ account, password: null })}
                />
                <ButtonUtility
                  size="xs"
                  color="tertiary"
                  tooltip={account.status === ACCOUNT_STATUS.ACTIVE ? 'Deactivate account' : 'Activate account'}
                  icon={account.status === ACCOUNT_STATUS.ACTIVE ? UserX01 : UserCheck01}
                  onClick={() => setConfirmUser(account)}
                />
                <ButtonUtility
                  size="xs"
                  color="tertiary"
                  tooltip="Close account"
                  icon={Archive}
                  onClick={() => {
                    setArchiving(account)
                    setArchiveReason('')
                  }}
                />
              </>
            )}
          </div>
        )
      default:
        return null
    }
  }

  const deactivating = confirmUser?.status === ACCOUNT_STATUS.ACTIVE
  const archivingOpenCars = archiving ? openCarsFor(archiving) : 0

  return (
    <Page>
      <PageHeader
        title="User Management"
        subtitle="Individual QMS Admin accounts, one shared account per department, and Dev. Accounts are closed rather than deleted, so their records stay intact."
        actions={
          <Button color="primary" size="md" iconLeading={UserPlus01} onClick={() => setCreating(true)}>
            Create account
          </Button>
        }
      />

      <StatStrip>
        <MetricCard label="Accounts" value={live.length} hint={`${canSignIn} can sign in`} icon={Users01} />
        <MetricCard
          label="Department accounts"
          value={live.filter((account) => account.role === ROLE.DEPARTMENT).length}
          hint="One shared sign-in each"
          icon={UserCheck01}
          color="success"
        />
        <MetricCard
          label="QMS Admins"
          value={live.filter((account) => account.role === ROLE.QMS).length}
          hint="Individual accounts"
          icon={Shield01}
        />
        <MetricCard
          label="Closed"
          value={users.length - live.length}
          hint="Archived; records retained"
          icon={Archive}
          color="gray"
        />
      </StatStrip>

      <div className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
        <FilterBar
          search={{
            value: query,
            onChange: setQuery,
            placeholder: 'Search name, username or email',
          }}
          filters={[
            {
              label: 'roles',
              value: role,
              onChange: setRole,
              options: [
                { value: ALL, label: 'All roles' },
                ...roles.map((item) => ({ value: item.key, label: item.name })),
              ],
            },
            {
              label: 'departments',
              value: department,
              onChange: setDepartment,
              options: [
                { value: ALL, label: 'All departments' },
                ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
              ],
            },
            {
              label: 'statuses',
              value: status,
              onChange: setStatus,
              options: [
                { value: ALL, label: 'All statuses' },
                ...ACCOUNT_STATUS_LIST.map((value) => ({ value, label: value })),
              ],
            },
          ]}
          active={Boolean(hasFilters)}
          onReset={resetFilters}
        />

        {filtered.length === 0 ? (
          <PageState icon={Users01} title="No accounts found" text="No account matches the current filters." />
        ) : (
          <DataTable ariaLabel="Accounts" columns={COLUMNS} rows={filtered} renderCell={renderCell} size="md" />
        )}
      </div>

      {creating && <CreateAccountDialog onClose={() => setCreating(false)} />}

      {/* -------------------------------------------- activation confirmation */}
      <AppDialog
        isOpen={Boolean(confirmUser)}
        onClose={() => setConfirmUser(null)}
        size="sm"
        icon={deactivating ? UserX01 : UserCheck01}
        iconColor={deactivating ? 'error' : 'success'}
        title={deactivating ? 'Deactivate account' : 'Activate account'}
        subtitle={confirmUser ? `${confirmUser.fullName} (${confirmUser.username})` : ''}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setConfirmUser(null)}>
              Cancel
            </Button>
            <Button
              color={deactivating ? 'primary-destructive' : 'primary'}
              size="md"
              iconLeading={deactivating ? UserX01 : UserCheck01}
              onClick={() => {
                toggleAccount(confirmUser)
                setConfirmUser(null)
              }}
            >
              {deactivating ? 'Deactivate' : 'Activate'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Callout tone={deactivating ? 'error' : 'success'} icon={deactivating ? AlertTriangle : Check}>
            {deactivating
              ? confirmUser?.role === ROLE.DEPARTMENT
                ? 'Nobody in the department can sign in until the account is activated again. Its CARs and records are retained.'
                : 'The account will no longer be able to sign in. Its records, CARs and log entries are retained.'
              : 'The account regains access with its existing role and permissions.'}
          </Callout>
          <p className="text-sm text-tertiary">This action is written to the activity log.</p>
        </div>
      </AppDialog>

      {/* ------------------------------------------------------ password reset */}
      <AppDialog
        isOpen={Boolean(reset)}
        onClose={() => setReset(null)}
        size="md"
        icon={Key01}
        title={reset?.password ? 'Temporary password issued' : 'Reset password'}
        subtitle={reset ? `${reset.account.fullName} (${reset.account.username})` : ''}
        footer={
          reset?.password ? (
            <Button color="primary" size="md" onClick={() => setReset(null)}>
              Done
            </Button>
          ) : (
            <>
              <Button color="secondary" size="md" onClick={() => setReset(null)}>
                Cancel
              </Button>
              <Button
                color="primary"
                size="md"
                iconLeading={Key01}
                onClick={() => setReset((current) => ({ ...current, password: resetPassword(current.account) }))}
              >
                Issue temporary password
              </Button>
            </>
          )
        }
      >
        {reset?.password ? (
          <div className="flex flex-col gap-4">
            <Credentials account={reset.account} password={reset.password} />
            <Callout tone="gray" icon={InfoCircle}>
              The old password no longer works. The account can change this one from My Account.
            </Callout>
          </div>
        ) : (
          <p className="text-sm text-tertiary">
            The current password stops working immediately and a temporary one is generated for you to hand over.
            {reset?.account.googleEmail && ' Google sign-in stays linked.'}
          </p>
        )}
      </AppDialog>

      {/* ------------------------------------------------------- close account */}
      <AppDialog
        isOpen={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        size="md"
        icon={Archive}
        iconColor="warning"
        title="Close account"
        subtitle={archiving ? `${archiving.fullName} (${archiving.username})` : ''}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setArchiving(null)}>
              Cancel
            </Button>
            <Button
              color="primary-destructive"
              size="md"
              iconLeading={Archive}
              onClick={() => {
                archiveAccount(archiving, archiveReason)
                setArchiving(null)
              }}
            >
              Close account
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Callout tone="warning" icon={AlertTriangle} title="The account is archived, not deleted">
            It can never sign in again and can’t be reopened from here. Every CAR, signature and log entry it holds
            stays on record.
            {archiving?.role === ROLE.DEPARTMENT &&
              ' The department can be given a new account afterwards.'}
          </Callout>
          {archivingOpenCars > 0 && (
            <Callout tone="error" icon={AlertTriangle}>
              {archivingOpenCars} open CAR{archivingOpenCars === 1 ? ' is' : 's are'} still routed to this account.
              They stay open and visible to QMS Admins.
            </Callout>
          )}
          <TextArea
            label="Reason"
            hint="Optional. Recorded in the activity log."
            rows={3}
            value={archiveReason}
            onChange={setArchiveReason}
            placeholder="e.g. Department merged into Warehouse."
          />
        </div>
      </AppDialog>

      {/* --------------------------------------------------- permission viewer */}
      <AppDialog
        isOpen={Boolean(permissionsOf)}
        onClose={() => setPermissionsOf(null)}
        size="lg"
        icon={Shield01}
        title="Role-based permissions"
        subtitle={permissionsOf ? `${permissionsOf.fullName} — ${ROLE_LABEL[permissionsOf.role]}` : ''}
        footer={
          <Button color="secondary" size="md" onClick={() => setPermissionsOf(null)}>
            Close
          </Button>
        }
      >
        {permissionsOf && (
          <>
            <p className="mb-4 text-sm text-tertiary">{permissionRole?.description}</p>
            <div className="flex flex-wrap gap-2">
              {permissionRole?.permissions.map((permission) => (
                <Badge key={permission} size="sm" color="gray" type="modern" className="font-mono">
                  {permission}
                </Badge>
              ))}
            </div>
          </>
        )}
      </AppDialog>
    </Page>
  )
}
