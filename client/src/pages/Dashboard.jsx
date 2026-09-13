/* ============================================================================
   Dashboard (PRD 18; Overview: CAR Monitoring & Management Reporting)
   ----------------------------------------------------------------------------
   QMS Admins and Dev see what the QMS Department keeps watch on: pending and
   overdue CARs, close-out dates, effectiveness checks, re-issued CARs, and the
   document requests waiting on a decision.
   A department account sees the same view of its own CARs and requests, with
   company-wide ACTIVE document counts — the proposed answer to follow-up F4.
   ========================================================================== */

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  Calendar,
  CheckDone01,
  ClipboardCheck,
  Clock,
  File02,
  FileCheck02,
  Folder,
  Inbox01,
  Plus,
} from '@untitledui/icons'
import { Link, useNavigate } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  ActivityFeed,
  Button,
  Card,
  CategoryBarChart,
  CellStack,
  DataTable,
  MetricCard,
  PageState,
  StatStrip,
  StatusBadge,
  Tab,
  TabList,
  Tabs,
  TrendAreaChart,
} from '@/components/ui'
import { DOCUMENT_RULES } from '@/config/appConfig'
import {
  CAR_FLAG,
  CAR_QMS_QUEUE_STATUSES,
  CAR_STATUS,
  CAR_STATUS_LIST,
  DOC_STATUS,
  PERMISSION,
  REQUEST_OPEN_STATUSES,
  REQUEST_QMS_QUEUE_STATUSES,
  REQUEST_STATUS,
} from '@/config/constants'
import { ROUTES, path } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { countBy } from '@/utils/filters'
import { TODAY, daysBetween, formatDate, formatDateTime, initials, pluralize, relativeDays } from '@/utils/format'
import {
  closeOutStanding,
  effectivenessChecks,
  monthlyTrend,
  overdueCars,
  pendingCars,
  reissuedCars,
  upcomingCloseOuts,
} from '@/utils/monitoring'
import { isReviewLate } from '@/utils/requests'

/** Rows shown per monitoring tab before pointing to the register. */
const MONITOR_LIMIT = 8

/** A compact row used by the side rail lists. */
function RailRow({ to, lead, title, meta, trailing }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg px-2 py-2 transition duration-100 ease-linear hover:bg-primary_hover"
    >
      {lead}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-primary">{title}</span>
        <span className="block truncate text-xs text-tertiary">{meta}</span>
      </span>
      {trailing}
    </Link>
  )
}

/* -------------------------------------------------------- CAR monitoring */

const CAR_COLUMN = { id: 'car', label: 'CAR', isRowHeader: true }
const DEPARTMENT_COLUMN = { id: 'department', label: 'Department' }
const STATUS_COLUMN = { id: 'status', label: 'Status' }

/* The five things the Overview says QMS monitors, one tab each. */
const MONITOR_TABS = [
  {
    id: 'pending',
    label: 'Pending',
    columns: [CAR_COLUMN, DEPARTMENT_COLUMN, STATUS_COLUMN, { id: 'due', label: 'Reply due' }],
    empty: ['No CARs waiting on a reply', 'Every issued CAR has a root cause analysis and action plan on file.'],
  },
  {
    id: 'overdue',
    label: 'Overdue',
    columns: [CAR_COLUMN, DEPARTMENT_COLUMN, { id: 'stage', label: 'Late for' }, { id: 'late', label: 'Days late', align: 'right' }],
    empty: ['Nothing overdue', 'Every CAR is within the deadline of its current stage.'],
  },
  {
    id: 'closeout',
    label: 'Close-out dates',
    columns: [CAR_COLUMN, DEPARTMENT_COLUMN, STATUS_COLUMN, { id: 'closeout', label: 'Planned close-out' }],
    empty: ['No close-outs coming up', 'A CAR appears here once its action plan is accepted.'],
  },
  {
    id: 'effectiveness',
    label: 'Effectiveness checks',
    columns: [CAR_COLUMN, DEPARTMENT_COLUMN, { id: 'check', label: 'Check' }, { id: 'due', label: 'Due' }],
    empty: ['No effectiveness checks due', 'A CAR appears here once verification closes it out.'],
  },
  {
    id: 'reissued',
    label: 'Re-issued',
    columns: [CAR_COLUMN, DEPARTMENT_COLUMN, { id: 'original', label: 'Re-issue of' }, { id: 'reason', label: 'Reason' }],
    empty: ['No re-issued CARs', 'A finding raised again under a new number appears here.'],
  },
]

