/* ============================================================================
   constants.js — CENTRALIZED DOMAIN VOCABULARY
   ----------------------------------------------------------------------------
   Every enumerated value the PRD defines lives here. Screens read from these
   arrays instead of hard-coding option lists, so adding a status, a CAR source
   or a nonconformity type is a one-line change.
   ========================================================================== */

/* --- Roles (PRD 5) -------------------------------------------------------- */
export const ROLE = {
  QMS: 'qms',
  USER: 'user',
}

export const ROLE_LABEL = {
  [ROLE.QMS]: 'QMS Department',
  [ROLE.USER]: 'Department',
}

/**
 * How a person is identified in the UI. QMS staff are shown by their role; for
 * everyone else the role name carries no information, so their own department
 * is shown instead ("Production" rather than a generic label).
 * Pass `deptName` from DataContext.
 */
export function identityLabel(user, deptName) {
  if (!user) return '—'
  if (user.role === ROLE.QMS) return ROLE_LABEL[ROLE.QMS]
  return deptName(user.departmentId) || ROLE_LABEL[ROLE.USER]
}

/* --- Permissions (PRD 5, 6) ----------------------------------------------- */
export const PERMISSION = {
  DOCUMENT_VIEW: 'document.view',
  DOCUMENT_DOWNLOAD: 'document.download',
  DOCUMENT_UPLOAD: 'document.upload',
  DOCUMENT_REVISE: 'document.revise',
  DOCUMENT_ARCHIVE: 'document.archive',
  DOCUMENT_DELETE: 'document.delete',
  CAR_VIEW_ALL: 'car.view.all',
  CAR_VIEW_OWN: 'car.view.own',
  CAR_ISSUE: 'car.issue',
  CAR_RESPOND: 'car.respond',
  CAR_REVIEW: 'car.review',
  CAR_REVISE: 'car.revise',
  CAR_VERIFY: 'car.verify',
  CAR_CLOSE: 'car.close',
  CAR_MONITOR: 'car.monitor',
  CAR_UPLOAD_EVIDENCE: 'car.upload.evidence',
  ACTIVITY_LOG_VIEW: 'activitylog.view',
  REPORT_VIEW: 'report.view',
  USER_MANAGE: 'user.manage',
  SETTINGS_MANAGE: 'settings.manage',
}

/* --- Document statuses (PRD 8.4) ------------------------------------------ */
export const DOC_STATUS = {
  ACTIVE: 'ACTIVE',
  FOR_REVIEW: 'FOR REVIEW',
  OBSOLETE: 'OBSOLETE',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
}
export const DOC_STATUS_LIST = Object.values(DOC_STATUS)

export const DOC_TYPES = ['Manual', 'Procedure', 'Form', 'Policy', 'Standard', 'Customer Document', 'Work Instruction']

export const RETENTION_PERIODS = ['1 Year', '3 Years', '5 Years', '10 Years', 'Permanent', 'As per contract']

/* --- CAR statuses (PRD 13) ------------------------------------------------ */
export const CAR_STATUS = {
  ACTIVE: 'Active',
  /* Present in the seed data and in car_statuses.json, but no workflow
     transition produces it yet — the QMS Department still has to say what
     distinguishes a Pending CAR from an Active one. */
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  FOR_REVISION: 'For Revision',
  OVERDUE: 'Overdue',
  FOR_VERIFICATION: 'For Verification',
  CLOSED: 'Closed',
}
export const CAR_STATUS_LIST = Object.values(CAR_STATUS)

/** Statuses still requiring work from the recipient. */
export const CAR_OPEN_STATUSES = [
  CAR_STATUS.ACTIVE,
  CAR_STATUS.PENDING,
  CAR_STATUS.FOR_REVISION,
  CAR_STATUS.OVERDUE,
]

/** Statuses sitting with the QMS Department. */
export const CAR_QMS_QUEUE_STATUSES = [
  CAR_STATUS.UNDER_REVIEW,
  CAR_STATUS.FOR_VERIFICATION,
]

/** Pseudo-filter for the register: every status still requiring a response. */
export const CAR_FILTER_OPEN = 'Open (any status)'

