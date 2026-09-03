/* ============================================================================
   User Management (PRD 7) — accounts, role-based permissions, activation.
   ========================================================================== */

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Lock01,
  Plus,
  Shield01,
  UserX01,
  Users01,
  X as XIcon,
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
  MetricCard,
  PageState,
  StatStrip,
  StatusBadge,
} from '@/components/ui'
import { ALL, ROLE_LABEL } from '@/config/constants'
import { useAuth, useData } from '@/context/contexts'
import { matchesQuery, matchesValue } from '@/utils/filters'
import { formatDateTime, initials } from '@/utils/format'

const COLUMNS = [
  { id: 'user', label: 'User', isRowHeader: true },
  { id: 'employeeNo', label: 'Employee no.' },
  { id: 'department', label: 'Department / Section' },
  { id: 'role', label: 'Role' },
  { id: 'lastLogin', label: 'Last login' },
  { id: 'status', label: 'Status' },
  { id: 'actions', label: '', align: 'right' },
]

export default function UserManagement() {
  const { user: currentUser, toggleAccount } = useAuth()
  const { users, roles, departments, deptName } = useData()

  const [query, setQuery] = useState('')
  const [role, setRole] = useState(ALL)
  const [department, setDepartment] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [confirmUser, setConfirmUser] = useState(null)
  const [permissionsOf, setPermissionsOf] = useState(null)

  const filtered = useMemo(
    () =>
      users.filter(
        (person) =>
          matchesQuery(person, query, ['fullName', 'username', 'email', 'position', 'employeeNo']) &&
          matchesValue(person.role, role) &&
          matchesValue(person.departmentId, department) &&
          matchesValue(person.status, status),
      ),
    [users, query, role, department, status],
  )

  const active = users.filter((person) => person.status === 'Active').length
  const hasFilters = query || role !== ALL || department !== ALL || status !== ALL

  const resetFilters = () => {
    setQuery('')
    setRole(ALL)
    setDepartment(ALL)
    setStatus(ALL)
  }

  const permissionRole = permissionsOf ? roles.find((item) => item.key === permissionsOf.role) : null

  const renderCell = (person, columnId) => {
    switch (columnId) {
      case 'user':
        return (
          <div className="flex items-center gap-2">
            <AvatarLabelGroup
              size="md"
              src={person.avatarUrl}
              initials={initials(person.fullName)}
              title={person.fullName}
              subtitle={`${person.position} · ${person.email}`}
            />
            {person.id === currentUser.id && (
              <Badge size="sm" color="brand">
                You
              </Badge>
            )}
          </div>
        )
      case 'employeeNo':
        return <span className="font-mono whitespace-nowrap">{person.employeeNo}</span>
      case 'department':
        return <span className="block min-w-0">{deptName(person.departmentId)}</span>
      case 'role':
        return (
          <Badge size="sm" color="gray" type="modern">
            {ROLE_LABEL[person.role]}
          </Badge>
        )
      case 'lastLogin':
        return <span className="whitespace-nowrap">{formatDateTime(person.lastLogin)}</span>
      case 'status':
        return <StatusBadge status={person.status} />
      case 'actions':
        return (
          <div className="flex items-center justify-end gap-1">
            <ButtonUtility
              size="xs"
              color="tertiary"
              tooltip="View permissions"
              icon={Shield01}
              onClick={() => setPermissionsOf(person)}
            />
            <ButtonUtility size="xs" color="tertiary" tooltip="Reset password" icon={Lock01} />
            <ButtonUtility
              size="xs"
              color="tertiary"
              tooltip={person.status === 'Active' ? 'Deactivate account' : 'Activate account'}
              icon={person.status === 'Active' ? XIcon : Check}
              isDisabled={person.id === currentUser.id}
              onClick={() => setConfirmUser(person)}
            />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <Page>
      <PageHeader
        title="User Management"
        subtitle="Accounts, role-based permissions and account activation. Password management and session rules are configured in System Settings."
        actions={
          <Button color="primary" size="md" iconLeading={Plus}>
            Add user
          </Button>
        }
      />

      <StatStrip>
        <MetricCard label="Total accounts" value={users.length} hint="All registered users" icon={Users01} />
        <MetricCard label="Active" value={active} hint="Able to sign in" icon={Check} color="success" />
        <MetricCard
          label="Deactivated"
          value={users.length - active}
          hint="Records retained"
          icon={UserX01}
          color="gray"
        />
        <MetricCard
          label="QMS Department"
          value={users.filter((person) => person.role === 'qms').length}
          hint="Full administrative access"
          icon={Shield01}
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
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' },
              ],
            },
          ]}
          active={Boolean(hasFilters)}
          onReset={resetFilters}
        />

        {filtered.length === 0 ? (
          <PageState icon={Users01} title="No users found" text="No account matches the current filters." />
        ) : (
          <DataTable ariaLabel="User accounts" columns={COLUMNS} rows={filtered} renderCell={renderCell} size="md" />
        )}
      </div>

      {/* -------------------------------------- activation confirmation */}
      <AppDialog
        isOpen={Boolean(confirmUser)}
        onClose={() => setConfirmUser(null)}
        size="sm"
        icon={confirmUser?.status === 'Active' ? UserX01 : Check}
        iconColor={confirmUser?.status === 'Active' ? 'error' : 'success'}
        title={confirmUser?.status === 'Active' ? 'Deactivate account' : 'Activate account'}
        subtitle={confirmUser ? `${confirmUser.fullName} (${confirmUser.username})` : ''}
        footer={
          <>
            <Button color="secondary" size="md" onClick={() => setConfirmUser(null)}>
              Cancel
            </Button>
            <Button
              color={confirmUser?.status === 'Active' ? 'primary-destructive' : 'primary'}
              size="md"
              iconLeading={confirmUser?.status === 'Active' ? XIcon : Check}
              onClick={() => {
                toggleAccount(confirmUser)
                setConfirmUser(null)
              }}
            >
              {confirmUser?.status === 'Active' ? 'Deactivate' : 'Activate'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Callout
            tone={confirmUser?.status === 'Active' ? 'error' : 'success'}
            icon={confirmUser?.status === 'Active' ? AlertTriangle : Check}
          >
            {confirmUser?.status === 'Active'
              ? 'The user will no longer be able to sign in. Their records, CARs and log entries are retained.'
              : 'The user will regain access with their existing role and permissions.'}
          </Callout>
          <p className="text-sm text-tertiary">This action is written to the activity log.</p>
        </div>
      </AppDialog>

      {/* --------------------------------------------- permission viewer */}
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