function MonitoringCard({ cars, allCars, className }) {
  const { deptName, userName, sourceById } = useData()

  const rows = useMemo(
    () => ({
      pending: pendingCars(cars).map((car) => ({ id: car.id, car, date: car.initiator.replyDueDate })),
      overdue: overdueCars(cars).map((car) => ({
        id: car.id,
        car,
        stage: car.deadline.label,
        date: car.deadline.date,
        days: Math.abs(daysBetween(TODAY, car.deadline.date)),
      })),
      closeout: upcomingCloseOuts(cars).map((row) => ({ id: row.car.id, ...row })),
      effectiveness: effectivenessChecks(cars).map((row) => ({ id: row.car.id, ...row })),
      reissued: reissuedCars(cars, allCars).map((row) => ({ id: row.car.id, ...row })),
    }),
    [cars, allCars],
  )

  const [tab, setTab] = useState(() => (rows.overdue.length ? 'overdue' : 'pending'))
  const active = MONITOR_TABS.find((item) => item.id === tab) || MONITOR_TABS[0]
  const list = rows[active.id]

  const renderCell = (row, columnId) => {
    const { car } = row
    switch (columnId) {
      case 'car':
        return <CellStack mono title={car.carNo} sub={sourceById(car.source)?.name} />
      case 'department':
        return (
          <CellStack
            title={deptName(car.recipient.departmentId)}
            sub={userName(car.recipient.personnelId || car.recipient.userId)}
          />
        )
      case 'status':
        return (
          <span className="flex flex-wrap items-center gap-1">
            <StatusBadge status={car.status} />
            {car.overdue && <StatusBadge status={CAR_FLAG.OVERDUE} />}
          </span>
        )
      case 'due':
        return (
          <CellStack
            title={formatDate(row.date)}
            sub={car.overdue ? `${relativeDays(row.date)} · overdue` : relativeDays(row.date)}
          />
        )
      case 'stage':
        return <CellStack title={row.stage} sub={formatDate(row.date)} />
      case 'late':
        return <span className="font-semibold text-error-primary tabular-nums">{row.days}</span>
      case 'closeout':
        return <CellStack title={formatDate(row.planned)} sub={closeOutStanding(row)} />
      case 'check':
        return <CellStack title={row.kind} sub={car.extendedMonitoring ? 'Extended monitoring' : 'After close-out'} />
      case 'original':
        return row.original ? (
          <CellStack mono title={row.original.carNo} sub={row.original.status} />
        ) : (
          <span className="text-quaternary">—</span>
        )
      case 'reason':
        return (
          <CellStack
            title={row.reason || '—'}
            sub={row.recurrence ? `Recurrence ${row.recurrence}` : null}
          />
        )
      default:
        return null
    }
  }

  const registerLink =
    active.id === 'overdue' ? `${ROUTES.cars}?flag=${encodeURIComponent(CAR_FLAG.OVERDUE)}` : ROUTES.cars

  return (
    <Card
      title="CAR monitoring"
      subtitle="Pending and overdue CARs, close-out dates, effectiveness checks and re-issued CARs"
      className={className}
      pad={false}
      actions={
        <Button color="link-color" size="sm" href={registerLink}>
          Open register
        </Button>
      }
      footer={
        list.length > MONITOR_LIMIT && (
          <p className="text-sm text-tertiary">
            Showing {MONITOR_LIMIT} of {list.length}.{' '}
            <Link to={registerLink} className="font-semibold text-brand-secondary hover:underline">
              See all in the register
            </Link>
          </p>
        )
      }
    >
      <div className="overflow-x-auto border-b border-secondary px-4 py-3 md:px-5">
        <Tabs selectedKey={tab} onSelectionChange={setTab}>
          <TabList type="button-border" size="sm">
            {MONITOR_TABS.map((item) => (
              <Tab key={item.id} id={item.id} label={item.label} badge={rows[item.id].length} />
            ))}
          </TabList>
        </Tabs>
      </div>

      {list.length === 0 ? (
        <PageState icon={CheckDone01} size="sm" title={active.empty[0]} text={active.empty[1]} />
      ) : (
        <DataTable
          ariaLabel={`CAR monitoring — ${active.label}`}
          columns={active.columns}
          rows={list.slice(0, MONITOR_LIMIT)}
          renderCell={renderCell}
          getHref={(row) => path.car(row.car.id)}
        />
      )}
    </Card>
  )
}

