/* ============================================================================
   smoke.jsx — mounts the app at every route in jsdom and fails on any React
   error or console error. Run with:  node --experimental-strip-types … no —
   it is executed through Vite so the `@` alias and JSX resolve exactly as they
   do in the browser:  npx vite-node scripts/smoke.jsx
   ========================================================================== */

import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})

/* Copy every DOM constructor and global jsdom defines onto globalThis, so
   React Aria's `instanceof HTMLButtonElement` / `SVGElement` checks work. */
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (key in globalThis) continue
  try {
    globalThis[key] = dom.window[key]
  } catch {
    /* read-only globals (navigator, location) are handled below */
  }
}

globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0)
globalThis.cancelAnimationFrame = clearTimeout
/* jsdom has no layout, so `matchMedia` is answered from a pretend viewport
   width. The responsive table reads `(min-width: …px)` queries to pick its
   columns and its phone layout; anything else (colour scheme, hover) is false. */
let viewportWidth = 1440
globalThis.matchMedia = (query) => {
  const minWidth = /\(min-width:\s*(\d+)px\)/.exec(query)
  return {
    matches: minWidth ? viewportWidth >= Number(minWidth[1]) : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }
}
dom.window.matchMedia = globalThis.matchMedia
dom.window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = dom.window.ResizeObserver
globalThis.IntersectionObserver = dom.window.ResizeObserver
dom.window.scrollTo = () => {}

const { StrictMode, createElement } = await import('react')
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
const { RouteProvider } = await import('../src/providers/route-provider.jsx')
const { ThemeProvider } = await import('../src/providers/theme-provider.jsx')
const App = (await import('../src/App.jsx')).default
const { SESSION_KEY } = await import('../src/config/appConfig.js')

/* Each entry is "<session> <route> [@key=value ...] [expected text]", where "!text" means the text
   must not appear. The session is an account id, or SIGNED_OUT. Covering every role catches screens that only break for a
   department account or for Dev. An "@key=value" token seeds localStorage before the render — how a
   remembered preference such as the repository layout is exercised. Storage is cleared between entries.
   "@viewport=390" sets the pretend viewport width instead (default 1440), which is how the phone and
   tablet layouts of the tables are rendered. */
