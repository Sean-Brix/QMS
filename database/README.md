# Temporary JSON database

Each file here acts as a **table**. It is a stand-in for the real database while the
project is in the UI/UX phase.

| File | Table | Key relationships |
|---|---|---|
| `users.json` | Sign-in accounts: QMS Admins, shared department accounts, Dev | `role` → `roles.key`, `departmentId` → `departments.id` |
| `personnel.json` | People behind each department account; they do not sign in | `departmentId` → `departments.id`, `addedBy` → `users.id` |
| `roles.json` | Roles and their permission lists | consumed by `AuthContext.can()` |
| `departments.json` | Departments / sections | — |
| `document_categories.json` | Repository categories (PRD 8.1) | — |
| `documents.json` | Controlled documents (PRD 8.2) | `categoryId`, `departmentId`, `uploadedBy`, `lastRevisionBy` |
| `document_revisions.json` | Revision history; previous versions retained as `OBSOLETE` (PRD 8.4) | `documentId` → `documents.id` |
| `document_requests.json` | Document Review / Change Notice requests: New, Revise, Obsolete | `documentId`, `originator.accountId`, `originator.personnelId`, `reviewer.personnelId` |
| `cars.json` | Corrective Action Reports (PRD 10.1–10.10) | see *People on a CAR* below; `reissuedFrom` → `cars.id` |
| `car_sources.json` | CAR source codes (PRD 10.1) | referenced by `cars.source` |
| `car_statuses.json` | CAR status vocabulary (PRD 13) | referenced by `cars.status` |
| `car_attachments.json` | Supporting files (PRD 16) | `carId` → `cars.id`, `uploadedBy` → `users.id`, `personnelId` |
| `activity_logs.json` | Activity log entries (PRD 19, 21) | `userId` (account), `personnelId` (who did it), `recordId` |
| `notifications.json` | In-app notifications (PRD 20), mirrored by email | `userId`, `recordId`; `stage` on reminders; `emailedTo` |
| `settings.json` | System settings — CAR numbering and timing, DRCN review limits, watermark templates, password policy, report periods | single object, not an array; `documents.watermarkTemplateId` → `document.watermarkTemplates[].id` |

### Settings and master lists

`settings.json` seeds the settings the store holds; System Settings saves a new copy and
puts it into effect at once (`applySettings` in `config/appConfig.js`), so a changed reply
period, reminder window or password rule applies immediately. Dates already written on a
CAR or request keep their value. `document_categories.json` and `car_sources.json` carry
`status` (`Active` / `Inactive`): an inactive entry stays on the records that use it but
is not offered for new ones, and only an entry nothing uses can be deleted. A document
with `watermark: true` is stamped with its `watermarkTemplateId`, or with
`document.defaultWatermarkTemplateId` when it names none.

### Notifications and email

Every notification belongs to one account and is mirrored by email. `emailedTo` records
where it went: a QMS Admin or Dev account's own address, or — for a shared department
account — the person on the record it concerns (the responsible person on a CAR, the
originator of a request), falling back to the department's address. Seeded rows get
`emailedTo` filled in on load (`utils/notifications.js`). Reminders raised by the
due-date sweep carry `stage` (`reply`, `implementation`, `verification`, `effectiveness`,
`monitoring`, or `review-<date>` for a document review), so each deadline is reminded
once.

### Accounts and personnel

The client confirmed three roles. **QMS Admins** each have an individual account.
**Each department has one shared account**, and keeps a list of its people in
`personnel.json` instead of giving everyone a login. **Dev** is Lancerspec's
technical account. Accounts are never deleted: a closed account has
`status: "Archived"` with `archivedAt` / `archivedBy`, so every record it touched
stays attached to it.

### People on a CAR

A CAR stores both the account and the person wherever a shared account is involved:

- `initiator.userId` is the account that raised it; `initiator.personnelId` names who
  raised it when that account is a department's (null for a QMS Admin).
- `recipient.userId` is the account the CAR is delivered to — the department's shared
  account, or a QMS Admin for a CAR routed to the QMS Department, which has no shared
  account. `recipient.personnelId` is the responsible person.
- `rootCause.analyzedBy`, and `responsibleId` on each entry of `immediateActions` and
  `correctiveActions`, are personnel ids.
- `verification.*.verifiedBy / validatedBy / approvedBy` are QMS Admin account ids.

