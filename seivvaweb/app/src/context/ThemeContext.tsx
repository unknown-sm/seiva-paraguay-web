import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface ThemeColors {
  bg: string
  surface: string
  primary: string
  accent: string
  text: string
  muted: string
  border: string
  navBg: string
}

const PRESETS: Record<string, ThemeColors> = {
  natural: {
    bg: '#F2EDE6',
    surface: '#F7F2EB',
    primary: '#1B4332',
    accent: '#D4A843',
    text: '#1A1A1A',
    muted: '#6B6B6B',
    border: '#EDE4D8',
    navBg: '#1B4332',
  },
  bosque: {
    bg: '#1B4332',
    surface: '#2A3D2F',
    primary: '#52B788',
    accent: '#D4A843',
    text: '#F0EDE4',
    muted: '#A0B8A8',
    border: '#2D4A36',
    navBg: '#0F261C',
  },
  oscuro: {
    bg: '#1A1814',
    surface: '#2A2620',
    primary: '#52B788',
    accent: '#D4A843',
    text: '#EDE4D3',
    muted: '#A09888',
    border: '#3A3630',
    navBg: '#111111',
  },
  tropical: {
    bg: '#F2EDE6',
    surface: '#F7F2EB',
    primary: '#E8784A',
    accent: '#3E9B6D',
    text: '#1F1A0E',
    muted: '#7A7360',
    border: '#EDE4D8',
    navBg: '#E8784A',
  },
}

const DEFAULT_COLORS: ThemeColors = {
  bg: '#F2EDE6',
  surface: '#F7F2EB',
  primary: '#1B4332',
  accent: '#D4A843',
  text: '#1A1A1A',
  muted: '#6B6B6B',
  border: '#EDE4D8',
  navBg: '#1B4332',
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function applyColors(colors: ThemeColors) {
  const root = document.documentElement
  root.style.setProperty('--theme-bg', colors.bg)
  root.style.setProperty('--theme-surface', colors.surface)
  root.style.setProperty('--theme-primary', colors.primary)
  root.style.setProperty('--theme-accent', colors.accent)
  root.style.setProperty('--theme-text', colors.text)
  root.style.setProperty('--theme-muted', colors.muted)
  root.style.setProperty('--theme-border', colors.border)
  root.style.setProperty('--theme-nav-bg', colors.navBg)
  root.style.setProperty('--theme-shadow', hexToRgba(colors.text, 0.08))
  root.style.setProperty('--theme-shadow-sm', hexToRgba(colors.text, 0.04))
  root.style.setProperty('--theme-shadow-md', hexToRgba(colors.text, 0.06))
  root.style.setProperty('--theme-shadow-lg', hexToRgba(colors.text, 0.12))
  root.style.setProperty('--theme-primary-shadow', hexToRgba(colors.primary, 0.35))
  root.style.setProperty('--theme-primary-bg-05', hexToRgba(colors.primary, 0.05))
  root.style.setProperty('--theme-primary-bg-10', hexToRgba(colors.primary, 0.1))
  root.style.setProperty('--theme-primary-overlay', hexToRgba(colors.primary, 0.85))
  root.style.setProperty('--theme-text-on-primary', '#FFFFFF')
}

interface ThemeContextValue {
  colors: ThemeColors
  applyPreset: (name: string) => void
  updateColor: (key: keyof ThemeColors, value: string) => void
  reset: () => void
  activePreset: string | null
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colors, setColors] = useState<ThemeColors>(DEFAULT_COLORS)
  const [activePreset, setActivePreset] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('seiva-theme-colors')
    const savedPreset = localStorage.getItem('seiva-theme-preset')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setColors(parsed)
        applyColors(parsed)
      } catch { /* ignore */ }
    }
    if (savedPreset) setActivePreset(savedPreset)
  }, [])

  const save = (newColors: ThemeColors, preset: string | null) => {
    setColors(newColors)
    setActivePreset(preset)
    applyColors(newColors)
    localStorage.setItem('seiva-theme-colors', JSON.stringify(newColors))
    if (preset) localStorage.setItem('seiva-theme-preset', preset)
    else localStorage.removeItem('seiva-theme-preset')
  }

  const applyPreset = (name: string) => {
    const preset = PRESETS[name] || PRESETS.natural
    save(preset, name)
  }

  const updateColor = (key: keyof ThemeColors, value: string) => {
    const updated = { ...colors, [key]: value }
    save(updated, null)
  }

  const reset = () => {
    save(DEFAULT_COLORS, 'default')
  }

  return (
    <ThemeContext.Provider value={{ colors, applyPreset, updateColor, reset, activePreset }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
