"use client"

import * as React from "react"

type ThemeProviderState = {
  mode: string
  setMode: (mode: string) => void
  borderRadius: number
  setBorderRadius: (radius: number) => void
}

const initialState: ThemeProviderState = {
  mode: "dark",
  setMode: () => null,
  borderRadius: 0.8,
  setBorderRadius: () => null,
}

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultMode = "dark",
  storageKeyMode = "majorstockx-mode",
  storageKeyRadius = "majorstockx-border-radius",
  ...props
}: {
  children: React.ReactNode
  defaultMode?: string
  storageKeyMode?: string
  storageKeyRadius?: string
}) {
  const [mode, setMode] = React.useState(
    () => (typeof window !== 'undefined' && localStorage.getItem(storageKeyMode)) || defaultMode
  )
  
  const [borderRadius, setBorderRadiusState] = React.useState(() => {
    if (typeof window === 'undefined') return 0.8;
    const storedRadius = localStorage.getItem(storageKeyRadius);
    return storedRadius ? parseFloat(storedRadius) : 0.8;
  });


  React.useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    const systemMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    const effectiveMode = mode === "system" ? systemMode : mode;

    root.classList.add(effectiveMode)
    
  }, [mode])
  
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.style.setProperty('--radius', `${borderRadius}rem`);
    }
  }, [borderRadius])


  const value = {
    mode,
    setMode: (newMode: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKeyMode, newMode)
      }
      setMode(newMode)
    },
    borderRadius,
    setBorderRadius: (radius: number) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKeyRadius, radius.toString())
      }
      setBorderRadiusState(radius)
    }
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