`DataContext.userName(id)` resolves either kind of id, so screens do not need to know
which one a field holds.

### CAR lifecycle

`status` runs `Pending → Under Review → (For Revision) → Active → For Verification →
For Effectiveness Check → Closed`. Overdue is not a status: it is derived on read from
the deadline of the current stage — `initiator.replyDueDate`, the latest action target
date (or `implementationDueDate` after a check sent the CAR back), `verificationDueDate`,
`effectivenessDueDate`, or `extendedMonitoring.nextCheckDate`. `planAccepted`,
`implementation` and `closeOutDate` record the steps in between. Returned responses are
kept in `previousResponses`, and checks that sent the CAR back in `previousChecks`. A
re-issue links both ways: `reissuedFrom` on the new CAR, `reissuedAs` on the original.

### CAR numbers

Numbers follow the client's `XXX-YY-ZZZ`: source code, two-digit year, three-digit
sequence (`IQA-26-003`). By default the sequence restarts each year for each source;
`settings.car.sequenceReset` switches that, pending the client's answer.

### Document requests

A request moves `Submitted → Under Review → Approved`, or is `Returned for Revision`
(its originator edits and resubmits it), `Disapproved`, or `Cancelled` by its originator.
`reviewDueDate` comes from the DRCN limits in `settings.document.drcnReviewLimits`,
counted in working days from `receivedAt`, and restarts when a returned request is
resubmitted. Approval writes `approval` and `dcc` and publishes the change in the same
update: a new ACTIVE document, a new ACTIVE revision (the one it replaces becomes
`OBSOLETE`), or an obsolete document. `history` records every step, and
`documents.lastRequestId` / `document_revisions.requestId` point back to the request
behind each change. A revision request may carry `restoresRevisionId`: approving it
releases the next revision with that older revision's file, and the new revision row
records `restoredFrom`.

### Who sees which documents

QMS Admins and Dev see every document and every revision. Department accounts see
ACTIVE documents and only the ACTIVE revision of each; obsolete documents and earlier
revisions stay on record but are hidden from them (`documentsForUser`,
`revisionsForUser` in `DataContext`).

### The `revision` block on a CAR

A CAR sent back for rework carries its own record of that — `revision.notes`,
`returnedBy`, `returnedAt`, `dueDate` and `stage` (`review` when the QMS Department
rejected the response, `effectiveness` when the action plan failed validation). It is
deliberately separate from `verification.closure`: that block is for the verification
itself, and using it for review remarks made the two indistinguishable on the CAR form.
`revision.dueDate` is also written back to `initiator.replyDueDate`, so a returned CAR is
judged against its revised deadline rather than the one it has already missed.

## How it is loaded

`client/src/data/db.js` is the **only** module that imports these files. The Vite alias
`@db` (see `client/vite.config.js`) points here. Swapping this folder for a real API
means rewriting that one file — nothing in the pages or components imports JSON directly.

Writes made in the running app (issuing a CAR, submitting a response, adding personnel,
creating an account) are held in React state only. These files are the seed, not a
persistence layer, so a page reload returns to this baseline.

## Prototype accounts

| Username | Password | Role |
|---|---|---|
| `msantos` | `qms123` | QMS Admin |
| `jcruz` | `user123` | QMS Admin |
| `production` | `dept123` | Department — Production |
| `qualitycontrol` | `dept123` | Department — Quality Control |
| `engineering` | `dept123` | Department — Engineering |
| `hr` | `dept123` | Department — Human Resources; Google sign-in linked to `hr.department.company@gmail.com` |
| `purchasing` | `dept123` | Department — Purchasing |
| `maintenance` | `dept123` | Department — Maintenance |
| `warehouse` | `dept123` | Department — Warehouse, **deactivated** to demo the blocked-login path |
| `dev` | `dev123` | Dev |
| `rlopez` | `user123` | QMS Admin, **closed** to demo an archived account |

Logistics has no account yet, so creating a department account can be demonstrated.

Passwords are plaintext deliberately: this build has no backend. Hashing and secure
authentication belong to the implementation phase (PRD 22).

## Fixed "today"

Seed data is written around **2026-08-31**, and `client/src/utils/format.js` pins `TODAY`
to that date so overdue CARs, due-soon reminders and review dates stay consistent. Change
that constant to move the prototype clock.
