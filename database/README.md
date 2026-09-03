# Temporary JSON database

Each file here acts as a **table**. It is a stand-in for the real database while the
project is in the UI/UX phase.

| File | Table | Key relationships |
|---|---|---|
| `users.json` | User accounts | `role` → `roles.key`, `departmentId` → `departments.id` |
| `roles.json` | Roles and their permission lists | consumed by `AuthContext.can()` |
| `departments.json` | Departments / sections | — |
| `document_categories.json` | Repository categories (PRD 8.1) | — |
| `documents.json` | Controlled documents (PRD 8.2) | `categoryId`, `departmentId`, `uploadedBy`, `lastRevisionBy` |
| `document_revisions.json` | Revision history; previous versions retained (PRD 8.4) | `documentId` → `documents.id` |
| `cars.json` | Corrective Action Reports (PRD 10.1–10.10) | `initiator.userId`, `recipient.userId`, `*.departmentId`, `revision.returnedBy` |
| `car_sources.json` | CAR source codes (PRD 10.1) | referenced by `cars.source` |
| `car_statuses.json` | CAR status vocabulary (PRD 13) | referenced by `cars.status` |
| `car_attachments.json` | Supporting files (PRD 16) | `carId` → `cars.id` |
| `activity_logs.json` | Activity log entries (PRD 19, 21) | `userId`, `recordId` |
| `notifications.json` | In-app notifications (PRD 20) | `userId`, `recordId` |
| `settings.json` | System settings — CAR numbering, watermark, session rules | single object, not an array |

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

Writes made in the running app (issuing a CAR, submitting a response, uploading a
document) are held in React state only. These files are the seed, not a persistence layer,
so a page reload returns to this baseline.

## Prototype accounts

| Username | Password | Role |
|---|---|---|
| `msantos` | `qms123` | QMS Department |
| `jcruz` | `user123` | QMS Department |
| `rdelacruz` | `user123` | Department — Production |
| `avillanueva` | `user123` | Department — Quality Control |
| `preyes` | `user123` | Department — Engineering |
| `jaquino` | `user123` | Department — Warehouse, **deactivated** to demo the blocked-login path |

The PRD calls the non-QMS role "Other Users"; the UI labels it **Department** and
identifies those people by their own department, which reads less abstractly on screen.

Passwords are plaintext deliberately: this build has no backend. Hashing and secure
authentication belong to the implementation phase (PRD 22).

## Fixed "today"

Seed data is written around **2026-08-31**, and `client/src/utils/format.js` pins `TODAY`
to that date so overdue CARs, due-soon reminders and review dates stay consistent. Change
that constant to move the prototype clock.
