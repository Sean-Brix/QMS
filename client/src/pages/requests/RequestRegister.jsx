/* ============================================================================
   Document Requests — the register of Document Review / Change Notices.
   ----------------------------------------------------------------------------
   Every change to a controlled document — a new document, a revision or an
   obsoletion — is requested here and decided by a QMS Admin (Document Control
   & CAR Overview; Confirmed requirements #14–#16, #25). QMS Admins and Dev see
   every request; a department sees the requests it raised and the ones about
   its own documents.
   ========================================================================== */

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckDone01, Clock, FileCheck02, FilePlus02, ReverseLeft } from '@untitledui/icons'
import { useNavigate } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  CellStack,
  DataTable,
  FLUID_COLUMN,
  FilterBar,
  MetricCard,
  PageState,
  PaginationCardMinimal,
  StatStrip,
  StatusBadge,
  Tab,
  TabList,
  Tabs,
} from '@/components/ui'
import {
  ALL,
  PAGE_SIZE,
  PERMISSION,
  PROCESS_TYPE,
  PROCESS_TYPE_LIST,
  REQUEST_OPEN_STATUSES,
  REQUEST_QMS_QUEUE_STATUSES,
  REQUEST_STATUS,
  REQUEST_STATUS_LIST,
  REQUEST_TYPE_LIST,
} from '@/config/constants'
import { ROUTES, path } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { matchesQuery, matchesValue, paginate, sortBy } from '@/utils/filters'
import { TODAY, daysBetween, formatDate } from '@/utils/format'
import { isReviewLate } from '@/utils/requests'

/** The tab listing every request not yet decided. */
const OPEN = 'Open'

const COLUMNS = [
  { id: 'controlNo', label: 'DRCN No.', allowsSorting: true, isRowHeader: true },
  { id: 'document', label: 'Document', className: FLUID_COLUMN },
  { id: 'type', label: 'Type' },
  { id: 'level', label: 'Level', allowsSorting: true, hideBelow: 'lg' },
  { id: 'originator', label: 'Originator', hideBelow: 'xl' },
  { id: 'submittedAt', label: 'Submitted', allowsSorting: true, hideBelow: 'lg' },
  { id: 'reviewDueDate', label: 'Decision due', allowsSorting: true },
  { id: 'status', label: 'Status', allowsSorting: true },
]

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

/** The review countdown while a request waits on QMS; nothing once it has left the queue. */
function ReviewDue({ request }) {
  if (!REQUEST_QMS_QUEUE_STATUSES.includes(request.status)) return <span className="text-quaternary">—</span>
  const days = daysBetween(TODAY, request.reviewDueDate)
  const late = isReviewLate(request)
  return (
    <div className="whitespace-nowrap">
      <p>{formatDate(request.reviewDueDate)}</p>
      <p className={late ? 'text-sm font-medium text-error-primary' : 'text-sm text-tertiary'}>
        {late ? `${plural(Math.abs(days), 'day')} late` : days === 0 ? 'Due today' : `${plural(days, 'day')} left`}
      </p>
    </div>
  )
}

