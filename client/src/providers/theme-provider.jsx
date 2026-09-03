/* ============================================================================
   theme-provider.jsx — light / dark / system, persisted per browser.
   ----------------------------------------------------------------------------
   The Untitled UI token set in styles/theme.css defines a full dark palette
   behind a `.dark-mode` class on <html>. This provider is the only thing that
   toggles that class, so no component needs to know a theme exists.
   ========================================================================== */

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'qms.theme'
const DARK_CLASS = 'dark-mode'

const ThemeContext = createContext(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}

export function ThemeProvider({ children, defaultTheme = 'light' }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || defaultTheme
    } catch {
      return defaultTheme
    }
  })

  useEffect(() => {
    const root = document.documentElement

    const apply = () => {
      if (theme === 'system') {
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.toggle(DARK_CLASS, dark)
        try {
          localStorage.removeItem(STORAGE_KEY)
        } catch {
          /* storage unavailable — the choice simply does not persist */
        }
      } else {
        root.classList.toggle(DARK_CLASS, theme === 'dark')
        try {
          localStorage.setItem(STORAGE_KEY, theme)
        } catch {
          /* storage unavailable */
        }
      }
    }

    apply()

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => theme === 'system' && apply()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
