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
| QMS Department | `msantos` | `qms123` | Everything: all CARs, the repository, logs, reports, users, settings |
| QMS Department | `jcruz` | `user123` | Same, as a second reviewer |
| Department | `rdelacruz` | `user123` | Production — only CARs raised by or routed to their department |
| Department | `avillanueva` | `user123` | Quality Control |
| Department | `jaquino` | `user123` | Deactivated, to demonstrate the blocked-login path |

Credentials are plaintext on purpose: there is no server to authenticate
against. Hashing and real authentication belong to the implementation phase.

## What works

- **The CAR lifecycle** — issue with automatic numbering, route to a department,
  respond with root cause and action plan, QMS review, return for revision,
  verification of closure, effectiveness validation, closure. Separation of
  duties is enforced: nobody reviews their own work.
- **The document repository** — categories, revisions with history, review
  dates, statuses, upload and revise.
- **Monitoring** — automatic overdue flagging, due-soon and overdue reminders,
  in-app notifications, a dashboard queue of what is waiting on the QMS
  Department.
- **Records** — activity logging across every module, and weekly/monthly reports.

Search, filtering, sorting and pagination all run for real. Mocked: authentication,
the bytes of an uploaded file, file download, and the dynamic watermark (shown as
text).

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
