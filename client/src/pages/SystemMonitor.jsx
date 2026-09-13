/* ============================================================================
   System Monitor — Dev only (Confirmed requirement #10).
   ----------------------------------------------------------------------------
   Lancerspec's view of the deployed application. Request telemetry needs the
   backend, so this build reports what the prototype itself records: activity,
   sign-ins, accounts and the size of every table.
   ========================================================================== */

import { useMemo } from 'react'
import { Activity, AlertTriangle, Database01, InfoCircle, Users01 } from '@untitledui/icons'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import { Callout, Card, CategoryBarChart, DataTable, KeyValue, MetricCard, StatStrip, TrendAreaChart } from '@/components/ui'
import { APP, SESSION_KEY } from '@/config/appConfig'
import { ACCOUNT_STATUS, LOG_MODULES, ROLE_LABEL, ROLE_LIST } from '@/config/constants'
import { useData } from '@/context/contexts'
import { countBy } from '@/utils/filters'
import { TODAY, daysBetween, formatDateTime } from '@/utils/format'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WINDOW_DAYS = 14

const TABLE_COLUMNS = [
  { id: 'file', label: 'Table', isRowHeader: true },
  { id: 'holds', label: 'Holds' },
  { id: 'rows', label: 'Rows', align: 'right' },
]

export default function SystemMonitor() {
  const data = useData()
  const { activityLogs, users } = data

  /* Logged actions per day over the last two weeks, oldest first. */
  const daily = useMemo(() => {
    const buckets = Array.from({ length: WINDOW_DAYS }, (_, position) => {
      const day = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - (WINDOW_DAYS - 1 - position))
      return { offset: WINDOW_DAYS - 1 - position, label: `${day.getDate()} ${MONTHS[day.getMonth()]}`, value: 0 }
    })
    for (const entry of activityLogs) {
      const ago = daysBetween(entry.timestamp, TODAY)
      if (ago >= 0 && ago < WINDOW_DAYS) buckets[WINDOW_DAYS - 1 - ago].value += 1
    }
    return buckets
  }, [activityLogs])

  const lastWeek = activityLogs.filter((entry) => daysBetween(entry.timestamp, TODAY) < 7)
  const failedSignIns = lastWeek.filter((entry) => entry.action === 'Failed Login Attempt').length
  const signIns = lastWeek.filter((entry) => entry.action === 'Login').length

  const byModule = useMemo(() => {
    const counts = countBy(activityLogs, 'module')
    return LOG_MODULES.map((module) => ({ label: module, value: counts[module] || 0 }))
  }, [activityLogs])

  const byRole = useMemo(() => {
    const live = users.filter((account) => account.status !== ACCOUNT_STATUS.ARCHIVED)
    const counts = countBy(live, 'role')
    return ROLE_LIST.map((role) => ({ label: ROLE_LABEL[role], value: counts[role] || 0 }))
  }, [users])

  const tables = [
    { id: 'users', file: 'users.json', holds: 'Accounts' },
    { id: 'personnel', file: 'personnel.json', holds: 'Department personnel' },
    { id: 'documents', file: 'documents.json', holds: 'Controlled documents' },
    { id: 'documentRevisions', file: 'document_revisions.json', holds: 'Document revisions' },
    { id: 'documentRequests', file: 'document_requests.json', holds: 'Document requests (DRCN)' },
    { id: 'cars', file: 'cars.json', holds: 'Corrective Action Reports' },
    { id: 'carAttachments', file: 'car_attachments.json', holds: 'CAR supporting files' },
    { id: 'activityLogs', file: 'activity_logs.json', holds: 'Activity log entries' },
    { id: 'notifications', file: 'notifications.json', holds: 'In-app notifications' },
  ].map((table) => ({ ...table, rows: data[table.id]?.length ?? 0 }))

  const totalRows = tables.reduce((sum, table) => sum + table.rows, 0)
  const activeAccounts = users.filter((account) => account.status === ACCOUNT_STATUS.ACTIVE).length

  const renderTableCell = (table, columnId) => {
    if (columnId === 'file') return <span className="font-mono whitespace-nowrap text-primary">{table.file}</span>
    if (columnId === 'holds') return table.holds
    if (columnId === 'rows') return <span className="block text-right font-mono">{table.rows}</span>
    return null
  }

  return (
    <Page>
      <PageHeader
        title="System Monitor"
        subtitle="Activity, sign-ins and data volumes for support and testing. Visible to Dev accounts only."
      />

      <Callout tone="gray" icon={InfoCircle} title="Request metrics arrive with the backend">
        API request counts, response times and server errors need a server to measure. Until then this page reports
        what the prototype records itself.
      </Callout>

      <StatStrip>
        <MetricCard label="Actions logged" value={activityLogs.length} hint={`${lastWeek.length} in the last 7 days`} icon={Activity} />
        <MetricCard label="Sign-ins" value={signIns} hint="Last 7 days" icon={Users01} color="success" />
        <MetricCard
          label="Failed sign-ins"
          value={failedSignIns}
          hint="Last 7 days"
          icon={AlertTriangle}
          color={failedSignIns ? 'error' : 'gray'}
        />
        <MetricCard label="Records stored" value={totalRows} hint={`${activeAccounts} active accounts`} icon={Database01} color="gray" />
      </StatStrip>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Activity per day" subtitle={`Logged actions over the last ${WINDOW_DAYS} days`} className="xl:col-span-2">
          <TrendAreaChart data={daily} />
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Activity by module" subtitle="All logged actions">
            <CategoryBarChart data={byModule} />
          </Card>
          <Card title="Accounts by role" subtitle="Excluding closed accounts">
            <CategoryBarChart data={byRole} />
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary xl:col-span-2">
          <DataTable ariaLabel="Data tables" columns={TABLE_COLUMNS} rows={tables} renderCell={renderTableCell} />
        </div>

        <Card title="Environment">
          <KeyValue
            items={[
              { k: 'Version', v: APP.version },
              { k: 'Build mode', v: import.meta.env.MODE, mono: true },
              { k: 'Base path', v: import.meta.env.BASE_URL, mono: true },
              { k: 'Prototype clock', v: formatDateTime(TODAY) },
              { k: 'Session key', v: SESSION_KEY, mono: true },
              { k: 'Data source', v: 'In-memory store seeded from /database' },
            ]}
          />
        </Card>
      </div>
    </Page>
  )
}
