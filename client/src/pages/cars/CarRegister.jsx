/* ============================================================================
   CAR Register (PRD 14 — CAR Search and Filtering, 13 — CAR Monitoring)
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
  { id: 'dueDate', label: 'Due', allowsSorting: true },
  { id: 'status', label: 'Status', allowsSorting: true },
]

export default function CarRegister() {
  const { user, can, isQms } = useAuth()
  const { carsForUser, departments, users, carSources, userName, deptName } = useData()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const cars = carsForUser(user)

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(params.get('status') || ALL)
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

  const filtered = useMemo(() => {
    const rows = cars.filter(
      (car) =>
        matchesQuery(car, query, [
          'carNo',
          (record) => record.finding.deviation,
          (record) => record.problem.description,
          (record) => userName(record.recipient.userId),
          (record) => userName(record.initiator.userId),
        ]) &&
        (status === CAR_FILTER_OPEN
          ? CAR_OPEN_STATUSES.includes(car.status)
          : matchesValue(car.status, status)) &&
        matchesValue(car.recipient.departmentId, department) &&
        matchesValue(car.recipient.userId, responsible) &&
        matchesValue(car.initiator.userId, issuedBy) &&
        matchesValue(car.source, source) &&
        matchesValue(car.finding.ncType, ncType) &&
        matchesDateRange(car.initiator.dateIssued, dateFrom, dateTo),
    )

    const accessor = {
      carNo: (car) => car.carNo,
      dateIssued: (car) => car.initiator.dateIssued,
      dueDate: (car) => car.initiator.replyDueDate,
      status: (car) => car.status,
      department: (car) => deptName(car.recipient.departmentId),
    }[sort.key]

    return sortBy(rows, accessor, sort.dir)
  }, [cars, query, status, department, responsible, issuedBy, source, ncType, dateFrom, dateTo, sort, userName, deptName])

  const view = paginate(filtered, page, pageSize)

  const hasFilters =
    query ||
    status !== ALL ||
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
        return <span className="whitespace-nowrap">{userName(car.recipient.userId)}</span>
      case 'dateIssued':
        return <span className="whitespace-nowrap">{formatDate(car.initiator.dateIssued)}</span>
      case 'dueDate': {
        const days = daysBetween(TODAY, car.initiator.replyDueDate)
        const late = car.status === CAR_STATUS.OVERDUE
        const pending = !car.recipient.dateSubmitted && car.status !== CAR_STATUS.CLOSED
        return (
          <div className="whitespace-nowrap">
            <p>{formatDate(car.initiator.replyDueDate)}</p>
            {pending && (
              <p className={late ? 'text-sm font-medium text-error-primary' : 'text-sm text-tertiary'}>
                {late ? `${Math.abs(days)} days late` : `${days} days left`}
              </p>
            )}
          </div>
        )
      }
      case 'status':
        return <StatusBadge status={car.status} />
      default:
        return null
    }
  }

  return (
    <Page>
      <PageHeader
        title="CAR Register"
        subtitle={
          isQms
            ? 'All Corrective Action Reports issued across the organization, from issuance through verification and closure.'
            : 'Corrective Action Reports you issued or that are assigned to you or your department.'
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
          onClick={() => onFilter(setStatus)(ALL)}
        />
        <MetricCard
          label="Open"
          value={openCount}
          hint="Awaiting a response"
          icon={Clock}
          color="warning"
          onClick={() => onFilter(setStatus)(CAR_FILTER_OPEN)}
        />
        <MetricCard
          label="Overdue"
          value={stats[CAR_STATUS.OVERDUE] || 0}
          hint="Reply due date passed"
          icon={AlertTriangle}
          color="error"
          onClick={() => onFilter(setStatus)(CAR_STATUS.OVERDUE)}
        />
        <MetricCard
          label="Closed"
          value={stats[CAR_STATUS.CLOSED] || 0}
          hint="Verified and disposed"
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
                ...users.map((person) => ({ value: person.id, label: person.fullName })),
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
