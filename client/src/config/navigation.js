/* ============================================================================
   navigation.js — CENTRALIZED ROUTE + SIDEBAR MAP
   ----------------------------------------------------------------------------
   Routes, sidebar grouping, breadcrumb labels and per-role visibility are all
   declared once here. Adding a screen means adding one entry.
   ========================================================================== */

import { PERMISSION, ROLE } from './constants'

export const ROUTES = {
  login: '/login',
  dashboard: '/dashboard',
  documents: '/documents',
  documentDetail: '/documents/:id',
  cars: '/cars',
  carIssue: '/cars/new',
  carDetail: '/cars/:id',
  notifications: '/notifications',
  activityLogs: '/activity-logs',
  reports: '/reports',
  users: '/users',
  settings: '/settings',
}

export const path = {
  document: (id) => `/documents/${id}`,
  car: (id) => `/cars/${id}`,
}

/**
 * Sidebar sections. `permission` gates visibility; `roles` narrows further
 * when a permission alone is not specific enough.
 */
export const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: ROUTES.dashboard, label: 'Dashboard', icon: 'dashboard' },
      { to: ROUTES.notifications, label: 'Notifications', icon: 'bell', badge: 'notifications' },
    ],
  },
  {
    label: 'Repository',
    items: [
      { to: ROUTES.documents, label: 'Documents', icon: 'folder', permission: PERMISSION.DOCUMENT_VIEW },
    ],
  },
  {
    label: 'Corrective Actions',
    items: [
      { to: ROUTES.cars, label: 'CAR Register', icon: 'clipboard', badge: 'openCars' },
      { to: ROUTES.carIssue, label: 'Issue CAR', icon: 'plus-circle', permission: PERMISSION.CAR_ISSUE },
    ],
  },
  {
    label: 'Administration',
    roles: [ROLE.QMS],
    items: [
      { to: ROUTES.activityLogs, label: 'Activity Logs', icon: 'history', permission: PERMISSION.ACTIVITY_LOG_VIEW },
      { to: ROUTES.reports, label: 'Reports', icon: 'chart', permission: PERMISSION.REPORT_VIEW },
      { to: ROUTES.users, label: 'User Management', icon: 'users', permission: PERMISSION.USER_MANAGE },
      { to: ROUTES.settings, label: 'System Settings', icon: 'settings', permission: PERMISSION.SETTINGS_MANAGE },
    ],
  },
]

/** Breadcrumb / document-title labels keyed by the first path segment. */
export const SEGMENT_LABELS = {
  dashboard: 'Dashboard',
  documents: 'Document Repository',
  cars: 'CAR Register',
  new: 'Issue CAR',
  notifications: 'Notifications',
  'activity-logs': 'Activity Logs',
  reports: 'Reports',
  users: 'User Management',
  settings: 'System Settings',
}

export function visibleSections(user, can) {
  if (!user) return []
  return NAV_SECTIONS.map((section) => {
    if (section.roles && !section.roles.includes(user.role)) return null
    const items = section.items.filter((item) => !item.permission || can(item.permission))
    return items.length ? { ...section, items } : null
  }).filter(Boolean)
}
