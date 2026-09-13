/* ============================================================================
   Activity Logs (PRD 19) — user, role, action, related record, date and time.
   Accessible to authorized QMS / system administrators only.
   ========================================================================== */

import { useMemo, useState } from 'react'
import { Activity, Printer } from '@untitledui/icons'
import { Link } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  AvatarLabelGroup,
  Badge,
  Button,
  DataTable,
  FilterBar,
  PageState,
  PaginationCardMinimal,
} from '@/components/ui'
import { ALL, LOG_ALL_ACTIONS, LOG_MODULES, PAGE_SIZE, ROLE } from '@/config/constants'
import { path } from '@/config/navigation'
import { useData } from '@/context/contexts'
import { matchesDateRange, matchesQuery, matchesValue, paginate, withAll } from '@/utils/filters'
import { formatDate, formatTime, initials } from '@/utils/format'

const COLUMNS = [
  { id: 'user', label: 'User', isRowHeader: true },
  { id: 'identity', label: 'Department / Role' },
  { id: 'action', label: 'Action performed' },
  { id: 'module', label: 'Module' },
  { id: 'record', label: 'Related record' },
  { id: 'date', label: 'Date' },
  { id: 'time', label: 'Time' },
]

export default function ActivityLogs() {
  const { activityLogs, users, userById, personnelById, userName, deptName, identityFor } = useData()

  const [query, setQuery] = useState('')
  const [actor, setActor] = useState(ALL)
  const [action, setAction] = useState(ALL)
  const [module, setModule] = useState(ALL)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)

  const filtered = useMemo(
    () =>
      activityLogs.filter(
        (entry) =>
          matchesQuery(entry, query, [
            'details',
            'recordLabel',
            'action',
            (record) => userName(record.userId),
            (record) => (record.personnelId ? userName(record.personnelId) : null),
          ]) &&
          matchesValue(entry.userId, actor) &&
          matchesValue(entry.action, action) &&
          matchesValue(entry.module, module) &&
          matchesDateRange(entry.date, dateFrom, dateTo),
      ),
    [activityLogs, query, actor, action, module, dateFrom, dateTo, userName],
  )

  const view = paginate(filtered, page, pageSize)
  const hasFilters = query || actor !== ALL || action !== ALL || module !== ALL || dateFrom || dateTo

  const reset = () => {
    setQuery('')
    setActor(ALL)
    setAction(ALL)
    setModule(ALL)
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const onFilter = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const renderCell = (entry, columnId) => {
    switch (columnId) {
      case 'user': {
        /* A shared department account records who actually did the work. */
        const actorUser = userById(entry.userId)
        const performer = entry.personnelId ? personnelById(entry.personnelId) : null
        return (
          <AvatarLabelGroup
            size="sm"
            src={performer?.avatarUrl || actorUser?.avatarUrl}
            initials={initials((performer || actorUser)?.fullName || '—')}
            title={userName(entry.personnelId || entry.userId)}
            subtitle={performer ? `via ${actorUser?.fullName}` : actorUser?.position}
          />
        )
      }
      case 'identity': {
        const actorUser = userById(entry.userId)
        return (
          <span className="block min-w-0">
            {actorUser?.role === ROLE.DEPARTMENT ? deptName(actorUser.departmentId) : identityFor(actorUser)}
          </span>
        )
      }
      case 'action':
        return (
          <div className="max-w-sm">
            <p className="font-medium text-primary">{entry.action}</p>
            <p className="text-sm text-tertiary">{entry.details}</p>
          </div>
        )
      case 'module':
        return (
          <Badge size="sm" color="gray" type="modern">
            {entry.module}
          </Badge>
        )
      case 'record':
        if (!entry.recordLabel) return <span className="text-quaternary">—</span>
        if (entry.recordType === 'car')
          return (
            <Link to={path.car(entry.recordId)} className="font-medium text-brand-secondary hover:underline">
              {entry.recordLabel}
            </Link>
          )
        if (entry.recordType === 'document')
          return (
            <Link to={path.document(entry.recordId)} className="font-medium text-brand-secondary hover:underline">
              {entry.recordLabel}
            </Link>
          )
        if (entry.recordType === 'request')
          return (
            <Link to={path.request(entry.recordId)} className="font-medium text-brand-secondary hover:underline">
              {entry.recordLabel}
            </Link>
          )
        return <span>{entry.recordLabel}</span>
      case 'date':
        return <span className="whitespace-nowrap">{formatDate(entry.date)}</span>
      case 'time':
        return <span className="font-mono whitespace-nowrap">{formatTime(entry.timestamp)}</span>
      default:
        return null
    }
  }

  return (
    <Page>
      <PageHeader
        title="Activity Logs"
        subtitle="Record of important user actions across the document repository and the CAR register. Restricted to authorized QMS and system administrators."
        actions={
          <Button color="secondary" size="md" iconLeading={Printer} onClick={() => window.print()}>
            Print
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary print-flat">
        <FilterBar
          className="no-print"
          search={{
            value: query,
            onChange: onFilter(setQuery),
            placeholder: 'Search action, record or details',
          }}
          filters={[
            {
              label: 'users',
              value: actor,
              onChange: onFilter(setActor),
              options: [
                { value: ALL, label: 'All users' },
                ...users.map((person) => ({ value: person.id, label: person.fullName })),
              ],
            },
            {
              label: 'modules',
              value: module,
              onChange: onFilter(setModule),
              options: withAll(LOG_MODULES).map((value) => ({
                value,
                label: value === ALL ? 'All modules' : value,
              })),
            },
            {
              label: 'actions',
              value: action,
              onChange: onFilter(setAction),
              options: withAll(LOG_ALL_ACTIONS).map((value) => ({
                value,
                label: value === ALL ? 'All actions' : value,
              })),
            },
          ]}
          dates={[
            { label: 'Logged from', value: dateFrom, onChange: onFilter(setDateFrom) },
            { label: 'Logged to', value: dateTo, onChange: onFilter(setDateTo) },
          ]}
          active={Boolean(hasFilters)}
          onReset={reset}
        />

        {hasFilters && (
          <p className="border-b border-secondary bg-secondary px-4 py-2 text-xs text-tertiary md:px-5">
            {view.total} of {activityLogs.length} log entries match the current filters
          </p>
        )}

        {view.total === 0 ? (
          <PageState icon={Activity} title="No log entries found" text="No activity matches the current filters." />
        ) : (
          <>
            <DataTable ariaLabel="Activity log" columns={COLUMNS} rows={view.rows} renderCell={renderCell} />

            <PaginationCardMinimal
              className="no-print"
              page={view.page}
              total={view.pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </>
        )}
      </div>
    </Page>
  )
}
