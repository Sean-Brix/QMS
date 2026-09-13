/* ============================================================================
   status.js — SINGLE SOURCE OF TRUTH FOR STATUS COLOUR
   ----------------------------------------------------------------------------
   Every status chip in the app resolves through this map, so adding a status is
   a one-line change here and no component needs to know about it.

   Values are Untitled UI badge colours:
   gray | brand | error | warning | success | slate | sky | blue | indigo |
   purple | pink | orange
   ========================================================================== */

export const STATUS_COLOR = {
  /* --- CAR statuses and register flags ----------------------------------- */
  'Pending': 'blue',
  'Under Review': 'indigo',
  'For Revision': 'warning',
  'Active': 'brand',
  'For Verification': 'purple',
  'For Effectiveness Check': 'sky',
  'Closed': 'success',
  'Overdue': 'error',
  'Extended monitoring': 'warning',
  'Re-issued': 'gray',
  'Re-issue of an earlier CAR': 'orange',

  /* --- Document statuses -------------------------------------------------- */
  'ACTIVE': 'success',
  'OBSOLETE': 'gray',
  'Review due': 'warning',

  /* --- Document request statuses (DRCN) ---------------------------------- */
  'Submitted': 'brand',
  'Returned for Revision': 'warning',
  'Approved': 'success',
  'Disapproved': 'error',
  'Cancelled': 'gray',

  /* --- Account and personnel state --------------------------------------- */
  'Inactive': 'gray',
  'Archived': 'slate',

  /* --- Verification disposition + result (PRD 10.10) ---------------------- */
  'OPEN': 'warning',
  'CLOSED': 'success',
  'Pass': 'success',
  'Fail': 'error',
  'Requires Extended Monitoring': 'warning',
  'Further Action Required': 'purple',

  /* --- Nonconformity classification (PRD 10.2) --------------------------- */
  'Major NC': 'error',
  'Minor NC': 'warning',
  'OFI': 'blue',

  /* --- Yes / No ----------------------------------------------------------- */
  'Yes': 'success',
  'No': 'gray',
}

/** Badge colour for any status string; unknown statuses fall back to grey. */
export function statusColor(status) {
  return STATUS_COLOR[status] || 'gray'
}

/**
 * Featured icons and callouts understand a smaller vocabulary than badges do:
 * brand | gray | success | warning | error. This folds the badge palette onto
 * that set so a status can drive either component.
 */
const BADGE_TO_TONE = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  brand: 'brand',
  gray: 'gray',
  slate: 'gray',
  blue: 'brand',
  sky: 'brand',
  indigo: 'brand',
  purple: 'brand',
  pink: 'brand',
  orange: 'warning',
}

/** Featured-icon / callout tone for any status string. */
export function statusTone(status) {
  return BADGE_TO_TONE[statusColor(status)] || 'gray'
}
