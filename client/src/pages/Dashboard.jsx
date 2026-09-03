/* ============================================================================
   Dashboard (PRD 18 — QMS Dashboard)
   Document statistics · CAR statistics · Recent activities
   ========================================================================== */

import { useMemo } from 'react'
import {
  AlertTriangle,
  CheckDone01,
  ClipboardCheck,
  Clock,
  File02,
  Folder,
  Plus,
} from '@untitledui/icons'
import { Link, useNavigate } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  ActivityFeed,
  Button,
  Card,
  CategoryBarChart,
  MetricCard,
  PageState,
  ProgressBarBase,
  StatStrip,
  StatusBadge,
  TrendAreaChart,
} from '@/components/ui'
import {
  CAR_OPEN_STATUSES,
  CAR_QMS_QUEUE_STATUSES,
  CAR_STATUS,
  CAR_STATUS_LIST,
  DOC_STATUS,
  PERMISSION,
} from '@/config/constants'
import { ROUTES, path } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { countBy } from '@/utils/filters'
import { TODAY, daysBetween, formatDate, formatDateTime, initials, relativeDays } from '@/utils/format'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** CARs issued per month across the twelve months ending today. */
function buildTrend(cars) {
  const buckets = []
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(TODAY.getFullYear(), TODAY.getMonth() - offset, 1)
    buckets.push({ key: `${date.getFullYear()}-${date.getMonth()}`, label: MONTHS[date.getMonth()], value: 0 })
  }

  const index = Object.fromEntries(buckets.map((bucket, position) => [bucket.key, position]))

  for (const car of cars) {
    const issued = car.initiator?.dateIssued ? new Date(car.initiator.dateIssued) : null
    if (!issued || Number.isNaN(issued.getTime())) continue
    const position = index[`${issued.getFullYear()}-${issued.getMonth()}`]
    if (position !== undefined) buckets[position].value += 1
  }

  return buckets
}

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

