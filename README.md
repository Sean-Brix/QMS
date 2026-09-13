# QMS Portal

**Live demo → https://sean-brix.github.io/QMS/**

Online Repository and Corrective Action Report Management System for an
ISO 9001:2015 quality management system.

This is the **UI/UX phase**: every screen, rule and state transition is real and
runs against an in-memory store seeded from [`database/`](database/). There is no
backend yet, so **anything you create is lost on refresh** — treat a walkthrough
as one continuous session.

## Signing in

| Role | Username | Password | Sees |
|---|---|---|---|
| QMS Admin | `msantos` | `qms123` | Everything: all CARs, the repository, logs, reports, accounts, personnel, settings |
| QMS Admin | `jcruz` | `user123` | Same, as a second reviewer |
| Department | `production` | `dept123` | Production's shared account — its CARs and its personnel list |
| Department | `qualitycontrol` | `dept123` | Quality Control's shared account |
| Department | `hr` | `dept123` | Also signs in with Google as `hr.department.company@gmail.com` |
| Department | `warehouse` | `dept123` | Deactivated, to demonstrate the blocked-login path |
| Dev | `dev` | `dev123` | Everything, plus the System Monitor |

Each department signs in with **one shared account**. The people behind it are kept
on its Personnel page; they don't sign in, but they are the names recorded on CARs
and the addresses notifications go to.

Credentials are plaintext on purpose: there is no server to authenticate
against. Hashing and real authentication belong to the implementation phase.

## What works

- **Accounts** — QMS Admin, Department and Dev roles; shared department accounts
  with personnel lists; account creation with a temporary password to hand over;
  password reset; deactivation; closing an account without deleting its records;
  changing your own password under a moderate policy; linking Google sign-in.
- **The CAR lifecycle** — issue with `XXX-YY-ZZZ` numbering and a 5-working-day
  reply period; the department responds with a root cause and any number of
  actions, each with its own responsible person and target date; QMS accepts or
  returns the plan (returned responses are kept); the department records the
  implementation; QMS verifies the countermeasure a day after the target date and
  checks effectiveness six months after close-out or at the next internal audit.
  Results close the CAR, keep it under extended monitoring, send it back for
  further action, or re-issue it as a linked CAR. Overdue is a flag on whichever
  stage deadline has passed, and nobody reviews their own work.
- **Document requests** — every new document, revision and obsoletion is a
  Document Review / Change Notice: raised with its originator and department-head
  review, timed against the form's maximum review limits, then returned,
  disapproved or approved by a QMS Admin (never one who raised it). Approval
  publishes the change to the repository in the same step.
- **The document repository** — categories, levels, revisions with history
  (previous revisions kept as obsolete), review dates, and download with a watermark.
  Departments see ACTIVE documents and current revisions only; QMS Admins also see
  obsolete documents and earlier revisions, and can restore one through a revision
  request. Every view and download is logged.
- **Monitoring** — a dashboard of what the QMS Department watches: pending and
  overdue CARs, close-out dates, effectiveness checks, re-issued CARs, and
  document requests waiting on a decision. A department account sees the same
  for its own CARs and requests. Reminders go out before and after every stage
  deadline and document review date; each notification shows who it was emailed to.
- **Reports** — a Management Review report (CARs by source, department and
  status, overdue CARs, close-out dates, effectiveness results, re-issued CARs,
  document requests and the monthly trend) and the weekly/monthly activity log
  report, for any week, month, quarter or year. Print or save as PDF, or export
  a real Excel workbook generated in the browser.
- **Settings** — saved changes take effect straight away and each one is logged:
  CAR number format (with a live preview), sequence restarts, reply period,
  reminder timing, verification and effectiveness timing, the next internal
  audit, DRCN review-time limits, watermark templates, upload rules, the password
  policy and branding. Document categories and CAR sources are master lists a
  QMS Admin can add to, edit and deactivate; one nothing uses can be deleted.
  Each document carries its own watermark template, or none.
- **Records** — activity logging across every module, including report exports
  and settings changes.

Search, filtering, sorting, pagination and Excel export all run for real. Mocked:
authentication (including Google sign-in, which matches a linked address instead of
opening Google), email sending (the recipients are recorded, nothing is sent), the
bytes of an uploaded file, document download, and the dynamic watermark (shown as text).

## Fixed clock

The prototype pins "today" to **31 August 2026** so the seeded due dates, overdue
CARs and review dates stay consistent. It is one constant in
`client/src/utils/format.js`.

## Running it locally

```bash
cd client
npm install
npm run dev      # http://localhost:5173
```

See [`client/README.md`](client/README.md) for how the front end is put together
and [`database/README.md`](database/README.md) for the table layout.

## Deployment

Pushing to `main` builds the client and publishes it to GitHub Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The build takes
its base path from the repository name, so renaming the repo will not break it.
