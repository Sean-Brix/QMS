/* ============================================================================
   CAR Register (PRD 14 — CAR Search and Filtering, 13 — CAR Monitoring)
   ----------------------------------------------------------------------------
   Shows where each CAR is and whether it is late there: the next deadline of
   its current stage, its close-out and effectiveness dates, and the flags that
   sit alongside the status — overdue, re-issued, extended monitoring.
   ========================================================================== */

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckDone01, Clipboard, ClipboardCheck, Clock, Plus } from '@untitledui/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  DataTable,
  FilterBar,
  MetricCard,
  PageState,
  PaginationCardMinimal,
  StatStrip,
  StatusBadge,
  StatusTag,
} from '@/components/ui'
import {
  ALL,
  CAR_FILTER_OPEN,
  CAR_FLAG,
  CAR_FLAG_LIST,
  CAR_OPEN_STATUSES,
  CAR_STATUS,
  CAR_STATUS_LIST,
  NC_TYPES,
  PAGE_SIZE,
  PERMISSION,
} from '@/config/constants'
import { ROUTES, path } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { countBy, matchesDateRange, matchesQuery, matchesValue, paginate, sortBy, withAll } from '@/utils/filters'
import { TODAY, daysBetween, formatDate } from '@/utils/format'

const COLUMNS = [
  { id: 'carNo', label: 'CAR No.', allowsSorting: true, isRowHeader: true },
  { id: 'finding', label: 'Finding', className: 'min-w-56' },
  { id: 'source', label: 'Source' },
  { id: 'ncType', label: 'Class' },
  { id: 'department', label: 'Concerned dept.', allowsSorting: true },
  { id: 'responsible', label: 'Responsible' },
  { id: 'dateIssued', label: 'Issued', allowsSorting: true },
  { id: 'deadline', label: 'Next deadline', allowsSorting: true },
  { id: 'closeOut', label: 'Close-out', allowsSorting: true },
  { id: 'status', label: 'Status', allowsSorting: true },
]

