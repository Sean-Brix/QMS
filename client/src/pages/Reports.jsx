/* ============================================================================
   Reports (PRD 21; Overview: Management Review; Confirmed Requirements #28)
   ----------------------------------------------------------------------------
   Management Review — CARs by source, department and status, overdue CARs,
     close-out dates, effectiveness results, re-issued CARs, document requests
     and the monthly trend, for Top Management.
   Activity summary / Detailed entries — the PRD's weekly and monthly activity
     log report: 21.1 documents, 21.2 CARs, 21.3 users.
   Output on screen, printed or saved as PDF through the print stylesheet, and
   as an Excel workbook generated in the browser.
   ========================================================================== */

import { useMemo, useState } from 'react'
import { Activity, ChevronLeft, ChevronRight, Download01, Printer, Users01 } from '@untitledui/icons'
import { Link } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  ButtonUtility,
  Card,
  CategoryBarChart,
  DataTable,
  MetricCard,
  NativeSelect,
  PageState,
  StatStrip,
  StatusBadge,
  Tab,
  TabList,
  Tabs,
  TrendAreaChart,
  cx,
} from '@/components/ui'
import { APP, REPORT_RULES } from '@/config/appConfig'
import {
  CAR_STATUS,
  CAR_STATUS_LIST,
  EFFECTIVENESS_RESULT,
  EFFECTIVENESS_RESULTS,
  PERMISSION,
  REPORT_SECTIONS,
  REQUEST_OPEN_STATUSES,
  REQUEST_TYPE_LIST,
} from '@/config/constants'
import { path } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { countBy } from '@/utils/filters'
import { TODAY, daysBetween, formatDate, formatDateTime, formatRange, isoDate, periodRange, relativeDays } from '@/utils/format'
import {
  breakdown,
  closeOutStanding,
  closeOutsIn,
  effectivenessChecks,
  effectivenessResults,
  inRange,
  monthlyTrend,
  overdueCars,
  reissuedCars,
  upcomingCloseOuts,
} from '@/utils/monitoring'
import { isReviewLate } from '@/utils/requests'
import { buildWorkbook, downloadBlob } from '@/utils/xlsx'

const DETAIL_COLUMNS = [
  { id: 'date', label: 'Date', isRowHeader: true },
  { id: 'time', label: 'Time' },
  { id: 'user', label: 'User' },
  { id: 'action', label: 'Action' },
  { id: 'record', label: 'Related record' },
  { id: 'details', label: 'Details' },
]

/* History steps on a document request, counted per type for the period. */
const REQUEST_STEPS = [
  { id: 'submitted', label: 'Submitted', actions: ['Submitted', 'Resubmitted'] },
  { id: 'approved', label: 'Approved', actions: ['Approved'] },
  { id: 'returned', label: 'Returned', actions: ['Returned for revision'] },
  { id: 'disapproved', label: 'Disapproved', actions: ['Disapproved'] },
]

const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] || 0), 0)

/**
 * A plain table for report sections: it prints and saves to PDF whole, which
 * the interactive register table does not. Columns: `[{ id, label, align, render }]`.
 */