export default function RequestRegister() {
  const navigate = useNavigate()
  const { user, can, isDepartment } = useAuth()
  const { requestsForUser, departments, deptName, userName } = useData()
  const requests = requestsForUser(user)

  const [tab, setTab] = useState(OPEN)
  const [query, setQuery] = useState('')
  const [type, setType] = useState(ALL)
  const [processType, setProcessType] = useState(ALL)
  const [department, setDepartment] = useState(ALL)
  const [sort, setSort] = useState({ key: 'reviewDueDate', dir: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)

  const counts = Object.fromEntries(
    REQUEST_STATUS_LIST.map((status) => [status, requests.filter((request) => request.status === status).length]),
  )
  const openCount = requests.filter((request) => REQUEST_OPEN_STATUSES.includes(request.status)).length
  const queueCount = requests.filter((request) => REQUEST_QMS_QUEUE_STATUSES.includes(request.status)).length
  const lateCount = requests.filter(isReviewLate).length

  const filtered = useMemo(() => {
    const rows = requests.filter(
      (request) =>
        (tab === ALL || (tab === OPEN ? REQUEST_OPEN_STATUSES.includes(request.status) : request.status === tab)) &&
        matchesQuery(request, query, [
          'controlNo',
          'documentCode',
          'title',
          'reason',
          (record) => userName(record.originator.personnelId || record.originator.accountId),
        ]) &&
        matchesValue(request.type, type) &&
        matchesValue(request.processType, processType) &&
        matchesValue(request.departmentId, department),
    )

    const accessor = {
      controlNo: (request) => request.controlNo,
      level: (request) => request.level,
      submittedAt: (request) => request.submittedAt,
      /* A decided request has no deadline left, so it sorts after the live ones. */
      reviewDueDate: (request) =>
        REQUEST_QMS_QUEUE_STATUSES.includes(request.status) ? request.reviewDueDate : null,
      status: (request) => request.status,
    }[sort.key]

    return sortBy(rows, accessor, sort.dir)
  }, [requests, tab, query, type, processType, department, sort, userName])

  const view = paginate(filtered, page, pageSize)
  const hasFilters = query || type !== ALL || processType !== ALL || department !== ALL

  const onFilter = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const resetFilters = () => {
    setQuery('')
    setType(ALL)
    setProcessType(ALL)
    setDepartment(ALL)
    setPage(1)
  }

  const renderCell = (request, columnId) => {
    switch (columnId) {
      case 'controlNo':
        return <span className="font-mono font-semibold whitespace-nowrap text-primary">{request.controlNo}</span>
      case 'document':
        return <CellStack title={request.title} sub={`${request.documentCode} · ${deptName(request.departmentId)}`} />
      case 'type':
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge size="sm" color="gray" type="modern">
              {request.type}
            </Badge>
            {request.processType === PROCESS_TYPE.URGENT && (
              <Badge size="sm" color="error">
                Urgent
              </Badge>
            )}
          </div>
        )
      case 'level':
        return <span className="whitespace-nowrap">Level {request.level}</span>
      case 'originator':
        return (
          <CellStack
            title={userName(request.originator.personnelId || request.originator.accountId)}
            sub={request.originator.personnelId ? userName(request.originator.accountId) : request.originator.position}
          />
        )
      case 'submittedAt':
        return <span className="whitespace-nowrap">{formatDate(request.submittedAt)}</span>
      case 'reviewDueDate':
        return <ReviewDue request={request} />
      case 'status':
        return <StatusBadge status={request.status} />
      default:
        return null
    }
  }

  return (
    <Page>
      <PageHeader
        title="Document Requests"
        subtitle={
          isDepartment
            ? 'Requests your department raised and requests about its documents. A QMS Admin decides each one within the limit set on the Document Review / Change Notice.'
            : 'Every Document Review / Change Notice — new documents, revisions and obsoletions — from submission to decision.'
        }
        actions={
          can(PERMISSION.DOC_REQUEST_SUBMIT) && (
            <Button color="primary" size="md" iconLeading={FilePlus02} onClick={() => navigate(ROUTES.requestNew)}>
              New request
            </Button>
          )
        }
      >
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) => {
            setTab(key)
            setPage(1)
          }}
        >
          <TabList type="button-border" size="sm" className="overflow-x-auto">
            <Tab id={OPEN} label="Open" badge={openCount} />
            {REQUEST_STATUS_LIST.map((status) => (
              <Tab key={status} id={status} label={status} badge={counts[status]} />
            ))}
            <Tab id={ALL} label="All" badge={requests.length} />
          </TabList>
        </Tabs>
      </PageHeader>

      <StatStrip>
        <MetricCard
          label="Awaiting a decision"
          value={queueCount}
          hint="Submitted or under review"
          icon={Clock}
          onClick={() => setTab(OPEN)}
        />
        <MetricCard
          label="Past review limit"
          value={lateCount}
          hint="Decision overdue"
          icon={AlertTriangle}
          color={lateCount ? 'error' : 'gray'}
          onClick={() => {
            setTab(OPEN)
            setSort({ key: 'reviewDueDate', dir: 'asc' })
          }}
        />
        <MetricCard
          label="Returned for revision"
          value={counts[REQUEST_STATUS.RETURNED]}
          hint="With the originator"
          icon={ReverseLeft}
          color="warning"
          onClick={() => setTab(REQUEST_STATUS.RETURNED)}
        />
        <MetricCard
          label="Approved"
          value={counts[REQUEST_STATUS.APPROVED]}
          hint="Published to the repository"
          icon={CheckDone01}
          color="success"
          onClick={() => setTab(REQUEST_STATUS.APPROVED)}
        />
      </StatStrip>

      <div className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
        <FilterBar
          search={{
            value: query,
            onChange: onFilter(setQuery),
            placeholder: 'Search DRCN number, document, reason or originator',
          }}
          filters={[
            {
              label: 'types',
              value: type,
              onChange: onFilter(setType),
              options: [{ value: ALL, label: 'All types' }, ...REQUEST_TYPE_LIST.map((value) => ({ value, label: value }))],
            },
            {
              label: 'process types',
              value: processType,
              onChange: onFilter(setProcessType),
              options: [
                { value: ALL, label: 'Regular and urgent' },
                ...PROCESS_TYPE_LIST.map((value) => ({ value, label: value })),
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
          ]}
          active={Boolean(hasFilters)}
          onReset={resetFilters}
        />

        {view.total === 0 ? (
          <PageState
            icon={FileCheck02}
            title="No document requests found"
            text={
              hasFilters
                ? 'No request matches the current search and filters.'
                : tab === OPEN
                  ? 'Nothing is waiting. New documents, revisions and obsoletions all start with a request.'
                  : 'No request is in this state.'
            }
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
              ariaLabel="Document requests"
              columns={COLUMNS}
              rows={view.rows}
              renderCell={renderCell}
              getHref={(request) => path.request(request.id)}
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
