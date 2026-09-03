/* ============================================================================
   Reports (PRD 21) — weekly and monthly activity log report.
   21.1 Document repository activities · 21.2 CAR activities · 21.3 User activities
   ========================================================================== */

import { useMemo, useState } from 'react'
import { Activity, ChevronLeft, ChevronRight, Printer, Users01 } from '@untitledui/icons'

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
  Tab,
  TabList,
  Tabs,
} from '@/components/ui'
import { APP, REPORT_RULES } from '@/config/appConfig'
import { CAR_STATUS_LIST, REPORT_SECTIONS } from '@/config/constants'
import { useData } from '@/context/contexts'
import { countBy } from '@/utils/filters'
import { TODAY, formatDate, formatDateTime, monthRange, weekRange } from '@/utils/format'

const DETAIL_COLUMNS = [
  { id: 'date', label: 'Date', isRowHeader: true },
  { id: 'time', label: 'Time' },
  { id: 'user', label: 'User' },
  { id: 'action', label: 'Action' },
  { id: 'record', label: 'Related record' },
  { id: 'details', label: 'Details' },
]

export default function Reports() {
  const { activityLogs, cars, documents, userName } = useData()
  const [period, setPeriod] = useState(REPORT_RULES.defaultPeriod)
  const [offset, setOffset] = useState(0)
  const [tab, setTab] = useState('summary')

  /* Period boundaries, shifted by `offset` whole weeks/months back. */
  const range = useMemo(() => {
    const base = new Date(TODAY)
    if (period === 'Weekly') base.setDate(base.getDate() - offset * 7)
    else base.setMonth(base.getMonth() - offset)
    return period === 'Weekly' ? weekRange(base) : monthRange(base)
  }, [period, offset])

  const entries = useMemo(
    () =>
      activityLogs.filter((entry) => {
        const at = new Date(entry.timestamp)
        return at >= range.start && at <= range.end
      }),
    [activityLogs, range],
  )

  const byAction = useMemo(() => countBy(entries, 'action'), [entries])
  const byUser = useMemo(() => countBy(entries, 'userId'), [entries])
  const carStatus = useMemo(() => countBy(cars, 'status'), [cars])

  const inRange = (value) => {
    if (!value) return false
    const at = new Date(value)
    return at >= range.start && at <= range.end
  }

  const carsIssued = cars.filter((car) => inRange(car.initiator.dateIssued))
  const carsClosed = cars.filter((car) => inRange(car.dateClosed))

  const statusData = useMemo(
    () => CAR_STATUS_LIST.map((status) => ({ label: status, value: carStatus[status] || 0 })),
    [carStatus],
  )

  const topUsers = useMemo(
    () =>
      Object.entries(byUser)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id, count]) => ({ label: userName(id), value: count })),
    [byUser, userName],
  )

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

  return (
    <Page>
      <PageHeader
        title="Reports"
        subtitle="Weekly and monthly activity log reports for the document repository, the CAR register and user accounts."
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
            <Button color="primary" size="md" iconLeading={Printer} onClick={() => window.print()}>
              Print report
            </Button>
          </>
        }
      />

      {/* ------------------------------------------------------ report header */}
      <Card className="print-flat">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-medium text-tertiary">{period} activity log report</p>
            <h2 className="text-display-xs font-semibold text-primary">
              {formatDate(range.start)} — {formatDate(range.end)}
            </h2>
            <p className="mt-1 text-sm text-tertiary">
              {APP.organization} · {APP.fullName}
            </p>
          </div>

          <div className="sm:text-right">
            <p className="text-sm font-medium text-tertiary">Total logged actions</p>
            <p className="text-display-sm font-semibold text-primary">{entries.length}</p>
            <p className="text-sm text-tertiary">Generated {formatDateTime(TODAY)}</p>
          </div>
        </div>
      </Card>

      <Tabs selectedKey={tab} onSelectionChange={setTab}>
        <TabList type="button-border" size="sm" className="no-print">
          <Tab id="summary" label="Summary" />
          <Tab id="detail" label="Detailed entries" badge={entries.length} />
        </TabList>
      </Tabs>

      {tab === 'summary' ? (
        <div className="flex flex-col gap-4">
          <StatStrip>
            <MetricCard label="CARs issued" value={carsIssued.length} hint="In this period" />
            <MetricCard label="CARs closed" value={carsClosed.length} hint="In this period" color="success" />
            <MetricCard label="Documents in repository" value={documents.length} hint="All statuses" />
            <MetricCard
              label="Logged actions"
              value={entries.length}
              hint={`${Object.keys(byUser).length} users`}
            />
          </StatStrip>

          {/* ------------------------ 21.1 / 21.2 / 21.3 breakdowns */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {REPORT_SECTIONS.map((section) => {
              const total = section.actions.reduce((sum, item) => sum + (byAction[item] || 0), 0)
              return (
                <Card
                  key={section.key}
                  title={section.title}
                  subtitle={`${total} action${total === 1 ? '' : 's'} in period`}
                  className="print-flat"
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
              <CategoryBarChart data={statusData} />
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
      ) : (
        <div className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary print-flat">
          {entries.length === 0 ? (
            <PageState
              icon={Activity}
              title="No activity in this period"
              text="Select a different week or month."
            />
          ) : (
            <DataTable
              ariaLabel="Detailed log entries"
              columns={DETAIL_COLUMNS}
              rows={entries}
              renderCell={renderDetailCell}
            />
          )}
        </div>
      )}
    </Page>
  )
}
