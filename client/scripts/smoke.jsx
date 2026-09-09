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
globalThis.matchMedia =
  dom.window.matchMedia ||
  (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
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

/* Sign in as the QMS user so permission-gated routes render their real screen. */
dom.window.sessionStorage.setItem(SESSION_KEY, 'USR-001')

const ROUTES = [
  '/login',
  '/dashboard',
  '/documents',
  '/documents/DOC-0001', // PDF file card
  '/documents/DOC-0005', // DOCX file card
  '/documents/DOC-0006', // XLSX file card
  '/cars',
  '/cars/new',
  '/cars/CAR-0001',   // a real seeded id — 'CAR-001' silently rendered the not-found state
  '/cars/CAR-0004',   // supporting files with PDF and XLSX icons
  '/cars/CAR-0008',   // returned for revision: exercises the revision callout
  '/notifications',
  '/activity-logs',
  '/reports',
  '/users',
  '/settings',
  'SIGNED_OUT:/login',
]

const problems = []
const realError = console.error
console.error = (...args) => {
  problems.push(String(args[0]))
  realError(...args)
}

for (const route of ROUTES) {
  /* The last entry checks the signed-out login screen, which is otherwise
     redirected away from because the smoke run holds a session. */
  if (route === 'SIGNED_OUT:/login') dom.window.sessionStorage.removeItem(SESSION_KEY)
  const target = route.replace('SIGNED_OUT:', '')

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
    console.log(
      `${problems.length === before && rendered ? 'PASS' : 'FAIL'}  ${route.padEnd(22)} ${text.slice(0, 70).replace(/\s+/g, ' ')}`,
    )
    root.unmount()
  } catch (error) {
    problems.push(`${route}: ${error.message}`)
    console.log(`THROW ${route}: ${error.message}`)
  }

  host.remove()
}

console.error = realError
console.log(`\n${problems.length} console error(s)`)
if (problems.length) {
  for (const problem of [...new Set(problems)].slice(0, 15)) console.log(' -', problem.slice(0, 300))
  process.exit(1)
}