const ROUTES = [
  // QMS Admin
  'USR-001 /dashboard',
  'USR-001 /dashboard CAR monitoring',
  'USR-001 /dashboard Requests awaiting review',
  'USR-001 /dashboard Waiting on QMS',
  'USR-001 /reports Management Review',
  'USR-001 /reports CARs by source',
  'USR-001 /reports Export Excel',
  'USR-001 /reports CCR-26-002', // re-issued in August, the default monthly period
  'USR-001 /notifications Emailed to',
  'USR-001 /notifications HRD-POL-006 is past its review date', // raised by the due-date sweep
  'USR-001 /documents',
  'USR-001 /documents Revision requested', // open request chip in the list
  'USR-001 /documents uploaded by', // the table row carries the uploader
  'USR-001 /documents @qms.documents.layout=grid !uploaded by', // grid tiles carry code, title and status only
  'USR-001 /documents @qms.documents.layout=grid Revision requested',
  'USR-001 /documents @qms.documents.layout=cards Customer-issued engineering drawings', // cards carry the description
  'USR-001 /documents @qms.documents.layout=cards uploaded by',
  'USR-003 /documents @qms.documents.layout=cards !PUR-OP-002', // visibility rules hold in every layout
  // Phone (stacked rows) and tablet (fewer columns) table layouts
  'USR-001 /documents @viewport=390 Sort by',
  'USR-001 /documents @viewport=390 Effective', // heading folded in as a label
  'USR-001 /documents @viewport=390 Revision requested',
  'USR-003 /documents @viewport=390 !PUR-OP-002',
  'USR-001 /documents @viewport=1024 !Category', // shed on a laptop; the tabs carry it
  'USR-001 /documents @viewport=1600 Category',
  'USR-001 /cars @viewport=390 Next deadline',
  'USR-001 /cars?flag=Overdue @viewport=390 IQA-26-002',
  'USR-001 /requests @viewport=390 DRCN-26-004',
  'USR-001 /users @viewport=390 Logistics',
  'USR-001 /personnel @viewport=390 Victor Ramos',
  'USR-001 /activity-logs @viewport=390 Related record', // the action itself is the lead line, unlabelled
  'USR-001 /reports @viewport=390 Management Review',
  'USR-001 /dashboard @viewport=390 CAR monitoring',
  'USR-003 /dashboard @viewport=390 Awaiting your reply',
  'USR-010 /system @viewport=390 Activity per day',
  'USR-001 /documents/DOC-0001 Views411Downloads', // PDF file card; the visit is counted once under StrictMode
  'USR-001 /documents/DOC-0001 Restore this revision',
  'USR-001 /documents/DOC-0013 PUR-OP-002', // obsolete, still open to a QMS Admin
  'USR-001 /requests/new?type=Revise&document=DOC-0001&restore=REV-002 Restoring revision 4',
  'USR-001 /documents/DOC-0005', // DOCX file card
  'USR-001 /documents/DOC-0006', // XLSX file card
  'USR-001 /cars',
  'USR-001 /cars/new',
  'USR-001 /cars/CAR-0001 Anna Villanueva', // responsible person resolved from personnel
  'USR-001 /cars/CAR-0004', // supporting files with PDF and XLSX icons
  'USR-001 /cars/CAR-0008', // returned for revision: exercises the revision callout
  'USR-001 /cars/CAR-0007 Accept action plan', // under review, raised by another department
  'USR-002 /cars/CAR-0004 Verify countermeasure', // verification is overdue; the initiator may not verify
  'USR-002 /cars/CAR-0001 Record effectiveness check', // closed out, effectiveness check due
  'USR-002 /cars/CAR-0016 Record monitoring check', // closed under extended monitoring
  'USR-001 /cars/CAR-0016 Re-issued as CCR-26-002',
  'USR-001 /cars/CAR-0009 Re-issue of CCR-25-001',
  'USR-001 /cars/CAR-0010 Re-issue CAR', // no reply past the due date
  'USR-001 /cars/new?reissue=CAR-0010&reason=No%20reply Re-issuing IQA-26-002',
  'USR-001 /cars/new !Reason for re-issue', // a fresh CAR has no re-issue fields
  'USR-001 /cars?flag=Overdue IQA-26-002',
  'USR-001 /cars?flag=Overdue !CCR-26-001', // closed and effective, so not overdue
  'USR-001 /cars/CAR-0012 Joseph Cruz', // routed to the QMS Department itself
  'USR-001 /documents/DOC-0006 DRCN-26-004', // open request blocks further change requests
  'USR-001 /requests DRCN-26-004',
  'USR-001 /requests/new Review time limit',
  'USR-001 /requests/new?type=Revise&document=DOC-0001 Document to revise',
  'USR-001 /requests/REQ-001 Approve and publish', // raised by another QMS Admin
  'USR-002 /requests/REQ-001 Another QMS Admin', // raised by this QMS Admin
  'USR-001 /requests/REQ-002 Start review',
  'USR-001 /requests/REQ-003 Marked obsolete and archived',
  'USR-001 /requests/REQ-004 Past the maximum review time',
  'USR-001 /notifications',
  'USR-001 /personnel Victor Ramos',
  'USR-001 /account',
  'USR-001 /activity-logs',
  'USR-001 /reports',
  'USR-001 /users Logistics',
  'USR-001 /settings Save changes',
  'USR-001 /documents/DOC-0001 Controlled copy with document and revision', // its own watermark template
  'USR-003 /documents/DOC-0001 (person downloading)', // a shared account names who downloads
  'USR-001 /system You do not have access',
  // Department (shared account)
  'USR-003 /dashboard Production',
  'USR-003 /dashboard Awaiting your reply',
  'USR-003 /dashboard !Waiting on QMS', // the QMS queue is not a department's
  'USR-003 /notifications Emailed to',
  'USR-003 /cars',
  'USR-003 /cars/new Issued by',
  'USR-003 /cars/CAR-0015 Submit response',
  'USR-003 /cars/CAR-0015 !Re-issue CAR', // re-issuing is a QMS decision
  'USR-003 /cars/CAR-0006 Record implementation', // plan accepted; Production carries it out
  'USR-003 /documents !PUR-OP-002', // obsolete documents are hidden from departments
  'USR-003 /documents/DOC-0013 Document not found',
  'USR-003 /documents/DOC-0001 !QMS-QM-001_rev4.pdf', // earlier revisions are hidden too
  'USR-003 /personnel Carlo Mendoza',
  'USR-003 /account Who uses this account',
  'USR-003 /requests F-PRD-004',
  'USR-003 /requests/REQ-004 Request not found', // another department's request
  'USR-003 /requests/new Reason for review',
  'USR-005 /requests/REQ-005 Edit and resubmit',
  'USR-005 /requests/REQ-005/edit Resubmit request',
  'USR-003 /users You do not have access',
  // Dev
  'USR-010 /system Activity per day',
  'USR-010 /users',
  'USR-010 /requests/REQ-002',
  'USR-010 /documents/DOC-0001 !Restore this revision', // Dev sees history but does not approve changes
  // Signed out
  'SIGNED_OUT /login Sign in with Google',
]