function ReportTable({ columns, rows, total, empty }) {
  if (rows.length === 0) return <p className="px-4 py-6 text-sm text-tertiary md:px-5">{empty}</p>

  const cellClass = (column) =>
    cx('px-4 py-2.5 align-top md:px-5', column.align === 'right' && 'text-right tabular-nums', column.className)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-secondary bg-secondary">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cx(cellClass(column), 'text-xs font-semibold whitespace-nowrap text-tertiary')}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key ?? row.car?.id ?? index} className="border-b border-secondary last:border-b-0">
              {columns.map((column) => (
                <td key={column.id} className={cx(cellClass(column), 'text-secondary')}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr className="border-t border-secondary bg-secondary">
              {columns.map((column) => (
                <td key={column.id} className={cx(cellClass(column), 'font-semibold text-primary')}>
                  {total[column.id] ?? ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function CarLink({ car }) {
  return (
    <Link to={path.car(car.id)} className="font-mono font-medium whitespace-nowrap text-brand-secondary hover:underline">
      {car.carNo}
    </Link>
  )
}

/** Late and overdue wording reads in the error colour. */
function Standing({ text }) {
  const late = /late|overdue/i.test(text)
  return <span className={cx('whitespace-nowrap', late ? 'font-medium text-error-primary' : 'text-secondary')}>{text}</span>
}

export default function Reports() {
  const { user, can } = useAuth()
  const {
    activityLogs,
    cars,
    documents,
    documentRequests,
    carSources,
    departments,
    userName,
    deptName,
    sourceById,
    log,
  } = useData()
  const [period, setPeriod] = useState(REPORT_RULES.defaultPeriod)
  const [offset, setOffset] = useState(0)
  const [tab, setTab] = useState('review')

  const range = useMemo(() => periodRange(period, offset), [period, offset])
  const rangeLabel = formatRange(range.start, range.end)
  const responsible = (car) => userName(car.recipient.personnelId || car.recipient.userId)

  /* ------------------------------------------------------ activity report */
  const entries = useMemo(
    () => activityLogs.filter((entry) => inRange(entry.timestamp, range)),
    [activityLogs, range],
  )
  const byAction = useMemo(() => countBy(entries, 'action'), [entries])
  const byUser = useMemo(() => countBy(entries, 'userId'), [entries])
  const topUsers = useMemo(
    () =>
      Object.entries(byUser)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id, count]) => ({ label: userName(id), value: count })),
    [byUser, userName],
  )

  /* ----------------------------------------------- management review data */
  const review = useMemo(() => {
    const issued = cars.filter((car) => inRange(car.initiator.dateIssued, range))
    const closedInPeriod = cars.filter((car) => inRange(car.dateClosed, range))
    const statusCount = countBy(cars, 'status')
    const results = effectivenessResults(cars, range)
    const resultCount = countBy(results, 'result')

    const bySource = breakdown(
      cars,
      range,
      (car) => car.source,
      carSources.map((source) => ({ key: source.code, label: `${source.code} · ${source.name}`, group: source.group })),
    )
    const byDepartment = breakdown(
      cars,
      range,
      (car) => car.recipient.departmentId,
      departments.map((dept) => ({ key: dept.id, label: dept.name })),
    ).filter((row) => row.issued || row.closed || row.open || row.overdue)

    const requestRows = REQUEST_TYPE_LIST.map((type) => {
      const ofType = documentRequests.filter((request) => request.type === type)
      const row = { key: type, label: type }
      for (const step of REQUEST_STEPS) {
        row[step.id] = ofType.reduce(
          (count, request) =>
            count +
            (request.history || []).filter((item) => step.actions.includes(item.action) && inRange(item.at, range)).length,
          0,
        )
      }
      row.open = ofType.filter((request) => REQUEST_OPEN_STATUSES.includes(request.status)).length
      row.late = ofType.filter(isReviewLate).length
      return row
    })

    return {
      issued,
      closedInPeriod,
      open: cars.filter((car) => car.status !== CAR_STATUS.CLOSED),
      overdue: overdueCars(cars),
      bySource,
      byDepartment,
      statuses: CAR_STATUS_LIST.map((status) => ({ label: status, value: statusCount[status] || 0 })),
      closeOuts: [...closeOutsIn(cars, range), ...upcomingCloseOuts(cars)],
      checksDue: effectivenessChecks(cars),
      results,
      resultChart: EFFECTIVENESS_RESULTS.map((result) => ({ label: result, value: resultCount[result] || 0 })),
      reissues: reissuedCars(cars).filter((row) => inRange(row.car.initiator.dateIssued, range)),
      requestRows,
      trend: monthlyTrend(cars, range.end),
    }
  }, [cars, range, carSources, departments, documentRequests])

  /* --------------------------------------------------------------- output */
  const reportName = `${period} ${tab === 'review' ? 'Management Review' : 'activity log'} report, ${rangeLabel}`

  const printReport = () => {
    log(user, 'Exported Report', 'User', { type: 'report', label: reportName }, 'Printed or saved as PDF.')
    window.print()
  }

  const exportExcel = () => {
    const heading = (title) => ({
      title: `${APP.organization} — ${title}`,
      subtitle: [`${period} report, ${rangeLabel}`, `Generated ${formatDateTime(TODAY)} by ${user.fullName} · ${APP.fullName}`],
    })
    const breakdownColumns = (label) => [
      { label },
      { label: 'Issued in period' },
      { label: 'Closed in period' },
      { label: 'Open today' },
      { label: 'Overdue today' },
    ]
    const breakdownRows = (rows) => [
      ...rows.map((row) => [row.label, row.issued, row.closed, row.open, row.overdue]),
      ['Total', sum(rows, 'issued'), sum(rows, 'closed'), sum(rows, 'open'), sum(rows, 'overdue')],
    ]

    const sheets = [
      {
        name: 'Summary',
        ...heading('Management Review'),
        columns: [{ label: 'Measure' }, { label: 'Value' }],
        rows: [
          ['CARs issued in period', review.issued.length],
          ['CARs closed in period', review.closedInPeriod.length],
          ['CARs open today', review.open.length],
          ['CARs overdue today', review.overdue.length],
          ['Effectiveness results recorded in period', review.results.length],
          ['Effectiveness checks still due', review.checksDue.length],
          ['CARs re-issued in period', review.reissues.length],
          ['Document requests submitted in period', sum(review.requestRows, 'submitted')],
          ['Document requests past the review limit today', sum(review.requestRows, 'late')],
          ['Active documents', documents.filter((doc) => doc.status === 'ACTIVE').length],
          ['Logged actions in period', entries.length],
        ],
      },
      { name: 'By source', ...heading('CARs by source'), columns: breakdownColumns('Source'), rows: breakdownRows(review.bySource) },
      {
        name: 'By department',
        ...heading('CARs by department'),
        columns: breakdownColumns('Department'),
        rows: breakdownRows(review.byDepartment),
      },
      {
        name: 'By status',
        ...heading('CARs by current status'),
        columns: [{ label: 'Status' }, { label: 'CARs' }],
        rows: review.statuses.map((row) => [row.label, row.value]),
      },
      {
        name: 'Overdue',
        ...heading('Overdue CARs'),
        columns: [
          { label: 'CAR no.' },
          { label: 'Department' },
          { label: 'Responsible' },
          { label: 'Status' },
          { label: 'Late for' },
          { label: 'Due' },
          { label: 'Days late' },
        ],
        rows: review.overdue.map((car) => [
          car.carNo,
          deptName(car.recipient.departmentId),
          responsible(car),
          car.status,
          car.deadline.label,
          formatDate(car.deadline.date),
          Math.abs(daysBetween(TODAY, car.deadline.date)),
        ]),
      },
      {
        name: 'Close-out dates',
        ...heading('Close-out dates'),
        columns: [
          { label: 'CAR no.' },
          { label: 'Department' },
          { label: 'Status' },
          { label: 'Planned close-out' },
          { label: 'Actual close-out' },
          { label: 'Standing' },
        ],
        rows: review.closeOuts.map((row) => [
          row.car.carNo,
          deptName(row.car.recipient.departmentId),
          row.car.status,
          formatDate(row.planned),
          row.actual ? formatDate(row.actual) : '',
          closeOutStanding(row),
        ]),
      },
      {
        name: 'Effectiveness',
        ...heading('Effectiveness results recorded in period'),
        columns: [{ label: 'CAR no.' }, { label: 'Department' }, { label: 'Result' }, { label: 'Date' }, { label: 'Notes', width: 70, wrap: true }],
        rows: review.results.map((row) => [
          row.car.carNo,
          deptName(row.car.recipient.departmentId),
          row.result,
          formatDate(row.date),
          row.notes || '',
        ]),
      },
      {
        name: 'Checks due',
        ...heading('Effectiveness and monitoring checks due'),
        columns: [{ label: 'CAR no.' }, { label: 'Department' }, { label: 'Check' }, { label: 'Due' }, { label: 'Overdue' }],
        rows: review.checksDue.map((row) => [
          row.car.carNo,
          deptName(row.car.recipient.departmentId),
          row.kind,
          formatDate(row.date),
          row.car.overdue ? 'Yes' : 'No',
        ]),
      },
      {
        name: 'Re-issued',
        ...heading('Re-issued CARs'),
        columns: [
          { label: 'CAR no.' },
          { label: 'Re-issue of' },
          { label: 'Department' },
          { label: 'Reason' },
          { label: 'Recurrence' },
          { label: 'Issued' },
          { label: 'Status' },
        ],
        rows: review.reissues.map((row) => [
          row.car.carNo,
          row.original?.carNo || '',
          deptName(row.car.recipient.departmentId),
          row.reason || '',
          row.recurrence,
          formatDate(row.car.initiator.dateIssued),
          row.car.status,
        ]),
      },
      {
        name: 'Document requests',
        ...heading('Document requests'),
        columns: [
          { label: 'Type' },
          ...REQUEST_STEPS.map((step) => ({ label: `${step.label} in period` })),
          { label: 'Open today' },
          { label: 'Past review limit today' },
        ],
        rows: review.requestRows.map((row) => [
          row.label,
          ...REQUEST_STEPS.map((step) => row[step.id]),
          row.open,
          row.late,
        ]),
      },
      {
        name: 'Monthly trend',
        ...heading('CARs issued and closed per month'),
        columns: [{ label: 'Month' }, { label: 'Issued' }, { label: 'Closed' }],
        rows: review.trend.map((bucket) => [bucket.month, bucket.issued, bucket.closed]),
      },
      {
        name: 'Activity summary',
        ...heading('Activity log summary'),
        columns: [{ label: 'Section' }, { label: 'Action' }, { label: 'Count' }],
        rows: REPORT_SECTIONS.flatMap((section) =>
          section.actions.map((action) => [section.title.replace(/\s+/g, ' '), action, byAction[action] || 0]),
        ),
      },
      {
        name: 'Activity entries',
        ...heading('Activity log entries'),
        columns: [
          { label: 'Date' },
          { label: 'Time' },
          { label: 'Account' },
          { label: 'Performed by' },
          { label: 'Module' },
          { label: 'Action' },
          { label: 'Related record' },
          { label: 'Details', width: 70, wrap: true },
        ],
        rows: entries.map((entry) => [
          formatDate(entry.timestamp),
          entry.time,
          userName(entry.userId),
          entry.personnelId ? userName(entry.personnelId) : '',
          entry.module,
          entry.action,
          entry.recordLabel || '',
          entry.details || '',
        ]),
      },
    ]

    downloadBlob(buildWorkbook(sheets), `QMS-${period}-report-${isoDate(range.start)}.xlsx`)
    log(user, 'Exported Report', 'User', { type: 'report', label: reportName }, `Excel workbook, ${sheets.length} sheets.`)
  }

  /* ---------------------------------------------------------- table parts */
  const breakdownColumns = (label) => [
    { id: 'label', label, render: (row) => <span className="font-medium text-primary">{row.label}</span> },
    { id: 'issued', label: 'Issued', align: 'right', render: (row) => row.issued },
    { id: 'closed', label: 'Closed', align: 'right', render: (row) => row.closed },
    { id: 'open', label: 'Open today', align: 'right', render: (row) => row.open },
    {
      id: 'overdue',
      label: 'Overdue today',
      align: 'right',
      render: (row) => <span className={cx(row.overdue > 0 && 'font-semibold text-error-primary')}>{row.overdue}</span>,
    },
  ]
  const breakdownTotal = (rows) => ({
    label: 'Total',
    issued: sum(rows, 'issued'),
    closed: sum(rows, 'closed'),
    open: sum(rows, 'open'),
    overdue: sum(rows, 'overdue'),
  })
  const departmentCell = {
    id: 'department',
    label: 'Department',
    render: (row) => deptName((row.car || row).recipient.departmentId),
  }

  const renderDetailCell = (entry, columnId) => {
    switch (columnId) {
      case 'date':
        return <span className="whitespace-nowrap">{formatDate(entry.date)}</span>
      case 'time':
        return <span className="font-mono whitespace-nowrap">{entry.time}</span>
      case 'user':
        return <span className="whitespace-nowrap">{userName(entry.userId)}</span>
      case 'action':
        return <span className="font-medium whitespace-nowrap text-primary">{entry.action}</span>
      case 'record':
        return entry.recordLabel || <span className="text-quaternary">—</span>
      case 'details':
        return <span className="block max-w-sm">{entry.details}</span>
      default:
        return null
    }
  }

  const passed = review.results.filter((row) => row.result === EFFECTIVENESS_RESULT.PASS).length

  return (
    <Page>
      <PageHeader
        title="Reports"
        subtitle="Management Review reporting on the CAR register, and weekly or monthly activity log reports."
        actions={
          <>
            <NativeSelect
              aria-label="Reporting period"
              size="sm"
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value)
                setOffset(0)
              }}
              options={REPORT_RULES.periods.map((value) => ({ value, label: value }))}
            />
            <ButtonUtility
              size="sm"
              color="secondary"
              tooltip="Previous period"
              icon={ChevronLeft}
              onClick={() => setOffset((current) => current + 1)}
            />
            <ButtonUtility
              size="sm"
              color="secondary"
              tooltip="Next period"
              icon={ChevronRight}
              isDisabled={offset === 0}
              onClick={() => setOffset((current) => Math.max(0, current - 1))}
            />
            {can(PERMISSION.REPORT_PRINT) && (
              <>
                <Button color="secondary" size="md" iconLeading={Printer} onClick={printReport}>
                  Print or save PDF
                </Button>
                <Button color="primary" size="md" iconLeading={Download01} onClick={exportExcel}>
                  Export Excel
                </Button>
              </>
            )}
          </>
        }
      />

      {/* ------------------------------------------------------ report header */}
      <Card className="print-flat">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-medium text-tertiary">
              {period} {tab === 'review' ? 'Management Review report' : 'activity log report'}
            </p>
            <h2 className="text-display-xs font-semibold text-primary">{rangeLabel}</h2>
            <p className="mt-1 text-sm text-tertiary">
              {APP.organization} · {APP.fullName}
            </p>
          </div>

          <div className="sm:text-right">
            <p className="text-sm font-medium text-tertiary">
              {tab === 'review' ? 'CARs issued in period' : 'Total logged actions'}
            </p>
            <p className="text-display-sm font-semibold text-primary">
              {tab === 'review' ? review.issued.length : entries.length}
            </p>
            <p className="text-sm text-tertiary">
              Generated {formatDateTime(TODAY)} by {user.fullName}
            </p>
          </div>
        </div>
      </Card>

      <Tabs selectedKey={tab} onSelectionChange={setTab}>
        <TabList type="button-border" size="sm" className="no-print">
          <Tab id="review" label="Management Review" />
          <Tab id="summary" label="Activity summary" />
          <Tab id="detail" label="Detailed entries" badge={entries.length} />
        </TabList>
      </Tabs>

      {tab === 'review' && (
        <div className="flex flex-col gap-4">
          <StatStrip>
            <MetricCard label="CARs issued" value={review.issued.length} hint="In this period" />
            <MetricCard label="CARs closed" value={review.closedInPeriod.length} hint="In this period" color="success" />
            <MetricCard
              label="Open today"
              value={review.open.length}
              hint={`${review.overdue.length} overdue for their current stage`}
            />
            <MetricCard
              label="Effectiveness results"
              value={review.results.length}
              hint={`${passed} passed in this period · ${review.checksDue.length} checks still due`}
            />
          </StatStrip>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card
              title="CARs by source"
              subtitle="Issued and closed in this period; open and overdue as of today"
              className="print-flat print-avoid-break"
              pad={false}
            >
              <ReportTable
                columns={breakdownColumns('Source')}
                rows={review.bySource}
                total={breakdownTotal(review.bySource)}
                empty="No CAR sources are set up."
              />
            </Card>

            <Card
              title="CARs by department"
              subtitle="Departments the CARs were issued to"
              className="print-flat print-avoid-break"
              pad={false}
            >
              <ReportTable
                columns={breakdownColumns('Department')}
                rows={review.byDepartment}
                total={breakdownTotal(review.byDepartment)}
                empty="No CARs issued, closed or open for any department."
              />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="CAR status" subtitle="Every CAR by its current status" className="print-flat print-avoid-break">
              <CategoryBarChart data={review.statuses} labelWidth={160} />
            </Card>

            <Card
              title="Effectiveness results"
              subtitle="Checks recorded in this period"
              className="print-flat print-avoid-break"
            >
              <CategoryBarChart data={review.resultChart} labelWidth={200} />
            </Card>
          </div>

          <Card
            title="Trend"
            subtitle={`CARs issued per month, and closed, over the twelve months to ${formatDate(range.end)}`}
            className="print-flat print-avoid-break"
          >
            <TrendAreaChart data={review.trend.map((bucket) => ({ label: bucket.label, value: bucket.issued }))} />
            <div className="-mx-4 mt-4 border-t border-secondary md:-mx-5">
              <ReportTable
                columns={[
                  { id: 'label', label: 'Month', render: (row) => <span className="font-medium text-primary">{row.label}</span> },
                  ...review.trend.map((bucket) => ({
                    id: bucket.key,
                    label: bucket.label,
                    align: 'right',
                    render: (row) => row[bucket.key],
                  })),
                ]}
                rows={['issued', 'closed'].map((measure) => ({
                  key: measure,
                  label: measure === 'issued' ? 'Issued' : 'Closed',
                  ...Object.fromEntries(review.trend.map((bucket) => [bucket.key, bucket[measure]])),
                }))}
              />
            </div>
          </Card>

          <Card
            title="Overdue CARs"
            subtitle="Past the deadline of their current stage, as of today"
            className="print-flat print-avoid-break"
            pad={false}
          >
            <ReportTable
              columns={[
                { id: 'car', label: 'CAR', render: (car) => <CarLink car={car} /> },
                departmentCell,
                { id: 'responsible', label: 'Responsible', render: (car) => responsible(car) },
                { id: 'stage', label: 'Late for', render: (car) => car.deadline.label },
                { id: 'due', label: 'Due', render: (car) => <span className="whitespace-nowrap">{formatDate(car.deadline.date)}</span> },
                {
                  id: 'late',
                  label: 'Days late',
                  align: 'right',
                  render: (car) => (
                    <span className="font-semibold text-error-primary">{Math.abs(daysBetween(TODAY, car.deadline.date))}</span>
                  ),
                },
              ]}
              rows={review.overdue}
              empty="No CAR is overdue."
            />
          </Card>

          <Card
            title="Close-out dates"
            subtitle="Closed out in this period, and still to close out"
            className="print-flat print-avoid-break"
            pad={false}
          >
            <ReportTable
              columns={[
                { id: 'car', label: 'CAR', render: (row) => <CarLink car={row.car} /> },
                departmentCell,
                { id: 'status', label: 'Status', render: (row) => <StatusBadge status={row.car.status} /> },
                { id: 'planned', label: 'Planned', render: (row) => <span className="whitespace-nowrap">{formatDate(row.planned)}</span> },
                {
                  id: 'actual',
                  label: 'Closed out',
                  render: (row) =>
                    row.actual ? <span className="whitespace-nowrap">{formatDate(row.actual)}</span> : <span className="text-quaternary">—</span>,
                },
                { id: 'standing', label: 'Standing', render: (row) => <Standing text={closeOutStanding(row)} /> },
              ]}
              rows={review.closeOuts}
              empty="No close-outs in this period and none coming up."
            />
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card
              title="Effectiveness checks due"
              subtitle="After close-out, and under extended monitoring"
              className="print-flat print-avoid-break"
              pad={false}
            >
              <ReportTable
                columns={[
                  { id: 'car', label: 'CAR', render: (row) => <CarLink car={row.car} /> },
                  departmentCell,
                  { id: 'kind', label: 'Check', render: (row) => row.kind },
                  {
                    id: 'due',
                    label: 'Due',
                    render: (row) => (
                      <span className="flex flex-col whitespace-nowrap">
                        <span>{formatDate(row.date)}</span>
                        <Standing text={row.car.overdue ? `Overdue, ${relativeDays(row.date)}` : relativeDays(row.date)} />
                      </span>
                    ),
                  },
                ]}
                rows={review.checksDue}
                empty="No effectiveness or monitoring checks are due."
              />
            </Card>

            <Card
              title="Effectiveness results recorded"
              subtitle="In this period"
              className="print-flat print-avoid-break"
              pad={false}
            >
              <ReportTable
                columns={[
                  { id: 'car', label: 'CAR', render: (row) => <CarLink car={row.car} /> },
                  departmentCell,
                  { id: 'result', label: 'Result', render: (row) => <StatusBadge status={row.result} /> },
                  { id: 'date', label: 'Date', render: (row) => <span className="whitespace-nowrap">{formatDate(row.date)}</span> },
                ]}
                rows={review.results}
                empty="No effectiveness check was recorded in this period."
              />
            </Card>
          </div>

          <Card
            title="Re-issued CARs"
            subtitle="Findings raised again under a new number in this period"
            className="print-flat print-avoid-break"
            pad={false}
          >
            <ReportTable
              columns={[
                { id: 'car', label: 'CAR', render: (row) => <CarLink car={row.car} /> },
                {
                  id: 'original',
                  label: 'Re-issue of',
                  render: (row) => (row.original ? <CarLink car={row.original} /> : <span className="text-quaternary">—</span>),
                },
                departmentCell,
                { id: 'source', label: 'Source', render: (row) => sourceById(row.car.source)?.name || row.car.source },
                { id: 'reason', label: 'Reason', render: (row) => row.reason || '—' },
                { id: 'recurrence', label: 'Recurrence', align: 'right', render: (row) => row.recurrence },
                { id: 'status', label: 'Status', render: (row) => <StatusBadge status={row.car.status} /> },
              ]}
              rows={review.reissues}
              empty="No CAR was re-issued in this period."
            />
          </Card>

          <Card
            title="Document requests"
            subtitle="Steps taken in this period; open and past the review limit as of today"
            className="print-flat print-avoid-break"
            pad={false}
          >
            <ReportTable
              columns={[
                { id: 'label', label: 'Type', render: (row) => <span className="font-medium text-primary">{row.label}</span> },
                ...REQUEST_STEPS.map((step) => ({ id: step.id, label: step.label, align: 'right', render: (row) => row[step.id] })),
                { id: 'open', label: 'Open today', align: 'right', render: (row) => row.open },
                {
                  id: 'late',
                  label: 'Past limit',
                  align: 'right',
                  render: (row) => <span className={cx(row.late > 0 && 'font-semibold text-error-primary')}>{row.late}</span>,
                },
              ]}
              rows={review.requestRows}
              total={{
                label: 'Total',
                ...Object.fromEntries(REQUEST_STEPS.map((step) => [step.id, sum(review.requestRows, step.id)])),
                open: sum(review.requestRows, 'open'),
                late: sum(review.requestRows, 'late'),
              }}
              empty="No document requests on record."
            />
          </Card>
        </div>
      )}

      {tab === 'summary' && (
        <div className="flex flex-col gap-4">
          <StatStrip>
            <MetricCard label="CARs issued" value={review.issued.length} hint="In this period" />
            <MetricCard label="CARs closed" value={review.closedInPeriod.length} hint="In this period" color="success" />
            <MetricCard label="Documents in repository" value={documents.length} hint="All statuses" />
            <MetricCard label="Logged actions" value={entries.length} hint={`${Object.keys(byUser).length} users`} />
          </StatStrip>

          {/* ------------------------ 21.1 / 21.2 / 21.3 breakdowns */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            {REPORT_SECTIONS.map((section) => {
              const total = section.actions.reduce((count, item) => count + (byAction[item] || 0), 0)
              return (
                <Card
                  key={section.key}
                  title={section.title}
                  subtitle={`${total} action${total === 1 ? '' : 's'} in period`}
                  className="print-flat print-avoid-break"
                >
                  <dl className="flex flex-col">
                    {section.actions.map((item) => (
                      <div
                        key={item}
                        className="flex items-baseline justify-between gap-4 border-b border-secondary py-2 last:border-b-0"
                      >
                        <dt className="text-sm text-secondary">{item}</dt>
                        <dd className="font-mono text-sm font-semibold text-primary">{byAction[item] || 0}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              )
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="CAR register status" subtitle="Current standing across all CARs" className="print-flat">
              <CategoryBarChart data={review.statuses} labelWidth={160} />
            </Card>

            <Card title="Most active users" subtitle="Logged actions in this period" className="print-flat">
              {topUsers.length === 0 ? (
                <PageState icon={Users01} size="sm" title="No recorded activity in this period" />
              ) : (
                <CategoryBarChart data={topUsers} labelWidth={140} />
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'detail' && (
        <div className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary print-flat">
          {entries.length === 0 ? (
            <PageState icon={Activity} title="No activity in this period" text="Select a different period." />
          ) : (
            <DataTable ariaLabel="Detailed log entries" columns={DETAIL_COLUMNS} rows={entries} renderCell={renderDetailCell} />
          )}
        </div>
      )}
    </Page>
  )
}
