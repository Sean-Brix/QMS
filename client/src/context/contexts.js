/* ============================================================================
   contexts.js — the context objects and their hooks, kept OUT of the provider
   files on purpose.
   ----------------------------------------------------------------------------
   React Fast Refresh can only hot-swap a module that exports components and
   nothing else. When a provider file also exported its context object, editing
   it left the running Provider on the old module while consumers re-rendered
   against the new one — the context value was still there but missing whatever
   had just been added, surfacing as "x is not a function".

   Keeping the contexts here means DataContext.jsx and AuthContext.jsx export
   only components, so they reload cleanly.
   ========================================================================== */

import { createContext, useContext } from 'react'

export const DataContext = createContext(null)
export const AuthContext = createContext(null)

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