const problems = []
const realError = console.error
console.error = (...args) => {
  problems.push(String(args[0]))
  realError(...args)
}

for (const entry of ROUTES) {
  const [session, target, ...rest] = entry.split(' ')
  const presets = rest.filter((token) => token.startsWith('@'))
  const expectText = rest.filter((token) => !token.startsWith('@')).join(' ')

  if (session === 'SIGNED_OUT') dom.window.sessionStorage.removeItem(SESSION_KEY)
  else dom.window.sessionStorage.setItem(SESSION_KEY, session)

  dom.window.localStorage.clear()
  viewportWidth = 1440
  for (const preset of presets) {
    const [key, value] = preset.slice(1).split('=')
    if (key === 'viewport') viewportWidth = Number(value)
    else dom.window.localStorage.setItem(key, value)
  }

  const host = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(host)

  const before = problems.length
  try {
    const root = createRoot(host)
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(
          ThemeProvider,
          null,
          createElement(
            MemoryRouter,
            { initialEntries: [target] },
            createElement(RouteProvider, null, createElement(App, null)),
          ),
        ),
      ),
    )
    await new Promise((resolve) => setTimeout(resolve, 250))

    const text = host.textContent || ''
    const rendered = text.trim().length > 0
    /* "!text" expects the text to be absent — how the visibility rules are checked. */
    const absent = expectText.startsWith('!')
    const needle = absent ? expectText.slice(1) : expectText
    const found = !expectText || text.includes(needle) !== absent
    if (!found) problems.push(`${entry}: ${absent ? 'text should not have rendered' : 'expected text not rendered'}`)
    console.log(
      `${problems.length === before && rendered ? 'PASS' : 'FAIL'}  ${`${session} ${target}`.padEnd(34)} ${
        expectText ? `[${found ? 'ok' : 'FAILED'}: ${expectText}] ` : ''
      }${text.slice(0, 50).replace(/\s+/g, ' ')}`,
    )
    root.unmount()
  } catch (error) {
    problems.push(`${entry}: ${error.message}`)
    console.log(`THROW ${entry}: ${error.message}`)
  }

  host.remove()
}

console.error = realError
console.log(`\n${problems.length} problem(s)`)
if (problems.length) {
  for (const problem of [...new Set(problems)].slice(0, 15)) console.log(' -', problem.slice(0, 300))
  process.exit(1)
}
