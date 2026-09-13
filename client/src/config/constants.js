/* ============================================================================
   constants.js — CENTRALIZED DOMAIN VOCABULARY
   ----------------------------------------------------------------------------
   Every enumerated value the PRD defines lives here. Screens read from these
   arrays instead of hard-coding option lists, so adding a status, a CAR source
   or a nonconformity type is a one-line change.
   ========================================================================== */

/* --- Roles (Confirmed requirements #1–#3, #9, #10) ------------------------ */
export const ROLE = {
  QMS: 'qms',
  DEPARTMENT: 'department',
  DEV: 'dev',
}

export const ROLE_LABEL = {
  [ROLE.QMS]: 'QMS Admin',
  [ROLE.DEPARTMENT]: 'Department',
  [ROLE.DEV]: 'Dev',
}

export const ROLE_LIST = Object.values(ROLE)

/** Roles whose accounts see every department's records, not only their own. */
export const ORG_WIDE_ROLES = [ROLE.QMS, ROLE.DEV]

/**
 * How an account is identified in the UI. A department account is shared by
 * everyone in the department, so it is labelled as such rather than by role;
 * the people behind it are named from the personnel list.
 */
export function identityLabel(user) {
  if (!user) return '—'
  if (user.role === ROLE.DEPARTMENT) return 'Department account'
  return ROLE_LABEL[user.role] || '—'
}

/* --- Accounts (Confirmed #8: archive/close instead of deletion) ----------- */
export const ACCOUNT_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ARCHIVED: 'Archived',
}
export const ACCOUNT_STATUS_LIST = Object.values(ACCOUNT_STATUS)

/** Personnel are non-login records kept by each department account (#3). */
export const PERSONNEL_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
}

/* --- Permissions (PRD 5, 6) ----------------------------------------------- */
export const PERMISSION = {
  DOCUMENT_VIEW: 'document.view',
  DOCUMENT_DOWNLOAD: 'document.download',
  DOC_REQUEST_SUBMIT: 'document.request.submit',
  DOC_REQUEST_REVIEW: 'document.request.review',
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
  /** Print, PDF and Excel export of reports. Who else may export is follow-up F6. */
  REPORT_PRINT: 'report.print',
  USER_MANAGE: 'user.manage',
  PERSONNEL_VIEW: 'personnel.view',
  PERSONNEL_MANAGE: 'personnel.manage',
  SETTINGS_MANAGE: 'settings.manage',
  SYSTEM_MONITOR: 'system.monitor',
}

/* --- Document statuses (Overview: obsolete documents are archived) -------- */
export const DOC_STATUS = {
  ACTIVE: 'ACTIVE',
  OBSOLETE: 'OBSOLETE',
}
export const DOC_STATUS_LIST = Object.values(DOC_STATUS)

/** Document levels from the Document Review / Change Notice form (F-DCC-001). */
export const DOC_LEVELS = [
  { value: 1, label: 'Manual' },
  { value: 2, label: 'Operational Procedure' },
  { value: 3, label: 'Supporting Document' },
  { value: 4, label: 'Form' },
]

export function docLevelLabel(level) {
  const match = DOC_LEVELS.find((item) => item.value === Number(level))
  return match ? `Level ${match.value} — ${match.label}` : '—'
}

export const RETENTION_PERIODS = ['1 Year', '3 Years', '5 Years', '10 Years', 'Permanent', 'As per contract']

/* --- Document requests (DRCN) --------------------------------------------- */
export const REQUEST_TYPE = {
  NEW: 'New',
  REVISE: 'Revise',
  OBSOLETE: 'Obsolete',
}
export const REQUEST_TYPE_LIST = Object.values(REQUEST_TYPE)

/* Proposed answer to follow-up B11 — confirm with the client. */
export const REQUEST_STATUS = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  RETURNED: 'Returned for Revision',
  APPROVED: 'Approved',
  DISAPPROVED: 'Disapproved',
  CANCELLED: 'Cancelled',
}
export const REQUEST_STATUS_LIST = Object.values(REQUEST_STATUS)

