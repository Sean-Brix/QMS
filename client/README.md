# QMS Portal — client

React + Vite front end for the QMS Online Repository and Corrective Action Report
Management System. **UI/UX phase only** — there is no backend; data comes from the JSON
tables in [`../database`](../database/README.md).

The interface is built on [Untitled UI React](https://www.untitledui.com/react) —
Tailwind CSS v4 plus React Aria Components — so accessibility (focus management, keyboard
navigation, ARIA semantics) comes from the library rather than from hand-written markup.

## Run

```bash
cd client
npm install
npm run dev      # http://localhost:5173
npm run build
npm run lint
npm run smoke    # mounts every route in jsdom and fails on any console error
```

## Where things live

```
src/
├── styles/
│   ├── globals.css      ← the single style entry: Tailwind, the token set, the
│   │                       type scale, then the few QMS rules (print, reduced
│   │                       motion) that utilities cannot express.
│   ├── theme.css        ← EDIT THIS to change the look. The Untitled UI token
│   │                       set: colour ramps, semantic roles, radii, shadows and
│   │                       the full dark palette under `.dark-mode`.
│   └── typography.css      the type scale.
│
├── config/              ← centralized, non-visual configuration
│   ├── constants.js        every enumerated value from the PRD: roles,
│   │                       permissions, statuses, CAR sources, NC types,
│   │                       workflow stages, log actions, report sections
│   ├── navigation.js       routes, sidebar sections, per-role visibility
│   └── appConfig.js        branding + business rules read from settings.json
│
├── data/db.js           ← the ONLY module that imports the JSON database
├── context/                AuthContext (session + permissions), DataContext (store)
├── providers/              RouteProvider (React Aria links → React Router),
│                           ThemeProvider (light / dark / system)
├── utils/                  format.js (dates, labels), filters.js (search/sort/
│                           paginate), status.js (status → colour), cx.ts
├── components/
│   ├── base/            ← Untitled UI primitives (buttons, inputs, badges, …)
│   ├── application/     ← Untitled UI patterns (table, tabs, modal, pagination,
│   │                      date picker, file upload, charts, navigation)
│   ├── foundations/     ← Untitled UI icons, featured icons, logos
│   ├── ui/              ← THE QMS LAYER. Re-exports the library from one place
│   │                      and adds the composites this product repeats:
│   │                      StatusBadge, MetricCard, Card, Section, KeyValue,
│   │                      Callout, FilterBar, DataTable, AppDialog, ChoiceRow,
│   │                      ActivityFeed, the two chart forms and the icon registry
│   └── layout/             AppLayout, Sidebar, Page + PageHeader
└── pages/
    ├── Login.jsx
    ├── Dashboard.jsx            PRD 18
    ├── documents/               PRD 8
    ├── cars/                    PRD 10–16
    ├── Notifications.jsx        PRD 20
    ├── ActivityLogs.jsx         PRD 19
    ├── Reports.jsx              PRD 21
    ├── UserManagement.jsx       PRD 7
    └── Settings.jsx
```

`components/base`, `components/application` and `components/foundations` are vendored
Untitled UI source (TypeScript). Vite compiles `.tsx` alongside the app's `.jsx`, so the
two coexist without a build step of their own. Update them with
`npx untitledui@latest add <component>`; leave them otherwise unedited so that stays
possible.

Where a vendored component needs a correction, the fix goes in `components/ui` rather
than in the vendored file:

- `native-select.jsx` reserves room for the chevron the vendored select draws as an
  overlay over its own right edge, and lets the control shrink inside a grid column
  instead of forcing it to the width of its longest option.
- `data-table.jsx` matches the header padding to the cell padding at `sm`, and fades the
  edge of a table that scrolls sideways — a nine-column register is wider than a 1440px
  laptop, and Windows shows no scrollbar until you touch it.

## Changing the look

- **Hue** — rewrite the `--color-brand-*` ramp in `styles/theme.css`. Everything else
  resolves through it, in light and dark mode alike.
- **Semantic roles** — `--color-bg-*`, `--color-text-*`, `--color-border-*` map the ramps
  onto meaning. Components only ever reference these, through Tailwind utilities such as
  `bg-primary`, `text-tertiary`, `ring-secondary`.
- **Status colours** — one entry per status in `utils/status.js`. Adding a status is a
  one-line change; no component needs to know about it.
- **Dark mode** — the palette already exists; `ThemeProvider` toggles `.dark-mode` on
  `<html>` and the header carries the switch.

No page contains a literal colour.

## Screens compose from `components/ui`

A screen imports from `@/components/ui` and nothing deeper (icons excepted, which come
straight from `@untitledui/icons`). That keeps the library swappable and means a change
to a shared pattern — the filter band, the table, the metric tile — lands in one file.

The two chart forms in `components/ui/charts.jsx` are deliberately single-series: colour
never carries category identity, so they stay readable for colour-blind readers and in
print. Categories are named on the axis instead.

## What is mocked

Authentication (plaintext credential match), file upload (a dropped file's name, type,
size and uploader are recorded; no bytes are stored), download (logged, no file produced)
and the dynamic watermark (previewed as text). Everything else — filtering, sorting,
pagination, the CAR state machine, activity logging, notifications and the automatic
overdue flag — runs against the in-memory store for real.

Two things a server would schedule are run at boot instead: the overdue / due-soon
reminder sweep in `DataContext` fires once when the store is seeded rather than nightly,
and it is idempotent, so a reminder already on file is never repeated.
