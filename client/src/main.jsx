import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

/* globals.css is the single style entry. It pulls in Tailwind, the Untitled UI
   token set (styles/theme.css — the file to edit when changing the look) and
   the type scale, then adds the handful of QMS rules utilities cannot express. */
import './styles/globals.css'

import { RouteProvider } from '@/providers/route-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      {/* Matches Vite's base so routes resolve under a project-site subpath. */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <RouteProvider>
          <App />
        </RouteProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