/** Requests nobody has decided yet — a document can have only one of these at a time. */
export const REQUEST_OPEN_STATUSES = [
  REQUEST_STATUS.SUBMITTED,
  REQUEST_STATUS.UNDER_REVIEW,
  REQUEST_STATUS.RETURNED,
]

/** Requests waiting on a QMS Admin; the review clock only runs for these. */
export const REQUEST_QMS_QUEUE_STATUSES = [REQUEST_STATUS.SUBMITTED, REQUEST_STATUS.UNDER_REVIEW]

export const REQUEST_TYPE_HINT = {
  [REQUEST_TYPE.NEW]: 'A document that is not in the repository yet.',
  [REQUEST_TYPE.REVISE]: 'A change to an ACTIVE document. Approval releases the next revision and makes the current one obsolete.',
  [REQUEST_TYPE.OBSOLETE]: 'Withdraw an ACTIVE document. Approval archives it for its retention period.',
}

export const PROCESS_TYPE = {
  REGULAR: 'A-Regular',
  URGENT: 'B-Urgent',
}
export const PROCESS_TYPE_LIST = Object.values(PROCESS_TYPE)

/* --- CAR lifecycle (PRD 13, given the stages of the client's process) ----- */
/* Proposed answer to follow-up E1. "Overdue" is a flag on the current stage's
   deadline, not a status (E2) — see utils/cars.js. */
export const CAR_STATUS = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  FOR_REVISION: 'For Revision',
  ACTIVE: 'Active',
  FOR_VERIFICATION: 'For Verification',
  FOR_EFFECTIVENESS: 'For Effectiveness Check',
  CLOSED: 'Closed',
}
export const CAR_STATUS_LIST = Object.values(CAR_STATUS)

/** Every status before Closed. */
export const CAR_OPEN_STATUSES = CAR_STATUS_LIST.filter((status) => status !== CAR_STATUS.CLOSED)

/** Waiting on the department's root cause analysis and action plan. */
export const CAR_RESPONSE_STATUSES = [CAR_STATUS.PENDING, CAR_STATUS.FOR_REVISION]

/** Work sitting with the QMS Admins. */
export const CAR_QMS_QUEUE_STATUSES = [
  CAR_STATUS.UNDER_REVIEW,
  CAR_STATUS.FOR_VERIFICATION,
  CAR_STATUS.FOR_EFFECTIVENESS,
]

/** Pseudo-filter for the register: every status before Closed. */
export const CAR_FILTER_OPEN = 'Open (any status)'

/** Register flags that sit alongside the status. */
export const CAR_FLAG = {
  OVERDUE: 'Overdue',
  REISSUED: 'Re-issued',
  REISSUE: 'Re-issue of an earlier CAR',
  MONITORING: 'Extended monitoring',
}
export const CAR_FLAG_LIST = Object.values(CAR_FLAG)

/* --- CAR workflow (PRD 12 and the client's NC flowchart) ------------------ */
export const CAR_WORKFLOW = [
  { key: 'issued',         label: 'Issued',                   hint: 'Numbered and routed to the department' },
  { key: 'response',       label: 'Root cause & action plan', hint: 'The department responds within the reply period' },
  { key: 'review',         label: 'QMS review',               hint: 'Plan accepted, or returned for revision' },
  { key: 'implementation', label: 'Implementation',           hint: 'Actions carried out and evidence recorded' },
  { key: 'verification',   label: 'Verification',             hint: 'Countermeasure checked a day after the target date' },
  { key: 'effectiveness',  label: 'Effectiveness check',      hint: '6 months after close-out, or at the next internal audit' },
  { key: 'closed',         label: 'Closed',                   hint: 'Effective, or kept under extended monitoring' },
]

/* --- CAR numbering (Overview: XXX-YY-ZZZ) --------------------------------- */
export const CAR_SEQUENCE_RESET = {
  SOURCE_YEAR: 'source-year',
  YEAR: 'year',
  CONTINUOUS: 'continuous',
}

export const CAR_SEQUENCE_RESET_OPTIONS = [
  { value: CAR_SEQUENCE_RESET.SOURCE_YEAR, label: 'Restart each year, per source' },
  { value: CAR_SEQUENCE_RESET.YEAR, label: 'Restart each year, shared by all sources' },
  { value: CAR_SEQUENCE_RESET.CONTINUOUS, label: 'Never restart' },
]

