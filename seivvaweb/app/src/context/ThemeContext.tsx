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
    bg: '#FAF7F2',
    surface: '#FDF8F0',
    primary: '#5B8C5A',
    accent: '#D4956A',
    text: '#2C2416',
    muted: '#8B7E6A',
    border: '#E8E0D5',
    navBg: '#FDF8F0',
  },
  oscuro: {
    bg: '#1A1814',
    surface: '#2A2620',
    primary: '#7CB87B',
    accent: '#E8B88A',
    text: '#EDE4D3',
    muted: '#A09888',
    border: '#3A3630',
    navBg: '#2A2620',
  },
  tropical: {
    bg: '#FFFDF5',
    surface: '#FDF8F0',
    primary: '#E8784A',
    accent: '#3E9B6D',
    text: '#1F1A0E',
    muted: '#7A7360',
    border: '#F0E8D8',
    navBg: '#FDF8F0',
  },
}

const DEFAULT_COLORS: ThemeColors = {
  bg: '#FAF3E8',
  surface: '#FDF8F0',
  primary: '#1B4332',
  accent: '#D4A843',
  text: '#3D2817',
  muted: '#5C4033',
  border: '#E8E0D5',
  navBg: 'rgba(27, 67, 50, 0.95)',
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
