'use client'

import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const STORAGE_KEY = 'anuranjan-ems-theme'
const ThemeContext = createContext<ThemeContextValue | null>(null)

function preferredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.dataset.theme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    const initialTheme = preferredTheme()
    setThemeState(initialTheme)
    applyTheme(initialTheme)
  }, [])

  const value = useMemo<ThemeContextValue>(() => {
    function setTheme(nextTheme: Theme) {
      window.localStorage.setItem(STORAGE_KEY, nextTheme)
      setThemeState(nextTheme)
      applyTheme(nextTheme)
    }

    return {
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    }
  }, [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}

export { STORAGE_KEY as THEME_STORAGE_KEY }