/* --- Master lists kept in Settings (Confirmed #20, #27) ------------------- */
/** Categories and CAR sources are deactivated rather than deleted once anything uses them. */
export const MASTER_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
}

/** How the CAR form groups its sources. */
export const CAR_SOURCE_GROUPS = ['System', 'Material / Service']

/** File types a QMS Admin can allow for uploads. */
export const FILE_TYPE_OPTIONS = ['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX', 'PNG', 'JPG']

/* --- Nonconformity classification (PRD 10.2) ------------------------------ */
export const NC_TYPES = ['Major NC', 'Minor NC', 'OFI']
export const OFI_TYPES = ['Actionable', 'Non-Actionable']
/* --- Re-issuance (CAR form + Overview; follow-up D5) ---------------------- */
export const REISSUE_REASON = {
  NO_REPLY: 'No reply',
  NOT_ACCEPTED: 'Corrective action not accepted',
  SAME_ROOT_CAUSE: 'Same NC, same root cause',
  FAILED_EFFECTIVENESS: 'Failed effectiveness verification',
}
export const REISSUE_REASONS = Object.values(REISSUE_REASON)

export const REISSUE_REASON_HINT = {
  [REISSUE_REASON.NO_REPLY]: 'The department did not respond by the reply due date.',
  [REISSUE_REASON.NOT_ACCEPTED]: 'The response was not accepted, so the finding is raised again.',
  [REISSUE_REASON.SAME_ROOT_CAUSE]:
    'The same nonconformity came back with the same root cause. A different root cause is a new CAR, not a re-issue.',
  [REISSUE_REASON.FAILED_EFFECTIVENESS]: 'The corrective action failed its effectiveness check.',
}

/* --- Verification (PRD 10.10) --------------------------------------------- */
export const DISPOSITIONS = ['OPEN', 'CLOSED']
export const EFFECTIVENESS_RESULT = {
  PASS: 'Pass',
  MONITORING: 'Requires Extended Monitoring',
  FURTHER_ACTION: 'Further Action Required',
  FAIL: 'Fail',
}
export const EFFECTIVENESS_RESULTS = Object.values(EFFECTIVENESS_RESULT)

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
    'Submitted Document Request',
    'Resubmitted Document Request',
    'Started Request Review',
    'Returned Document Request',
    'Approved Document Request',
    'Disapproved Document Request',
    'Cancelled Document Request',
  ],
  CAR: [
    'Created/Issued CAR',
    'Submitted CAR',
    'Reviewed CAR',
    'Verified CAR',
    'Returned for Revision',
    'Closed CAR',
    'Recorded Implementation',
    'Recorded Effectiveness Check',
    'Recorded Monitoring Check',
    'Re-issued CAR',
  ],
  USER: [
    'Login',
    'Logout',
    'Failed Login Attempt',
    'Deactivation',
    'Activation',
    'Account Created',
    'Account Archived',
    'Password Reset',
    'Password Changed',
    'Google Account Linked',
    'Google Account Unlinked',
    'Personnel Added',
    'Personnel Updated',
    'Personnel Deactivated',
    'Personnel Activated',
    'Exported Report',
  ],
  SETTINGS: [
    'Changed Setting',
    'Added Category',
    'Updated Category',
    'Deactivated Category',
    'Activated Category',
    'Deleted Category',
    'Added CAR Source',
    'Updated CAR Source',
    'Deactivated CAR Source',
    'Activated CAR Source',
    'Deleted CAR Source',
  ],
}

export const LOG_MODULES = ['Document', 'CAR', 'User', 'Settings']

