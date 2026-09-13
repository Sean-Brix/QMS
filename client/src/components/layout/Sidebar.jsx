/* ============================================================================
   Sidebar — the primary navigation panel.
   ----------------------------------------------------------------------------
   Structure follows Untitled UI's "sections with subheadings" sidebar: a
   floating rounded panel carrying the brand, a search field, grouped nav items,
   a live workload card and the account block.

   What is shown still comes entirely from config/navigation.js, so adding a
   screen remains a one-line change there.
   ========================================================================== */

import { useState } from 'react'
import { LogOut01, SearchLg } from '@untitledui/icons'
import { useLocation, useNavigate } from 'react-router-dom'

import { NavItemBase } from '@/components/application/app-navigation/base-components/nav-item'
import { Avatar, Badge, ButtonUtility, ProgressBarBase, icon as resolveIcon } from '@/components/ui'
import { APP } from '@/config/appConfig'
import { ROUTES, visibleSections } from '@/config/navigation'
import { useAuth, useData } from '@/context/contexts'
import { initials } from '@/utils/format'

/** The brand mark: the configured initials in a brand-coloured tile. */
function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-solid text-xs font-bold text-white">
        {APP.logo}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-primary">{APP.name}</span>
        <span className="truncate text-xs text-tertiary">{APP.standard}</span>
      </span>
    </div>
  )
}

/**
 * The workload card that sits above the account block — Untitled UI puts a
 * usage meter there; the equivalent that earns its place here is how much of
 * the user's own CAR queue is still open.
 */
function WorkloadCard({ open, total, onView }) {
  const percent = total === 0 ? 0 : Math.round((open / total) * 100)

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-secondary p-4">
      <div>
        <p className="text-sm font-semibold text-primary">CAR workload</p>
        <p className="text-sm text-tertiary">
          {total === 0
            ? 'No CARs are assigned to you.'
            : `${open} of ${total} ${total === 1 ? 'CAR is' : 'CARs are'} still open.`}
        </p>
      </div>

      <ProgressBarBase value={percent} />

      <button
        type="button"
        onClick={onView}
        className="self-start text-sm font-semibold text-brand-secondary hover:text-brand-secondary_hover"
      >
        View register
      </button>
    </div>
  )
}

/** The account block: who is signed in, a way to their account settings, and the way out. */
function AccountCard({ user, identity, onOpen, onLogout }) {
  return (
    <div className="flex items-center gap-1 rounded-xl p-1.5 ring-1 ring-secondary">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg p-1.5 text-left outline-focus-ring transition duration-100 ease-linear hover:bg-primary_hover focus-visible:outline-2"
      >
        <Avatar
          size="md"
          src={user.avatarUrl}
          initials={initials(user.fullName)}
          alt={user.fullName}
          status="online"
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-primary">{user.fullName}</span>
          <span className="block truncate text-xs text-tertiary">{identity}</span>
        </span>
      </button>

      <ButtonUtility size="xs" color="tertiary" tooltip="Log out" icon={LogOut01} onClick={onLogout} />
    </div>
  )
}

export default function Sidebar({ badges, onNavigate }) {
  const { user, can, logout } = useAuth()
  const { identityFor } = useData()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const sections = visibleSections(user, can)

  /* A parent route stays highlighted for its detail pages, but never for a
     sibling that has its own nav entry (e.g. /cars/new). */
  const siblingRoutes = sections.flatMap((section) => section.items.map((item) => item.to))
  const isActive = (to) => {
    if (pathname === to) return true
    if (!pathname.startsWith(`${to}/`)) return false
    return !siblingRoutes.some((other) => other !== to && pathname === other)
  }

  const submitSearch = (event) => {
    event.preventDefault()
    if (!query.trim()) return
    navigate(`${ROUTES.documents}?q=${encodeURIComponent(query.trim())}`)
    setQuery('')
    onNavigate?.()
  }

  return (
    <aside className="scroll-quiet flex h-full w-full max-w-full flex-col overflow-y-auto bg-primary pt-4 shadow-xs ring-secondary ring-inset lg:w-69 lg:rounded-xl lg:ring-1">
      <div className="px-4 lg:px-5">
        <BrandMark />
      </div>

      <form className="mt-5 px-4 lg:px-5" onSubmit={submitSearch} role="search">
        <label htmlFor="sidebar-search" className="sr-only">
          Search documents
        </label>
        <div className="relative">
          <SearchLg className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-quaternary" />
          <input
            id="sidebar-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents"
            className="w-full rounded-lg bg-primary py-2 pr-3 pl-9 text-sm text-primary shadow-xs ring-1 ring-primary transition duration-100 ease-linear outline-none ring-inset placeholder:text-placeholder focus:ring-2 focus:ring-brand"
          />
        </div>
      </form>

      <nav className="mt-5 flex-1">
        <ul>
          {sections.map((section) => (
            <li key={section.label}>
              <div className="px-5 pb-1">
                <p className="text-xs font-bold text-quaternary uppercase">{section.label}</p>
              </div>

              <ul className="px-4 pb-5">
                {section.items.map((item) => {
                  const count = item.badge ? badges[item.badge] : 0
                  return (
                    <li key={item.to} className="py-0.5">
                      <NavItemBase
                        type="link"
                        href={item.to}
                        current={isActive(item.to)}
                        onClick={onNavigate}
                        icon={resolveIcon(item.icon)}
                        badge={
                          count > 0 ? (
                            <Badge
                              size="sm"
                              type="pill-color"
                              color={item.badge === 'notifications' ? 'error' : 'gray'}
                              className="ml-3"
                            >
                              {count}
                            </Badge>
                          ) : undefined
                        }
                      >
                        {item.label}
                      </NavItemBase>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-4 px-4 py-4">
        <WorkloadCard
          open={badges.openCars}
          total={badges.totalCars}
          onView={() => {
            navigate(ROUTES.cars)
            onNavigate?.()
          }}
        />
        <AccountCard
          user={user}
          identity={identityFor(user)}
          onOpen={() => {
            navigate(ROUTES.account)
            onNavigate?.()
          }}
          onLogout={logout}
        />
      </div>
    </aside>
  )
}