/* --- CAR workflow (PRD 12) ------------------------------------------------ */
export const CAR_WORKFLOW = [
  { key: 'issue',       label: 'Issue CAR',                     hint: 'CAR raised and numbered' },
  { key: 'active',      label: 'CAR Active',                    hint: 'Routed to the concerned user' },
  { key: 'analysis',    label: 'Root Cause & Action Plan',      hint: 'Recipient investigates and responds' },
  { key: 'submitted',   label: 'Submitted to QMS',              hint: 'Response filed with the QMS Department' },
  { key: 'review',      label: 'QMS Review & Approval',         hint: 'Adequacy of the response assessed' },
  { key: 'revision',    label: 'For Revision (if necessary)',   hint: 'Returned for rework' },
  { key: 'implement',   label: 'CAR Implementation',            hint: 'Corrective action carried out' },
  { key: 'verify',      label: 'For Verification',              hint: 'Closure of countermeasure verified' },
  { key: 'effective',   label: 'Effectiveness Verification',    hint: 'Result of the action plan validated' },
  { key: 'closed',      label: 'Closed / Extended Monitoring',  hint: 'CAR disposed' },
]

/* --- Nonconformity classification (PRD 10.2) ------------------------------ */
export const NC_TYPES = ['Major NC', 'Minor NC', 'OFI']
export const OFI_TYPES = ['Actionable', 'Non-Actionable']
export const REISSUE_REASONS = ['No-reply', 'Correction Action Not Accepted']

/* --- Verification (PRD 10.10) --------------------------------------------- */
export const DISPOSITIONS = ['OPEN', 'CLOSED']
export const EFFECTIVENESS_RESULTS = [
  'Pass',
  'Requires Extended Monitoring',
  'Further Action Required',
  'Fail (CAR Returned for Further Processing)',
]

export const YES_NO = ['Yes', 'No']

/* --- Activity log actions (PRD 21) ---------------------------------------- */
export const LOG_ACTIONS = {
  DOCUMENT: [
    'Viewed Document',
    'Downloaded Document',
    'Uploaded Document',
    'Revised Document',
    'Archived Document',
    'Deleted Document',
  ],
  CAR: [
    'Created/Issued CAR',
    'Submitted CAR',
    'Reviewed CAR',
    'Verified CAR',
    'Returned for Revision',
    'Closed CAR',
  ],
  USER: ['Login', 'Logout', 'Failed Login Attempt', 'Deactivation', 'Activation'],
}

export const LOG_MODULES = ['Document', 'CAR', 'User']

export const LOG_ALL_ACTIONS = [
  ...LOG_ACTIONS.DOCUMENT,
  ...LOG_ACTIONS.CAR,
  ...LOG_ACTIONS.USER,
]

/* --- Notification types (PRD 20) ------------------------------------------ */
export const NOTIFICATION_TYPE = {
  CAR_ISSUED: 'CAR_ISSUED',
  CAR_SUBMITTED: 'CAR_SUBMITTED',
  CAR_DUE_SOON: 'CAR_DUE_SOON',
  CAR_OVERDUE: 'CAR_OVERDUE',
  CAR_RETURNED: 'CAR_RETURNED',
  CAR_VERIFIED: 'CAR_VERIFIED',
  CAR_CLOSED: 'CAR_CLOSED',
  DOCUMENT_REVIEW_DUE: 'DOCUMENT_REVIEW_DUE',
}

export const NOTIFICATION_META = {
  [NOTIFICATION_TYPE.CAR_ISSUED]:        { icon: 'car',      tone: 'Active' },
  [NOTIFICATION_TYPE.CAR_SUBMITTED]:     { icon: 'clipboard', tone: 'Under Review' },
  [NOTIFICATION_TYPE.CAR_DUE_SOON]:      { icon: 'clock',    tone: 'For Revision' },
  [NOTIFICATION_TYPE.CAR_OVERDUE]:       { icon: 'alert',    tone: 'Overdue' },
  [NOTIFICATION_TYPE.CAR_RETURNED]:      { icon: 'undo',     tone: 'For Revision' },
  [NOTIFICATION_TYPE.CAR_VERIFIED]:      { icon: 'shield',   tone: 'For Verification' },
  [NOTIFICATION_TYPE.CAR_CLOSED]:        { icon: 'check',    tone: 'Closed' },
  [NOTIFICATION_TYPE.DOCUMENT_REVIEW_DUE]: { icon: 'file',   tone: 'FOR REVIEW' },
}

/* --- Reporting (PRD 21) --------------------------------------------------- */
export const REPORT_PERIODS = ['Weekly', 'Monthly']

export const REPORT_SECTIONS = [
  { key: 'document', title: '21.1  Document Repository Activities', actions: LOG_ACTIONS.DOCUMENT },
  { key: 'car',      title: '21.2  CAR Activities',                 actions: LOG_ACTIONS.CAR },
  { key: 'user',     title: '21.3  User Activities',                actions: LOG_ACTIONS.USER },
]

/* --- UI defaults ---------------------------------------------------------- */
export const PAGE_SIZE = 10
export const PAGE_SIZE_OPTIONS = [10, 25, 50]
export const ALL = 'All'
