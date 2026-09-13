/* ============================================================================
   Notifications (PRD 20) — in-app notification centre.
   ========================================================================== */

import { useState } from 'react'
import { Bell01, Check, ChevronRight, InfoCircle, Mail01 } from '@untitledui/icons'
import { useNavigate } from 'react-router-dom'

import { Page, PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Callout,
  FeaturedIcon,
  PageState,
  StatusBadge,
  Tab,
  TabList,
  Tabs,
  cx,
  icon as resolveIcon,
} from '@/components/ui'
import { NOTIFICATION_RULES } from '@/config/appConfig'
import { NOTIFICATION_META } from '@/config/constants'
import { path } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { statusTone } from '@/utils/status'
import { formatDateTime } from '@/utils/format'

export default function Notifications() {
  const { user } = useAuth()
  const { notificationsForUser, markNotificationRead, markAllNotificationsRead } = useData()
  const navigate = useNavigate()
  const [tab, setTab] = useState('unread')

  const all = notificationsForUser(user.id)
  const unread = all.filter((notification) => !notification.read)
  const rows = tab === 'unread' ? unread : all

  const open = (notification) => {
    markNotificationRead(notification.id)
    if (notification.recordType === 'car' && notification.recordId) navigate(path.car(notification.recordId))
    if (notification.recordType === 'document' && notification.recordId)
      navigate(path.document(notification.recordId))
    if (notification.recordType === 'request' && notification.recordId) navigate(path.request(notification.recordId))
  }

  return (
    <Page>
      <PageHeader
        title="Notifications"
        subtitle={
          NOTIFICATION_RULES.email
            ? 'CAR stages, due dates and overdue reminders, document requests and review dates. Each notification is also emailed to the person it concerns — simulated in this prototype.'
            : 'CAR stages, due dates and overdue reminders, document requests and review dates.'
        }
        actions={
          unread.length > 0 && (
            <Button color="secondary" size="md" iconLeading={Check} onClick={() => markAllNotificationsRead(user.id)}>
              Mark all as read
            </Button>
          )
        }
      >
        <Tabs selectedKey={tab} onSelectionChange={setTab}>
          <TabList type="button-border" size="sm">
            <Tab id="unread" label="Unread" badge={unread.length} />
            <Tab id="all" label="All" badge={all.length} />
          </TabList>
        </Tabs>
      </PageHeader>

      {!NOTIFICATION_RULES.email && (
        <Callout tone="gray" icon={InfoCircle} title="In-app notifications only">
          {NOTIFICATION_RULES.emailNote}
        </Callout>
      )}

      <div className="overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary">
        {rows.length === 0 ? (
          <PageState
            icon={Bell01}
            title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            text="You will be notified when a CAR reaches you or one of its due dates approaches, when a document request is decided, and when a document is due for review."
          />
        ) : (
          <ul className="divide-y divide-secondary">
            {rows.map((notification) => {
              const meta = NOTIFICATION_META[notification.type] || { icon: 'bell', tone: 'Pending' }
              const MetaIcon = resolveIcon(meta.icon)

              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => open(notification)}
                    className={cx(
                      'flex w-full cursor-pointer items-start gap-4 px-4 py-4 text-left transition duration-100 ease-linear hover:bg-primary_hover md:px-5',
                      !notification.read && 'bg-brand-primary/40',
                    )}
                  >
                    <FeaturedIcon icon={MetaIcon} size="md" color={statusTone(meta.tone)} theme="light" />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={cx(
                            'text-sm text-primary',
                            notification.read ? 'font-medium' : 'font-semibold',
                          )}
                        >
                          {notification.title}
                        </span>
                        <StatusBadge status={meta.tone} />
                      </div>

                      <p className="mt-0.5 text-sm text-tertiary">{notification.message}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-quaternary">
                        <span>{formatDateTime(notification.timestamp)}</span>
                        {notification.emailedTo?.length > 0 && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <Mail01 className="size-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">
                              Emailed to{' '}
                              {notification.emailedTo.map((to) => `${to.name} <${to.email}>`).join(', ')}
                            </span>
                          </span>
                        )}
                      </p>
                    </div>

                    <ChevronRight className="mt-1 size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Page>
  )
}
