/* ============================================================================
   System Settings — surfaces the values held in database/settings.json so the
   business rules the PRD leaves configurable are visible and editable in one
   place (CAR numbering format, reply due days, watermark template, retention).
   ========================================================================== */

import { useState } from 'react'
import { AlertTriangle, Check, InfoCircle, Shield01 } from '@untitledui/icons'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  Callout,
  Card,
  Input,
  NativeSelect,
  Section,
  StatusTag,
  Tab,
  TabList,
  Tabs,
  Toggle,
  cx,
} from '@/components/ui'
import { APP, SETTINGS } from '@/config/appConfig'
import { REPORT_PERIODS } from '@/config/constants'
import { useData } from '@/context/contexts'

const SECURITY_REQUIREMENTS = [
  'Secure authentication',
  'Password hashing',
  'Role-based access control',
  'Secure file upload',
  'Protected document access',
  'SQL injection protection',
  'Session management',
  'Audit logging',
  'Regular database backup',
  'Secure server configuration',
  'HTTPS/SSL',
  'Input validation',
]

const DATABASE_TABLES = [
  'users.json',
  'roles.json',
  'departments.json',
  'documents.json',
  'document_categories.json',
  'document_revisions.json',
  'cars.json',
  'car_sources.json',
  'car_statuses.json',
  'car_attachments.json',
  'activity_logs.json',
  'notifications.json',
  'settings.json',
]

/**
 * One settings row: what the setting is on the left, the control on the right.
 * This is the shape Untitled UI uses for settings screens, and it keeps every
 * control on this page aligned to the same column.
 */
function SettingRow({ label, hint, children, className }) {
  return (
    <div
      className={cx(
        'flex flex-col gap-2 border-b border-secondary py-4 first:pt-0 last:border-b-0 last:pb-0 md:flex-row md:items-start md:gap-8',
        className,
      )}
    >
      <div className="md:w-72 md:shrink-0">
        <p className="text-sm font-semibold text-primary">{label}</p>
        {hint && <p className="mt-0.5 text-sm text-tertiary">{hint}</p>}
      </div>
      <div className="min-w-0 flex-1 md:max-w-md">{children}</div>
    </div>
  )
}

/** A reference-data row: a code chip, a name and a description. */
function ReferenceRow({ code, name, description, tone }) {
  return (
    <div className="flex items-start gap-3 border-b border-secondary py-3 last:border-b-0">
      <span className="shrink-0">
        {tone ? (
          <StatusTag status={code} />
        ) : (
          <Badge size="sm" color="gray" type="modern" className="font-mono">
            {code}
          </Badge>
        )}
      </span>
      <div className="min-w-0 flex-1">
        {name && <p className="text-sm font-semibold text-primary">{name}</p>}
        <p className="text-sm text-tertiary">{description}</p>
      </div>
    </div>
  )
}

