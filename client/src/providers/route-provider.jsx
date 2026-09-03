/* ============================================================================
   route-provider.jsx — bridges React Aria links to React Router.
   ----------------------------------------------------------------------------
   Untitled UI builds its links on react-aria-components, which navigate with a
   full page load unless a RouterProvider is supplied. Wrapping the app here
   means every `href` in the library — nav items, buttons, breadcrumbs — routes
   client-side, so screens can keep passing plain paths.
   ========================================================================== */

import { RouterProvider } from 'react-aria-components'
import { useNavigate } from 'react-router-dom'

export function RouteProvider({ children }) {
  const navigate = useNavigate()
  return <RouterProvider navigate={navigate}>{children}</RouterProvider>
}