/* ------------------------------------------------------------- dashboard */

export default function Dashboard() {
  const { user, can, isDepartment } = useAuth()
  const {
    cars: allCars,
    documentsForUser,
    carsForUser,
    requestsForUser,
    activityLogs,
    personById,
    userName,
    deptName,
  } = useData()
  const navigate = useNavigate()

  const cars = carsForUser(user)
  const documents = documentsForUser(user)
  const requests = requestsForUser(user)
  const carFilter = (query) => navigate(`${ROUTES.cars}?${query}`)

  /* ------------------------------------------------------ CAR statistics */
  const carStats = useMemo(() => countBy(cars, 'status'), [cars])
  const pending = pendingCars(cars)
  const overdue = overdueCars(cars)
  const closed = carStats[CAR_STATUS.CLOSED] || 0
  const closureRate = cars.length ? Math.round((closed / cars.length) * 100) : 0
  const forRevision = carStats[CAR_STATUS.FOR_REVISION] || 0

  const trend = useMemo(() => monthlyTrend(cars).map((bucket) => ({ label: bucket.label, value: bucket.issued })), [cars])
  const distribution = useMemo(
    () => CAR_STATUS_LIST.map((status) => ({ label: status, value: carStats[status] || 0 })),
    [carStats],
  )

  /* What is sitting with the QMS Department rather than with a recipient. */
  const awaitingQms = isDepartment
    ? []
    : cars
        .filter((car) => CAR_QMS_QUEUE_STATUSES.includes(car.status))
        .sort((a, b) => String(a.deadline?.date || '9999').localeCompare(String(b.deadline?.date || '9999')))

  /* The next deadline of every CAR, whatever stage it is at. */
  const dueSoon = cars
    .filter((car) => car.deadline?.date && !car.overdue)
    .map((car) => ({ car, days: daysBetween(TODAY, car.deadline.date) }))
    .filter((entry) => entry.days >= 0 && entry.days <= 14)
    .sort((a, b) => a.days - b.days)

  /* ------------------------------------------------- document statistics */
  const byDocStatus = countBy(documents, 'status')
  /* A department answers for the documents it owns; QMS for all of them. */
  const ownDocuments = isDepartment ? documents.filter((doc) => doc.departmentId === user.departmentId) : documents
  const inReviewWindow = (doc, days) => doc.status === DOC_STATUS.ACTIVE && daysBetween(TODAY, doc.reviewDate) <= days
  const reviewDue = ownDocuments.filter((doc) => inReviewWindow(doc, DOCUMENT_RULES.reviewReminderDays))
  const reviewSoon = ownDocuments
    .filter((doc) => inReviewWindow(doc, 60))
    .sort((a, b) => String(a.reviewDate).localeCompare(String(b.reviewDate)))
    .slice(0, 5)

  /* --------------------------------------------------- document requests */
  const awaitingDecision = requests.filter((request) => REQUEST_QMS_QUEUE_STATUSES.includes(request.status))
  const lateReviews = awaitingDecision.filter(isReviewLate)
  const openRequests = requests.filter((request) => REQUEST_OPEN_STATUSES.includes(request.status))
  const returnedToYou = openRequests.filter(
    (request) => request.status === REQUEST_STATUS.RETURNED && request.originator.accountId === user.id,
  )

  /* Requests this QMS Admin can decide — never their own — nearest limit first. */
  const requestQueue = can(PERMISSION.DOC_REQUEST_REVIEW)
    ? awaitingDecision
        .filter((request) => request.originator.accountId !== user.id)
        .sort((a, b) => String(a.reviewDueDate).localeCompare(String(b.reviewDueDate)))
    : []

  /* ----------------------------------------------------- recent activity */
  /* A department sees its own account's actions and those on its CARs and requests. */
  const visibleCars = new Set(cars.map((car) => car.id))
  const visibleRequests = new Set(requests.map((request) => request.id))
  const feedEntries = isDepartment
    ? activityLogs.filter(
        (entry) =>
          entry.userId === user.id ||
          (entry.recordType === 'car' && visibleCars.has(entry.recordId)) ||
          (entry.recordType === 'request' && visibleRequests.has(entry.recordId)),
      )
    : activityLogs

  const feedItems = feedEntries.slice(0, 8).map((entry) => ({
    id: entry.id,
    actor: initials(userName(entry.personnelId || entry.userId)),
    actorName: userName(entry.personnelId || entry.userId),
    avatarUrl: personById(entry.personnelId || entry.userId)?.avatarUrl,
    title: (
      <>
        <span className="font-semibold text-primary">{userName(entry.personnelId || entry.userId)}</span>{' '}
        <span>{entry.action.toLowerCase()}</span>
        {entry.recordLabel && (
          <>
            {' — '}
            {entry.recordType === 'car' ? (
              <Link to={path.car(entry.recordId)} className="font-medium text-brand-secondary hover:underline">
                {entry.recordLabel}
              </Link>
            ) : entry.recordType === 'document' ? (
              <Link to={path.document(entry.recordId)} className="font-medium text-brand-secondary hover:underline">
                {entry.recordLabel}
              </Link>
            ) : entry.recordType === 'request' ? (
              <Link to={path.request(entry.recordId)} className="font-medium text-brand-secondary hover:underline">
                {entry.recordLabel}
              </Link>
            ) : (
              <span className="font-medium text-primary">{entry.recordLabel}</span>
            )}
          </>
        )}
      </>
    ),
    meta: entry.personnelId
      ? `${formatDateTime(entry.timestamp)} · via ${userName(entry.userId)}`
      : formatDateTime(entry.timestamp),
  }))

  return (
    <Page>
      <PageHeader
        title={`Good day, ${isDepartment ? deptName(user.departmentId) : user.fullName.split(' ')[0]}`}
        subtitle={
          isDepartment
            ? `Corrective Action Reports and document requests for ${deptName(user.departmentId)}, and the controlled documents in use.`
            : 'What the QMS Department monitors: pending and overdue CARs, close-out dates, effectiveness checks, re-issued CARs and document requests.'
        }
        actions={
          <>
            <Button color="secondary" size="md" iconLeading={Folder} onClick={() => navigate(ROUTES.documents)}>
              Browse repository
            </Button>
            {can(PERMISSION.CAR_ISSUE) && (
              <Button color="primary" size="md" iconLeading={Plus} onClick={() => navigate(ROUTES.carIssue)}>
                Issue CAR
              </Button>
            )}
          </>
        }
      />

      {/* ------------------------------------------------------- CAR tiles */}
      <StatStrip>
        <MetricCard
          label={isDepartment ? 'Awaiting your reply' : 'Pending CARs'}
          value={pending.length}
          hint={forRevision ? `${forRevision} returned for revision` : 'Root cause and action plan due'}
          icon={Clock}
          color="brand"
          onClick={() => carFilter(`status=${encodeURIComponent(CAR_STATUS.PENDING)}`)}
        />
        <MetricCard
          label="Overdue"
          value={overdue.length}
          hint="Late for their current stage"
          icon={AlertTriangle}
          color="error"
          onClick={() => carFilter(`flag=${encodeURIComponent(CAR_FLAG.OVERDUE)}`)}
        />
        {isDepartment ? (
          <MetricCard
            label="Being implemented"
            value={carStats[CAR_STATUS.ACTIVE] || 0}
            hint="Action plans accepted"
            icon={ClipboardCheck}
            color="brand"
            onClick={() => carFilter(`status=${encodeURIComponent(CAR_STATUS.ACTIVE)}`)}
          />
        ) : (
          <MetricCard
            label="Waiting on QMS"
            value={awaitingQms.length}
            hint="Reviews, verifications and effectiveness checks"
            icon={Inbox01}
            color="brand"
          />
        )}
        <MetricCard
          label="Closed"
          value={closed}
          hint={`${closureRate}% of ${pluralize(cars.length, 'CAR')}`}
          icon={CheckDone01}
          color="success"
          onClick={() => carFilter(`status=${encodeURIComponent(CAR_STATUS.CLOSED)}`)}
        />
      </StatStrip>

      {/* ---------------------------------------------- monitoring + queues */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <MonitoringCard cars={cars} allCars={allCars} className="xl:col-span-2" />

        <div className="flex flex-col gap-4">
          {awaitingQms.length > 0 && (
            <Card
              title="Waiting on the QMS Department"
              subtitle="Nearest deadline first"
              bodyClassName="px-2 md:px-3"
            >
              {awaitingQms.slice(0, 6).map((car) => (
                <RailRow
                  key={car.id}
                  to={path.car(car.id)}
                  title={car.carNo}
                  meta={`${deptName(car.recipient.departmentId)} · ${
                    car.deadline ? `${car.deadline.label.toLowerCase()} ${formatDate(car.deadline.date)}` : 'no deadline set'
                  }`}
                  trailing={<StatusBadge status={car.overdue ? CAR_FLAG.OVERDUE : car.status} />}
                />
              ))}
            </Card>
          )}

          <Card title="Coming deadlines" subtitle="Next 14 days, any stage" bodyClassName="px-2 md:px-3">
            {dueSoon.length === 0 ? (
              <PageState icon={Calendar} size="sm" title="Nothing due in the next 14 days" />
            ) : (
              dueSoon.slice(0, 6).map(({ car }) => (
                <RailRow
                  key={car.id}
                  to={path.car(car.id)}
                  title={car.carNo}
                  meta={`${deptName(car.recipient.departmentId)} · ${car.deadline.label}`}
                  trailing={
                    <span className="shrink-0 text-xs font-medium text-tertiary">{relativeDays(car.deadline.date)}</span>
                  }
                />
              ))
            )}
          </Card>
        </div>
      </div>

      {/* -------------------------------------------------- document tiles */}
      {isDepartment ? (
        <StatStrip columns={3}>
          <MetricCard
            label="Documents in use"
            value={byDocStatus[DOC_STATUS.ACTIVE] || 0}
            hint="Company-wide, current revisions"
            icon={File02}
            color="brand"
            onClick={() => navigate(ROUTES.documents)}
          />
          <MetricCard
            label="Your documents due for review"
            value={reviewDue.length}
            hint={`Within ${DOCUMENT_RULES.reviewReminderDays} days or past their review date`}
            icon={Calendar}
            color="warning"
          />
          <MetricCard
            label="Open document requests"
            value={openRequests.length}
            hint={returnedToYou.length ? `${returnedToYou.length} returned to you for revision` : 'Raised by or about your department'}
            icon={FileCheck02}
            color="brand"
            onClick={() => navigate(ROUTES.requests)}
          />
        </StatStrip>
      ) : (
        <StatStrip>
          <MetricCard
            label="Active documents"
            value={byDocStatus[DOC_STATUS.ACTIVE] || 0}
            hint="In use across the company"
            icon={File02}
            color="brand"
            onClick={() => navigate(ROUTES.documents)}
          />
          <MetricCard
            label="Obsolete"
            value={byDocStatus[DOC_STATUS.OBSOLETE] || 0}
            hint="Archived for their retention period"
            icon={Archive}
            color="gray"
            onClick={() => navigate(ROUTES.documents)}
          />
          <MetricCard
            label="Due for review"
            value={reviewDue.length}
            hint={`Within ${DOCUMENT_RULES.reviewReminderDays} days or past their review date`}
            icon={Calendar}
            color="warning"
          />
          <MetricCard
            label="Requests awaiting review"
            value={awaitingDecision.length}
            hint={lateReviews.length ? `${lateReviews.length} past the review limit` : 'All within the review limit'}
            icon={FileCheck02}
            color={lateReviews.length ? 'error' : 'brand'}
            onClick={() => navigate(ROUTES.requests)}
          />
        </StatStrip>
      )}

      {/* --------------------------------------------- activity + document rail */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          title="Recent activity"
          subtitle={isDepartment ? 'Your account, and the CARs and requests of your department' : 'Document and CAR actions across the system'}
          className="xl:col-span-2"
          actions={
            can(PERMISSION.ACTIVITY_LOG_VIEW) && (
              <Button color="link-color" size="sm" href={ROUTES.activityLogs}>
                View all
              </Button>
            )
          }
        >
          {feedItems.length === 0 ? (
            <PageState icon={Clock} size="sm" title="No activity yet" text="Actions appear here as people use the system." />
          ) : (
            <ActivityFeed items={feedItems} />
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {requestQueue.length > 0 && (
            <Card title="Document requests to decide" subtitle="Nearest review limit first" bodyClassName="px-2 md:px-3">
              {requestQueue.map((request) => (
                <RailRow
                  key={request.id}
                  to={path.request(request.id)}
                  title={request.controlNo}
                  meta={`${request.type} · ${request.documentCode} ${request.title}`}
                  trailing={
                    isReviewLate(request) ? (
                      <StatusBadge status="Overdue" label="Late" />
                    ) : (
                      <span className="shrink-0 text-xs font-medium text-tertiary">
                        {relativeDays(request.reviewDueDate)}
                      </span>
                    )
                  }
                />
              ))}
            </Card>
          )}

          {isDepartment && openRequests.length > 0 && (
            <Card title="Your document requests" subtitle="Still open" bodyClassName="px-2 md:px-3">
              {openRequests.map((request) => (
                <RailRow
                  key={request.id}
                  to={path.request(request.id)}
                  title={request.controlNo}
                  meta={`${request.type} · ${request.documentCode} ${request.title}`}
                  trailing={<StatusBadge status={request.status} />}
                />
              ))}
            </Card>
          )}

          <Card
            title={isDepartment ? 'Your documents due for review' : 'Documents due for review'}
            subtitle="Within the next 60 days"
            bodyClassName="px-2 md:px-3"
          >
            {reviewSoon.length === 0 ? (
              <PageState
                icon={CheckDone01}
                size="sm"
                title="Nothing due"
                text="No document reaches its review date in the next 60 days."
              />
            ) : (
              reviewSoon.map((doc) => (
                <RailRow
                  key={doc.id}
                  to={path.document(doc.id)}
                  title={doc.code}
                  meta={doc.title}
                  trailing={
                    <span className="shrink-0 text-xs font-medium text-tertiary">{relativeDays(doc.reviewDate)}</span>
                  }
                />
              ))
            )}
          </Card>
        </div>
      </div>

      {/* ------------------------------------------------------------- charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          title="CARs issued"
          subtitle="Volume raised per month over the last twelve months"
          className="xl:col-span-2"
        >
          <TrendAreaChart data={trend} />
        </Card>

        <Card title="Where CARs stand" subtitle="Register by current status">
          <CategoryBarChart data={distribution} />
        </Card>
      </div>
    </Page>
  )
}