export default function Settings() {
  const { documentCategories, carSources, carStatuses } = useData()
  const [tab, setTab] = useState('general')
  const [form, setForm] = useState({
    organization: SETTINGS.organization.name,
    systemName: SETTINGS.organization.systemName,
    shortName: SETTINGS.organization.shortName,
    standard: SETTINGS.organization.standard,
    numberFormat: SETTINGS.car.numberFormat,
    replyDueDays: String(SETTINGS.car.replyDueDays),
    dueSoonReminderDays: String(SETTINGS.car.dueSoonReminderDays),
    autoFlagOverdue: SETTINGS.car.autoFlagOverdue,
    watermark: SETTINGS.document.dynamicWatermark,
    watermarkTemplate: SETTINGS.document.watermarkTemplate,
    reviewReminderDays: String(SETTINGS.document.reviewReminderDays),
    maxFileSizeMB: String(SETTINGS.document.maxFileSizeMB),
    idleTimeoutMinutes: String(SETTINGS.session.idleTimeoutMinutes),
    maxFailedLoginAttempts: String(SETTINGS.session.maxFailedLoginAttempts),
    passwordMinLength: String(SETTINGS.session.passwordMinLength),
    defaultPeriod: SETTINGS.reporting.defaultPeriod,
    emailNotifications: SETTINGS.notifications.email,
  })

  /** React Aria fields hand back the value; native selects hand back an event. */
  const set = (key) => (value) =>
    setForm((current) => ({ ...current, [key]: value?.target ? value.target.value : value }))

  return (
    <Page>
      <PageHeader
        title="System Settings"
        subtitle="Configuration behind the repository and the CAR workflow. In this prototype the values are read from database/settings.json."
        actions={
          <Button color="primary" size="md" iconLeading={Check}>
            Save changes
          </Button>
        }
      >
        <Tabs selectedKey={tab} onSelectionChange={setTab}>
          <TabList type="button-border" size="sm" className="overflow-x-auto">
            <Tab id="general" label="General" />
            <Tab id="car" label="CAR workflow" />
            <Tab id="documents" label="Documents" />
            <Tab id="security" label="Security & session" />
            <Tab id="reference" label="Reference data" />
          </TabList>
        </Tabs>
      </PageHeader>

      {tab === 'general' && (
        <Card bodyClassName="flex flex-col gap-8 py-6">
          <Section title="Organization" subtitle="Branding shown across the app.">
            <div>
              <SettingRow label="Organization name">
                <Input value={form.organization} onChange={set('organization')} aria-label="Organization name" />
              </SettingRow>
              <SettingRow label="Standard">
                <Input value={form.standard} onChange={set('standard')} aria-label="Standard" />
              </SettingRow>
              <SettingRow label="System name">
                <Input value={form.systemName} onChange={set('systemName')} aria-label="System name" />
              </SettingRow>
              <SettingRow label="Short name" hint="Shown in the sidebar and browser title.">
                <Input value={form.shortName} onChange={set('shortName')} aria-label="Short name" />
              </SettingRow>
              <SettingRow label="Default report period">
                <NativeSelect
                  aria-label="Default report period"
                  value={form.defaultPeriod}
                  onChange={set('defaultPeriod')}
                  options={REPORT_PERIODS.map((value) => ({ value, label: value }))}
                />
              </SettingRow>
            </div>
          </Section>

          <Section title="Notifications">
            <div>
              <SettingRow label="In-app notifications" hint="Always on — the notification centre is the system of record.">
                <Toggle isSelected isDisabled aria-label="In-app notifications" />
              </SettingRow>
              <SettingRow label="Email notifications" hint={SETTINGS.notifications.emailNote}>
                <Toggle
                  isSelected={form.emailNotifications}
                  onChange={set('emailNotifications')}
                  aria-label="Email notifications"
                />
              </SettingRow>
            </div>
          </Section>

          <Section title="About">
            <div className="flex flex-wrap gap-2">
              <Badge size="sm" color="gray" type="modern">
                {APP.fullName}
              </Badge>
              <Badge size="sm" color="gray" type="modern">
                {APP.version}
              </Badge>
              <Badge size="sm" color="gray" type="modern">
                Prototype data: /database
              </Badge>
            </div>
          </Section>
        </Card>
      )}

      {tab === 'car' && (
        <Card bodyClassName="flex flex-col gap-8 py-6">
          <Section title="Automatic CAR number generation">
            <div>
              <SettingRow label="Number format" hint="Placeholders: {YYYY} year, {####} zero-padded sequence.">
                <Input
                  value={form.numberFormat}
                  onChange={set('numberFormat')}
                  aria-label="Number format"
                  inputClassName="font-mono"
                />
              </SettingRow>
            </div>
            <Callout tone="gray" icon={InfoCircle} className="mt-4">
              {SETTINGS.car.numberFormatNote}
            </Callout>
          </Section>

          <Section title="Due dates and escalation">
            <div>
              <SettingRow label="Default reply due" hint="Days from the date the CAR is issued.">
                <Input
                  type="number"
                  value={form.replyDueDays}
                  onChange={set('replyDueDays')}
                  aria-label="Default reply due days"
                />
              </SettingRow>
              <SettingRow label="Reminder before due date" hint="Days ahead of the due date.">
                <Input
                  type="number"
                  value={form.dueSoonReminderDays}
                  onChange={set('dueSoonReminderDays')}
                  aria-label="Reminder days"
                />
              </SettingRow>
              <SettingRow
                label="Auto-flag overdue"
                hint="Mark a CAR Overdue once its due date passes without a response."
              >
                <Toggle
                  isSelected={form.autoFlagOverdue}
                  onChange={set('autoFlagOverdue')}
                  aria-label="Auto-flag overdue"
                />
              </SettingRow>
            </div>
          </Section>

          <Section title="CAR statuses" subtitle="The vocabulary the register and the workflow share.">
            <div>
              {carStatuses.map((status) => (
                <ReferenceRow key={status.key} code={status.key} description={status.description} tone />
              ))}
            </div>
          </Section>
        </Card>
      )}

      {tab === 'documents' && (
        <Card bodyClassName="flex flex-col gap-8 py-6">
          <Section title="Dynamic watermark">
            <div>
              <SettingRow
                label="Apply dynamic watermark"
                hint="Stamped on downloaded copies where applicable."
              >
                <Toggle isSelected={form.watermark} onChange={set('watermark')} aria-label="Apply dynamic watermark" />
              </SettingRow>
              <SettingRow
                label="Watermark template"
                hint="Placeholders: {FULLNAME}, {EMPLOYEE_NO}, {DATETIME}."
              >
                <Input
                  value={form.watermarkTemplate}
                  onChange={set('watermarkTemplate')}
                  aria-label="Watermark template"
                  inputClassName="font-mono"
                />
              </SettingRow>
            </div>
          </Section>

          <Section title="Version control and review">
            <div>
              <SettingRow label="Review reminder" hint="Days before the review date.">
                <Input
                  type="number"
                  value={form.reviewReminderDays}
                  onChange={set('reviewReminderDays')}
                  aria-label="Review reminder days"
                />
              </SettingRow>
              <SettingRow label="Maximum upload size" hint="In megabytes.">
                <Input
                  type="number"
                  value={form.maxFileSizeMB}
                  onChange={set('maxFileSizeMB')}
                  aria-label="Maximum upload size"
                />
              </SettingRow>
              <SettingRow label="Allowed file types">
                <div className="flex flex-wrap gap-2">
                  {SETTINGS.document.allowedFileTypes.map((type) => (
                    <Badge key={type} size="sm" color="gray" type="modern">
                      {type}
                    </Badge>
                  ))}
                </div>
              </SettingRow>
            </div>

            <Callout tone="success" icon={InfoCircle} className="mt-4">
              Previous versions are always retained and the last approved version is marked{' '}
              <strong>{SETTINGS.document.activeLabel}</strong>.
            </Callout>
          </Section>

          <Section title="Document categories">
            <div>
              {documentCategories.map((category) => (
                <ReferenceRow
                  key={category.id}
                  code={category.code}
                  name={category.name}
                  description={category.description}
                />
              ))}
            </div>
          </Section>
        </Card>
      )}

      {tab === 'security' && (
        <Card bodyClassName="flex flex-col gap-8 py-6">
          <Section title="Session management">
            <div>
              <SettingRow label="Idle timeout" hint="Minutes before an inactive session ends.">
                <Input
                  type="number"
                  value={form.idleTimeoutMinutes}
                  onChange={set('idleTimeoutMinutes')}
                  aria-label="Idle timeout"
                />
              </SettingRow>
              <SettingRow label="Maximum failed login attempts">
                <Input
                  type="number"
                  value={form.maxFailedLoginAttempts}
                  onChange={set('maxFailedLoginAttempts')}
                  aria-label="Maximum failed login attempts"
                />
              </SettingRow>
              <SettingRow label="Minimum password length">
                <Input
                  type="number"
                  value={form.passwordMinLength}
                  onChange={set('passwordMinLength')}
                  aria-label="Minimum password length"
                />
              </SettingRow>
            </div>
          </Section>

          <Section title="Security requirements" subtitle="PRD 22">
            <div className="flex flex-wrap gap-2">
              {SECURITY_REQUIREMENTS.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary ring-1 ring-secondary ring-inset"
                >
                  <Shield01 className="size-3.5 text-fg-quaternary" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>

            <Callout tone="warning" icon={AlertTriangle} title="Prototype scope" className="mt-4">
              This build covers UI and UX only. Authentication, hashing, transport security and server-side
              authorization are implemented in the backend phase.
            </Callout>
          </Section>
        </Card>
      )}

      {tab === 'reference' && (
        <Card bodyClassName="flex flex-col gap-8 py-6">
          <Section title="CAR sources">
            <div>
              {carSources.map((source) => (
                <ReferenceRow
                  key={source.code}
                  code={source.code}
                  name={source.name}
                  description={source.description}
                />
              ))}
            </div>
          </Section>

          <Section title="Temporary database">
            <p className="text-sm text-tertiary">
              Each table is a JSON file under <code className="font-mono text-primary">/database</code>. Replacing
              this folder with a real API only requires rewriting{' '}
              <code className="font-mono text-primary">src/data/db.js</code>.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {DATABASE_TABLES.map((file) => (
                <Badge key={file} size="sm" color="gray" type="modern" className="font-mono">
                  {file}
                </Badge>
              ))}
            </div>
          </Section>
        </Card>
      )}
    </Page>
  )
}
