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
  requests: '/requests',
  requestNew: '/requests/new',
  requestDetail: '/requests/:id',
  requestEdit: '/requests/:id/edit',
  cars: '/cars',
  carIssue: '/cars/new',
  carDetail: '/cars/:id',
  notifications: '/notifications',
  personnel: '/personnel',
  account: '/account',
  activityLogs: '/activity-logs',
  reports: '/reports',
  users: '/users',
  settings: '/settings',
  systemMonitor: '/system',
}

export const path = {
  document: (id) => `/documents/${id}`,
  car: (id) => `/cars/${id}`,
  request: (id) => `/requests/${id}`,
  requestEdit: (id) => `/requests/${id}/edit`,
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
      { to: ROUTES.requests, label: 'Document Requests', icon: 'file-check', badge: 'requests' },
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
    label: 'My Department',
    roles: [ROLE.DEPARTMENT],
    items: [
      { to: ROUTES.personnel, label: 'Personnel', icon: 'personnel', permission: PERMISSION.PERSONNEL_VIEW },
    ],
  },
  {
    label: 'Administration',
    roles: [ROLE.QMS, ROLE.DEV],
    items: [
      { to: ROUTES.activityLogs, label: 'Activity Logs', icon: 'history', permission: PERMISSION.ACTIVITY_LOG_VIEW },
      { to: ROUTES.reports, label: 'Reports', icon: 'chart', permission: PERMISSION.REPORT_VIEW },
      { to: ROUTES.users, label: 'User Management', icon: 'users', permission: PERMISSION.USER_MANAGE },
      { to: ROUTES.personnel, label: 'Personnel', icon: 'personnel', permission: PERMISSION.PERSONNEL_VIEW },
      { to: ROUTES.settings, label: 'System Settings', icon: 'settings', permission: PERMISSION.SETTINGS_MANAGE },
    ],
  },
  {
    label: 'Developer',
    roles: [ROLE.DEV],
    items: [
      { to: ROUTES.systemMonitor, label: 'System Monitor', icon: 'monitor', permission: PERMISSION.SYSTEM_MONITOR },
    ],
  },
]

/** Breadcrumb labels keyed by path segment — or by "parent/segment" where one
    segment means different things under different parents. */
export const SEGMENT_LABELS = {
  dashboard: 'Dashboard',
  documents: 'Document Repository',
  requests: 'Document Requests',
  'requests/new': 'New request',
  edit: 'Edit and resubmit',
  cars: 'CAR Register',
  'cars/new': 'Issue CAR',
  notifications: 'Notifications',
  personnel: 'Personnel',
  account: 'My Account',
  'activity-logs': 'Activity Logs',
  reports: 'Reports',
  users: 'User Management',
  settings: 'System Settings',
  system: 'System Monitor',
}

export function visibleSections(user, can) {
  if (!user) return []
  return NAV_SECTIONS.map((section) => {
    if (section.roles && !section.roles.includes(user.role)) return null
    const items = section.items.filter((item) => !item.permission || can(item.permission))
    return items.length ? { ...section, items } : null
  }).filter(Boolean)
}
