/* ============================================================================
   db.js — TEMPORARY JSON DATABASE ADAPTER
   ----------------------------------------------------------------------------
   Each file in /database is treated as a table. This module is the ONLY place
   that imports them, so swapping the JSON files for a real API later means
   rewriting this file alone.
   ========================================================================== */

import activityLogs from '@db/activity_logs.json'
import carAttachments from '@db/car_attachments.json'
import cars from '@db/cars.json'
import carSources from '@db/car_sources.json'
import carStatuses from '@db/car_statuses.json'
import departments from '@db/departments.json'
import documentCategories from '@db/document_categories.json'
import documentRevisions from '@db/document_revisions.json'
import documents from '@db/documents.json'
import notifications from '@db/notifications.json'
import roles from '@db/roles.json'
import users from '@db/users.json'

/** Deep clone so screens can mutate their working copy without touching the source. */
const clone = (rows) => JSON.parse(JSON.stringify(rows))

/**
 * Seed rows carry root-absolute asset paths ("/avatars/…"). Vite rewrites the
 * asset URLs it can see at build time, but never these — they are plain strings
 * in JSON. Under a project-site subpath they would all 404, so they are
 * resolved against the deployed base as the table is loaded.
 */
const asset = (path) =>
  typeof path === 'string' && path.startsWith('/')
    ? `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`
    : path

export const tables = {
  users: () => clone(users).map((u) => ({ ...u, avatarUrl: asset(u.avatarUrl) })),
  roles: () => clone(roles),
  departments: () => clone(departments),
  documentCategories: () => clone(documentCategories),
  documents: () => clone(documents),
  documentRevisions: () => clone(documentRevisions),
  cars: () => clone(cars),
  carSources: () => clone(carSources),
  carStatuses: () => clone(carStatuses),
  carAttachments: () => clone(carAttachments),
  activityLogs: () => clone(activityLogs),
  notifications: () => clone(notifications),
}

/** Load every table at once — used to seed the in-memory store on boot. */
export function loadDatabase() {
  return {
    users: tables.users(),
    roles: tables.roles(),
    departments: tables.departments(),
    documentCategories: tables.documentCategories(),
    documents: tables.documents(),
    documentRevisions: tables.documentRevisions(),
    cars: tables.cars(),
    carSources: tables.carSources(),
    carStatuses: tables.carStatuses(),
    carAttachments: tables.carAttachments(),
    activityLogs: tables.activityLogs(),
    notifications: tables.notifications(),
  }
}
