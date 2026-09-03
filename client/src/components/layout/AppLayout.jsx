/* ============================================================================
   AppLayout — the application shell.
   ----------------------------------------------------------------------------
   A floating sidebar over a tinted page ground, with a light top strip carrying
   breadcrumbs and the global actions. The sidebar is fixed on desktop and slides
   in over a scrim on small screens.
   ========================================================================== */

import { useEffect, useMemo, useState } from 'react'
import { Bell01, Menu02, Moon01, Sun, X as XClose } from '@untitledui/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { Avatar, ButtonUtility, Icon } from '@/components/ui'
import { APP } from '@/config/appConfig'
import { CAR_OPEN_STATUSES } from '@/config/constants'
import { ROUTES, SEGMENT_LABELS } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { useTheme } from '@/providers/theme-provider'
import { initials } from '@/utils/format'
import Sidebar from './Sidebar'

/** Path segments turned into a trail; the last one is the current page. */
function Breadcrumbs({ crumbs }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      {crumbs.map((crumb, index) => (
        <span key={crumb.to} className="flex min-w-0 items-center gap-1.5">
          {index > 0 && <Icon name="chevron" className="size-3.5 shrink-0 text-fg-quaternary" />}
          {crumb.last ? (
            <span className="truncate font-semibold text-primary">{crumb.label}</span>
          ) : (
            <Link to={crumb.to} className="truncate font-medium text-tertiary hover:text-primary">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

export default function AppLayout() {
  const { user } = useAuth()
  const { carsForUser, notificationsForUser } = useData()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  /* Navigating always closes the mobile drawer. */
  useEffect(() => setDrawerOpen(false), [location.pathname])

  const myCars = carsForUser(user)
  const notifications = notificationsForUser(user.id)
  const unread = notifications.filter((notification) => !notification.read).length

  const badges = {
    notifications: unread,
    openCars: myCars.filter((car) => CAR_OPEN_STATUSES.includes(car.status)).length,
    totalCars: myCars.length,
  }

  const crumbs = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean)
    return segments.map((segment, index) => ({
      label: SEGMENT_LABELS[segment] || segment.toUpperCase(),
      to: `/${segments.slice(0, index + 1).join('/')}`,
      last: index === segments.length - 1,
    }))
  }, [location.pathname])

  const isDark = theme === 'dark'

  return (
    <div className="min-h-dvh bg-secondary">
      {/* ------------------------------------------------- mobile top header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-secondary bg-primary px-4 lg:hidden no-print">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-brand-solid text-xs font-bold text-white">
            {APP.logo}
          </span>
          <span className="text-sm font-semibold text-primary">{APP.name}</span>
        </div>

        <ButtonUtility
          size="sm"
          color="tertiary"
          tooltip={drawerOpen ? 'Close navigation' : 'Open navigation'}
          icon={drawerOpen ? XClose : Menu02}
          onClick={() => setDrawerOpen((open) => !open)}
        />
      </header>

      {/* ------------------------------------------------------ mobile drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-overlay/70 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-70 max-w-[85vw] transition-transform duration-200 ease-out lg:hidden ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar badges={badges} onNavigate={() => setDrawerOpen(false)} />
      </div>

      {/* ----------------------------------------------------- desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:p-1 no-print">
        <Sidebar badges={badges} onNavigate={() => {}} />
      </div>

      {/* -------------------------------------------------------- content area */}
      <div className="flex min-h-dvh flex-col lg:pl-70">
        <header className="flex items-center gap-4 px-4 pt-5 pb-1 md:px-8 no-print">
          <Breadcrumbs crumbs={crumbs} />

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ButtonUtility
              size="sm"
              color="tertiary"
              tooltip={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              icon={isDark ? Sun : Moon01}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
            />

            <div className="relative">
              <ButtonUtility
                size="sm"
                color="tertiary"
                tooltip={`Notifications (${unread} unread)`}
                icon={Bell01}
                onClick={() => navigate(ROUTES.notifications)}
              />
              {unread > 0 && (
                <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-error-solid px-1 text-[10px] font-semibold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>

            <Avatar
              size="sm"
              src={user.avatarUrl}
              initials={initials(user.fullName)}
              alt={user.fullName}
              status="online"
            />
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  )
}
