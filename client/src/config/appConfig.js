/* ============================================================================
   appConfig.js — CENTRALIZED APP-LEVEL SETTINGS
   ----------------------------------------------------------------------------
   Reads defaults from database/settings.json so branding and business rules can
   be changed without touching components.
   ========================================================================== */

import settings from '@db/settings.json'

export const APP = {
  name: settings.organization.shortName,
  fullName: settings.organization.systemName,
  organization: settings.organization.name,
  standard: settings.organization.standard,
  logo: settings.organization.logoInitials,
  version: '0.1.0 — UI prototype',
}

export const CAR_RULES = settings.car
export const DOCUMENT_RULES = settings.document
export const SESSION_RULES = settings.session
export const REPORT_RULES = settings.reporting
export const NOTIFICATION_RULES = settings.notifications

export const SETTINGS = settings

/** Storage key for the mock session. */
export const SESSION_KEY = 'qms.session.userId'