export default function Dashboard() {
  const { user, can, isQms } = useAuth()
  const { documents, carsForUser, activityLogs, userById, userName, deptName } = useData()
  const navigate = useNavigate()

  const cars = carsForUser(user)

  /* ------------------------------------------------- document statistics */
  const docStats = useMemo(() => {
    const byStatus = countBy(documents, 'status')
    return {
      total: documents.length,
      active: byStatus[DOC_STATUS.ACTIVE] || 0,
      forReview: byStatus[DOC_STATUS.FOR_REVIEW] || 0,
      obsolete: byStatus[DOC_STATUS.OBSOLETE] || 0,
      archived: byStatus[DOC_STATUS.ARCHIVED] || 0,
      deleted: byStatus[DOC_STATUS.DELETED] || 0,
    }
  }, [documents])

  /* ------------------------------------------------------ CAR statistics */
  const carStats = useMemo(() => countBy(cars, 'status'), [cars])
  const openCars = cars.filter((car) => CAR_OPEN_STATUSES.includes(car.status))
  const closed = carStats[CAR_STATUS.CLOSED] || 0
  const closureRate = cars.length ? Math.round((closed / cars.length) * 100) : 0

  const trend = useMemo(() => buildTrend(cars), [cars])
  const distribution = useMemo(
    () => CAR_STATUS_LIST.map((status) => ({ label: status, value: carStats[status] || 0 })),
    [carStats],
  )

  /* ---------------------------------------------------- attention queues */
  const overdue = cars.filter((car) => car.status === CAR_STATUS.OVERDUE)

  /* What is sitting with the QMS Department rather than with a recipient.
     Without this the only way to find work that has arrived is to filter the
     register by hand. */
  const awaitingQms = isQms
    ? cars
        .filter((car) => CAR_QMS_QUEUE_STATUSES.includes(car.status))
        .sort((a, b) => String(a.carNo).localeCompare(String(b.carNo)))
    : []

  const dueSoon = cars
    .filter((car) => !car.recipient.dateSubmitted && car.status !== CAR_STATUS.CLOSED)
    .map((car) => ({ car, days: daysBetween(TODAY, car.initiator.replyDueDate) }))
    .filter((entry) => entry.days >= 0 && entry.days <= 14)
    .sort((a, b) => a.days - b.days)

  const reviewDue = documents
    .filter((doc) => doc.status !== DOC_STATUS.ARCHIVED && daysBetween(TODAY, doc.reviewDate) <= 60)
    .sort((a, b) => new Date(a.reviewDate) - new Date(b.reviewDate))
    .slice(0, 5)

  /* ----------------------------------------------------- recent activity */
  const feedItems = activityLogs.slice(0, 8).map((entry) => ({
    id: entry.id,
    actor: initials(userName(entry.userId)),
    actorName: userName(entry.userId),
    avatarUrl: userById(entry.userId)?.avatarUrl,
    title: (
      <>
        <span className="font-semibold text-primary">{userName(entry.userId)}</span>{' '}
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
            ) : (
              <span className="font-medium text-primary">{entry.recordLabel}</span>
            )}
          </>
        )}
      </>
    ),
    meta: formatDateTime(entry.timestamp),
  }))

  return (
    <Page>
      <PageHeader
        title={`Good day, ${user.fullName.split(' ')[0]}`}
        subtitle={
          isQms
            ? 'System-wide view of the controlled document repository and the corrective action register.'
            : `Documents and Corrective Action Reports relevant to ${deptName(user.departmentId)}.`
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

      {/* ------------------------------------------------------- headline KPIs */}
      <StatStrip>
        <MetricCard
          label="Total CARs"
          value={cars.length}
          hint={`${openCars.length} still open`}
          icon={ClipboardCheck}
          color="brand"
          onClick={() => navigate(ROUTES.cars)}
        />
        <MetricCard
          label="Overdue"
          value={overdue.length}
          hint="Reply due date passed"
          icon={AlertTriangle}
          color="error"
          onClick={() => navigate(`${ROUTES.cars}?status=${encodeURIComponent(CAR_STATUS.OVERDUE)}`)}
        />
        <MetricCard
          label="Closed"
          value={closed}
          hint={`${closureRate}% of all CARs issued`}
          icon={CheckDone01}
          color="success"
          onClick={() => navigate(`${ROUTES.cars}?status=${encodeURIComponent(CAR_STATUS.CLOSED)}`)}
        />
        <MetricCard
          label="Controlled documents"
          value={docStats.total}
          hint={`${docStats.forReview} due for review`}
          icon={File02}
          color="brand"
          onClick={() => navigate(ROUTES.documents)}
        />
      </StatStrip>

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

      {/* --------------------------------------------- activity + attention rail */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          title="Recent activity"
          subtitle="Document and CAR actions across the system"
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
          <Card title="CAR closure rate" subtitle="Closed against total issued">
            <div className="mb-3 flex items-end justify-between gap-3">
              <span className="text-display-sm font-semibold text-primary">{closureRate}%</span>
              <span className="text-sm text-tertiary">
                {closed} of {cars.length}
              </span>
            </div>
            <ProgressBarBase value={closureRate} />
          </Card>

          {awaitingQms.length > 0 && (
            <Card
              title="Waiting on the QMS Department"
              subtitle="Responses to review and countermeasures to verify"
              bodyClassName="px-2 md:px-3"
            >
              {awaitingQms.map((car) => (
                <RailRow
                  key={car.id}
                  to={path.car(car.id)}
                  title={car.carNo}
                  meta={`${deptName(car.recipient.departmentId)} · ${userName(car.recipient.userId)}`}
                  trailing={<StatusBadge status={car.status} />}
                />
              ))}
            </Card>
          )}

          {overdue.length > 0 && (
            <Card title="Overdue CARs" subtitle="Due date passed without completion" bodyClassName="px-2 md:px-3">
              {overdue.map((car) => (
                <RailRow
                  key={car.id}
                  to={path.car(car.id)}
                  title={car.carNo}
                  meta={`${deptName(car.recipient.departmentId)} · due ${formatDate(car.initiator.replyDueDate)}`}
                  trailing={<StatusBadge status={CAR_STATUS.OVERDUE} />}
                />
              ))}
            </Card>
          )}

          {dueSoon.length > 0 && (
            <Card title="Reply due soon" subtitle="Next 14 days" bodyClassName="px-2 md:px-3">
              {dueSoon.map(({ car }) => (
                <RailRow
                  key={car.id}
                  to={path.car(car.id)}
                  title={car.carNo}
                  meta={deptName(car.recipient.departmentId)}
                  trailing={
                    <span className="shrink-0 text-xs font-medium text-tertiary">
                      {relativeDays(car.initiator.replyDueDate)}
                    </span>
                  }
                />
              ))}
            </Card>
          )}

          <Card title="Documents due for review" subtitle="Within the next 60 days" bodyClassName="px-2 md:px-3">
            {reviewDue.length === 0 ? (
              <PageState
                icon={CheckDone01}
                size="sm"
                title="Nothing due"
                text="No document reaches its review date in the next 60 days."
              />
            ) : (
              reviewDue.map((doc) => (
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
    </Page>
  )
}