export const LOG_ALL_ACTIONS = [
  ...LOG_ACTIONS.DOCUMENT,
  ...LOG_ACTIONS.CAR,
  ...LOG_ACTIONS.USER,
  ...LOG_ACTIONS.SETTINGS,
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
  CAR_ACCEPTED: 'CAR_ACCEPTED',
  CAR_IMPLEMENTED: 'CAR_IMPLEMENTED',
  CAR_CHECK_DUE: 'CAR_CHECK_DUE',
  CAR_REISSUED: 'CAR_REISSUED',
  DOCUMENT_REVIEW_DUE: 'DOCUMENT_REVIEW_DUE',
  DOCUMENT_CHANGED: 'DOCUMENT_CHANGED',
  DOC_REQUEST_SUBMITTED: 'DOC_REQUEST_SUBMITTED',
  DOC_REQUEST_RETURNED: 'DOC_REQUEST_RETURNED',
  DOC_REQUEST_APPROVED: 'DOC_REQUEST_APPROVED',
  DOC_REQUEST_DISAPPROVED: 'DOC_REQUEST_DISAPPROVED',
  DOC_REQUEST_LATE: 'DOC_REQUEST_LATE',
}

export const NOTIFICATION_META = {
  [NOTIFICATION_TYPE.CAR_ISSUED]:        { icon: 'car',      tone: 'Pending' },
  [NOTIFICATION_TYPE.CAR_ACCEPTED]:      { icon: 'check-circle', tone: 'Active' },
  [NOTIFICATION_TYPE.CAR_IMPLEMENTED]:   { icon: 'clipboard-check', tone: 'For Verification' },
  [NOTIFICATION_TYPE.CAR_CHECK_DUE]:     { icon: 'shield',   tone: 'For Effectiveness Check' },
  [NOTIFICATION_TYPE.CAR_REISSUED]:      { icon: 'refresh',  tone: 'Re-issued' },
  [NOTIFICATION_TYPE.CAR_SUBMITTED]:     { icon: 'clipboard', tone: 'Under Review' },
  [NOTIFICATION_TYPE.CAR_DUE_SOON]:      { icon: 'clock',    tone: 'For Revision' },
  [NOTIFICATION_TYPE.CAR_OVERDUE]:       { icon: 'alert',    tone: 'Overdue' },
  [NOTIFICATION_TYPE.CAR_RETURNED]:      { icon: 'undo',     tone: 'For Revision' },
  [NOTIFICATION_TYPE.CAR_VERIFIED]:      { icon: 'shield',   tone: 'For Verification' },
  [NOTIFICATION_TYPE.CAR_CLOSED]:        { icon: 'check',    tone: 'Closed' },
  [NOTIFICATION_TYPE.DOCUMENT_REVIEW_DUE]: { icon: 'file',   tone: 'Review due' },
  [NOTIFICATION_TYPE.DOCUMENT_CHANGED]:    { icon: 'file-check', tone: 'Approved' },
  [NOTIFICATION_TYPE.DOC_REQUEST_SUBMITTED]:   { icon: 'file-check', tone: 'Submitted' },
  [NOTIFICATION_TYPE.DOC_REQUEST_RETURNED]:    { icon: 'undo',       tone: 'Returned for Revision' },
  [NOTIFICATION_TYPE.DOC_REQUEST_APPROVED]:    { icon: 'check',      tone: 'Approved' },
  [NOTIFICATION_TYPE.DOC_REQUEST_DISAPPROVED]: { icon: 'x-circle',   tone: 'Disapproved' },
  [NOTIFICATION_TYPE.DOC_REQUEST_LATE]:        { icon: 'alert',      tone: 'Overdue' },
}

/* --- Reporting (PRD 21) --------------------------------------------------- */
/* Quarterly and yearly are for Management Review; the PRD's activity report is weekly and monthly (F5). */
export const REPORT_PERIODS = ['Weekly', 'Monthly', 'Quarterly', 'Yearly']

export const REPORT_SECTIONS = [
  { key: 'document', title: '21.1  Document Repository Activities', actions: LOG_ACTIONS.DOCUMENT },
  { key: 'car',      title: '21.2  CAR Activities',                 actions: LOG_ACTIONS.CAR },
  { key: 'user',     title: '21.3  User Activities',                actions: LOG_ACTIONS.USER },
  /* Not in the PRD list: every settings change is audited (questionnaire #121). */
  { key: 'settings', title: 'System Settings',                      actions: LOG_ACTIONS.SETTINGS },
]

/* --- UI defaults ---------------------------------------------------------- */
export const PAGE_SIZE = 10
export const PAGE_SIZE_OPTIONS = [10, 25, 50]
export const ALL = 'All'