/** How each register flag is read off a CAR. */
const HAS_FLAG = {
  [CAR_FLAG.OVERDUE]: (car) => car.overdue,
  [CAR_FLAG.REISSUED]: (car) => Boolean(car.reissuedAs),
  [CAR_FLAG.REISSUE]: (car) => Boolean(car.reissuedFrom),
  [CAR_FLAG.MONITORING]: (car) => Boolean(car.extendedMonitoring),
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

export default function CarRegister() {
  const { user, can, isDepartment } = useAuth()
  const { carsForUser, departments, users, personnel, carSources, userName, deptName } = useData()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const cars = carsForUser(user)

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(params.get('status') || ALL)
  const [flag, setFlag] = useState(CAR_FLAG_LIST.includes(params.get('flag')) ? params.get('flag') : ALL)
  const [department, setDepartment] = useState(ALL)
  const [responsible, setResponsible] = useState(ALL)
  const [issuedBy, setIssuedBy] = useState(ALL)
  const [source, setSource] = useState(ALL)
  const [ncType, setNcType] = useState(ALL)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState({ key: 'carNo', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)

  const stats = useMemo(() => countBy(cars, 'status'), [cars])
  const openCount = cars.filter((car) => CAR_OPEN_STATUSES.includes(car.status)).length
  const overdueCount = cars.filter((car) => car.overdue).length

  const filtered = useMemo(() => {
    const rows = cars.filter(
      (car) =>
        matchesQuery(car, query, [
          'carNo',
          (record) => record.finding.deviation,
          (record) => record.problem.description,
          (record) => userName(record.recipient.personnelId || record.recipient.userId),
          (record) => userName(record.initiator.personnelId || record.initiator.userId),
        ]) &&
        (status === CAR_FILTER_OPEN ? CAR_OPEN_STATUSES.includes(car.status) : matchesValue(car.status, status)) &&
        (flag === ALL || HAS_FLAG[flag](car)) &&
        matchesValue(car.recipient.departmentId, department) &&
        matchesValue(car.recipient.personnelId, responsible) &&
        matchesValue(car.initiator.userId, issuedBy) &&
        matchesValue(car.source, source) &&
        matchesValue(car.finding.ncType, ncType) &&
        matchesDateRange(car.initiator.dateIssued, dateFrom, dateTo),
    )

    const accessor = {
      carNo: (car) => car.carNo,
      dateIssued: (car) => car.initiator.dateIssued,
      deadline: (car) => car.deadline?.date,
      closeOut: (car) => car.closeOutDate,
      status: (car) => CAR_STATUS_LIST.indexOf(car.status),
      department: (car) => deptName(car.recipient.departmentId),
    }[sort.key]

    return sortBy(rows, accessor, sort.dir)
  }, [cars, query, status, flag, department, responsible, issuedBy, source, ncType, dateFrom, dateTo, sort, userName, deptName])

  const view = paginate(filtered, page, pageSize)

  const hasFilters =
    query ||
    status !== ALL ||
    flag !== ALL ||
    department !== ALL ||
    responsible !== ALL ||
    issuedBy !== ALL ||
    source !== ALL ||
    ncType !== ALL ||
    dateFrom ||
    dateTo

  const resetFilters = () => {
    setQuery('')
    setStatus(ALL)
    setFlag(ALL)
    setDepartment(ALL)
    setResponsible(ALL)
    setIssuedBy(ALL)
    setSource(ALL)
    setNcType(ALL)
    setDateFrom('')
    setDateTo('')
    setPage(1)
    setParams({})
  }

  const onFilter = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const renderCell = (car, columnId) => {
    switch (columnId) {
      case 'carNo':
        return <span className="font-mono font-semibold whitespace-nowrap text-primary">{car.carNo}</span>
      case 'finding':
        return (
          <div className="max-w-xs">
            <p className="line-clamp-2 font-medium text-primary">{car.finding.deviation}</p>
            <p className="line-clamp-1 text-sm text-tertiary">{car.finding.isoClause}</p>
          </div>
        )
      case 'source':
        return (
          <Badge size="sm" color="gray" type="modern" className="font-mono">
            {car.source}
          </Badge>
        )
      case 'ncType':
        return <StatusTag status={car.finding.ncType} />
      case 'department':
        return <span className="block min-w-0">{deptName(car.recipient.departmentId)}</span>
      case 'responsible':
        return <span className="whitespace-nowrap">{userName(car.recipient.personnelId || car.recipient.userId)}</span>
      case 'dateIssued':
        return <span className="whitespace-nowrap">{formatDate(car.initiator.dateIssued)}</span>
      case 'deadline': {
        if (!car.deadline?.date) {
          return (
            <span className="text-sm whitespace-nowrap text-quaternary">
              {car.status === CAR_STATUS.UNDER_REVIEW ? 'With QMS' : '—'}
            </span>
          )
        }
        const days = daysBetween(TODAY, car.deadline.date)
        return (
          <div className="whitespace-nowrap">
            <p>{formatDate(car.deadline.date)}</p>
            <p className={car.overdue ? 'text-sm font-medium text-error-primary' : 'text-sm text-tertiary'}>
              {car.deadline.label.replace(' due', '')} ·{' '}
              {car.overdue ? `${plural(Math.abs(days), 'day')} late` : days === 0 ? 'today' : `${plural(days, 'day')} left`}
            </p>
          </div>
        )
      }
      case 'closeOut':
        if (!car.closeOutDate) return <span className="text-quaternary">—</span>
        return (
          <div className="whitespace-nowrap">
            <p>{formatDate(car.closeOutDate)}</p>
            <p className="text-sm text-tertiary">
              {car.status === CAR_STATUS.CLOSED
                ? `Closed ${formatDate(car.dateClosed)}`
                : `Effectiveness due ${formatDate(car.effectivenessDueDate)}`}
            </p>
          </div>
        )
      case 'status':
        return (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status={car.status} />
            {CAR_FLAG_LIST.filter((name) => HAS_FLAG[name](car)).map((name) => (
              <StatusTag key={name} status={name} label={name === CAR_FLAG.REISSUE ? 'Re-issue' : name} />
            ))}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <Page>
      <PageHeader
        title="CAR Register"
        subtitle={
          isDepartment
            ? 'Corrective Action Reports your department issued or that are routed to it.'
            : 'All Corrective Action Reports issued across the organization, from issuance through verification, effectiveness and closure.'
        }
        actions={
          can(PERMISSION.CAR_ISSUE) && (
            <Button color="primary" size="md" iconLeading={Plus} onClick={() => navigate(ROUTES.carIssue)}>
              Issue CAR
            </Button>
          )
        }
      />

      {/* ---------------------------------------------- monitoring (PRD 13) */}
      <StatStrip>
        <MetricCard
          label="Total CARs"
          value={cars.length}
          hint="Every CAR you can see"
          icon={ClipboardCheck}
          color="brand"
          onClick={resetFilters}
        />
        <MetricCard
          label="Open"
          value={openCount}
          hint="Not yet closed"
          icon={Clock}
          color="warning"
          onClick={() => onFilter(setStatus)(CAR_FILTER_OPEN)}
        />
        <MetricCard
          label="Overdue"
          value={overdueCount}
          hint="Late for their current stage"
          icon={AlertTriangle}
          color="error"
          onClick={() => onFilter(setFlag)(CAR_FLAG.OVERDUE)}
        />
        <MetricCard
          label="Closed"
          value={stats[CAR_STATUS.CLOSED] || 0}
          hint="Effective, monitored or re-issued"
          icon={CheckDone01}
          color="success"
          onClick={() => onFilter(setStatus)(CAR_STATUS.CLOSED)}
        />
      </StatStrip>

      <div className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
        <FilterBar
          search={{
            value: query,
            onChange: onFilter(setQuery),
            placeholder: 'Search CAR number, finding or person',
          }}
          filters={[
            {
              label: 'statuses',
              value: status,
              onChange: onFilter(setStatus),
              options: [
                { value: ALL, label: 'All statuses' },
                { value: CAR_FILTER_OPEN, label: CAR_FILTER_OPEN },
                ...CAR_STATUS_LIST.map((value) => ({ value, label: value })),
              ],
            },
            {
              label: 'flags',
              value: flag,
              onChange: onFilter(setFlag),
              options: [{ value: ALL, label: 'Any flag' }, ...CAR_FLAG_LIST.map((value) => ({ value, label: value }))],
            },
            {
              label: 'departments',
              value: department,
              onChange: onFilter(setDepartment),
              options: [
                { value: ALL, label: 'All departments' },
                ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
              ],
            },
            {
              label: 'responsible',
              value: responsible,
              onChange: onFilter(setResponsible),
              options: [
                { value: ALL, label: 'Any responsible person' },
                ...[...personnel]
                  .sort((a, b) => a.fullName.localeCompare(b.fullName))
                  .map((person) => ({ value: person.id, label: `${person.fullName} — ${deptName(person.departmentId)}` })),
              ],
            },
            {
              label: 'issuer',
              value: issuedBy,
              onChange: onFilter(setIssuedBy),
              options: [
                { value: ALL, label: 'Issued by anyone' },
                ...users.map((person) => ({ value: person.id, label: person.fullName })),
              ],
            },
            {
              label: 'sources',
              value: source,
              onChange: onFilter(setSource),
              options: [
                { value: ALL, label: 'All sources' },
                ...carSources.map((item) => ({ value: item.code, label: `${item.code} — ${item.name}` })),
              ],
            },
            {
              label: 'classifications',
              value: ncType,
              onChange: onFilter(setNcType),
              options: withAll(NC_TYPES).map((value) => ({
                value,
                label: value === ALL ? 'All classifications' : value,
              })),
            },
          ]}
          dates={[
            { label: 'Issued from', value: dateFrom, onChange: onFilter(setDateFrom) },
            { label: 'Issued to', value: dateTo, onChange: onFilter(setDateTo) },
          ]}
          active={Boolean(hasFilters)}
          onReset={resetFilters}
        />

        {hasFilters && (
          <p className="border-b border-secondary bg-secondary px-4 py-2 text-xs text-tertiary md:px-5">
            {view.total} of {cars.length} CARs match the current filters
          </p>
        )}

        {view.total === 0 ? (
          <PageState
            icon={Clipboard}
            title="No Corrective Action Reports found"
            text="No CAR matches the current search and filter combination."
            action={
              hasFilters ? (
                <Button size="sm" color="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <DataTable
              ariaLabel="Corrective Action Reports"
              columns={COLUMNS}
              rows={view.rows}
              renderCell={renderCell}
              getHref={(car) => path.car(car.id)}
              sort={sort}
              onSortChange={(next) => {
                setSort(next)
                setPage(1)
              }}
            />

            <PaginationCardMinimal
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
