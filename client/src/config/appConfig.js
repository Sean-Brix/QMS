/* ============================================================================
   appConfig.js — CENTRALIZED APP-LEVEL SETTINGS
   ----------------------------------------------------------------------------
   Seeded from database/settings.json and editable in System Settings.

   Each export below is one object for the lifetime of the app. When settings
   are saved, `applySettings` rewrites those objects in place, so a module that
   reads `CAR_RULES.replyDueWorkingDays` when it runs sees the saved value
   without every function having to be handed the settings. DataContext decides
   when that happens and re-renders the app straight after. A real deployment
   reads the same values from the API instead.
   ========================================================================== */

import settings from '@db/settings.json'

const clone = (value) => JSON.parse(JSON.stringify(value))

export const APP = { version: '0.1.0 — UI prototype' }
export const CAR_RULES = {}
export const DOCUMENT_RULES = {}
export const SESSION_RULES = {}
export const REPORT_RULES = {}
export const NOTIFICATION_RULES = {}
export const SETTINGS = {}

function replaceContents(target, source) {
  for (const key of Object.keys(target)) delete target[key]
  Object.assign(target, clone(source))
}

/** Puts a full settings object into effect. */
export function applySettings(next) {
  replaceContents(SETTINGS, next)
  replaceContents(CAR_RULES, next.car)
  replaceContents(DOCUMENT_RULES, next.document)
  replaceContents(SESSION_RULES, next.session)
  replaceContents(REPORT_RULES, next.reporting)
  replaceContents(NOTIFICATION_RULES, next.notifications)
  Object.assign(APP, {
    name: next.organization.shortName,
    fullName: next.organization.systemName,
    organization: next.organization.name,
    standard: next.organization.standard,
    logo: next.organization.logoInitials,
  })
}

/** A fresh copy of the seeded settings. */
export function seedSettings() {
  return clone(settings)
}

applySettings(settings)

/** Storage key for the mock session. */
export const SESSION_KEY = 'qms.session.userId'
