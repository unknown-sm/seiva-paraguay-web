import { useState } from 'react'
import { X, Palette } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const PRESET_LIST = [
  { key: 'natural', label: 'Natural Fresco', swatches: ['#5B8C5A', '#D4956A', '#FAF7F2'] },
  { key: 'oscuro', label: 'Noche Oscura', swatches: ['#7CB87B', '#E8B88A', '#1A1814'] },
  { key: 'tropical', label: 'Tropical Vibrante', swatches: ['#E8784A', '#3E9B6D', '#FFFDF5'] },
]

const COLOR_KEYS = [
  { key: 'bg', label: 'Fondo' },
  { key: 'surface', label: 'Superficie' },
  { key: 'primary', label: 'Primario' },
  { key: 'accent', label: 'Acento' },
  { key: 'text', label: 'Texto' },
  { key: 'muted', label: 'Secundario' },
  { key: 'border', label: 'Borde' },
  { key: 'navBg', label: 'Nav' },
] as const

export function ThemeToggle() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex fixed bottom-6 right-6 z-[90] w-12 h-12 rounded-full items-center justify-center shadow-lg transition-all duration-300 hover:scale-110"
        style={{
          backgroundColor: 'var(--theme-accent, #D4A843)',
          color: '#1B4332',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}
        aria-label="Cambiar paleta de colores"
        title="Cambiar paleta de colores"
      >
        <Palette className="w-5 h-5" />
      </button>
      <ThemePanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function ThemePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { colors, applyPreset, updateColor, reset, activePreset } = useTheme()

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-300"
        style={{
          backgroundColor: 'rgba(0,0,0,0.4)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-[201] flex flex-col gap-6 overflow-y-auto transition-transform duration-300"
        style={{
          width: '100%',
          maxWidth: 360,
          backgroundColor: 'var(--theme-surface, #FFFFFF)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          padding: 24,
          boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-body font-bold text-lg" style={{ color: 'var(--theme-text, #3D2817)' }}>
            Paleta de Colores
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
            style={{
              border: '1px solid var(--theme-border, #E8E0D5)',
              color: 'var(--theme-text, #3D2817)',
              background: 'none',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Presets */}
        <div className="flex flex-col gap-2">
          {PRESET_LIST.map(preset => (
            <button
              key={preset.key}
              onClick={() => applyPreset(preset.key)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-left"
              style={{
                border: `1.5px solid ${activePreset === preset.key ? 'var(--theme-primary, #1B4332)' : 'var(--theme-border, #E8E0D5)'}`,
                backgroundColor: activePreset === preset.key ? 'rgba(27,67,50,0.05)' : 'transparent',
              }}
            >
              <div className="flex gap-0.5">
                {preset.swatches.map((c, i) => (
                  <span key={i} className="w-4 h-4 rounded-sm block" style={{ backgroundColor: c }} />
                ))}
              </div>
              <span className="font-body text-sm font-medium" style={{ color: 'var(--theme-text, #3D2817)' }}>
                {preset.label}
              </span>
            </button>
          ))}
        </div>

        {/* Custom colors */}
        <div>
          <h4 className="font-body font-semibold text-sm mb-3" style={{ color: 'var(--theme-muted, #5C4033)' }}>
            Personalizar Colores
          </h4>
          <div className="flex flex-col gap-2">
            {COLOR_KEYS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <label className="font-body text-xs font-medium flex-1" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                  {label}
                </label>
                <input
                  type="color"
                  value={colors[key as keyof typeof colors]}
                  onChange={(e) => updateColor(key as any, e.target.value)}
                  className="w-8 h-8 rounded-md cursor-pointer border-0 p-0"
                  style={{
                    background: 'none',
                    border: `1.5px solid var(--theme-border, #E8E0D5)`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Reset */}
        <button
          onClick={reset}
          className="font-body font-semibold text-sm px-4 py-2 rounded-full transition-all duration-300 hover:scale-105"
          style={{
            border: '1px solid var(--theme-border, #E8E0D5)',
            color: 'var(--theme-muted, #5C4033)',
            backgroundColor: 'transparent',
          }}
        >
          Restaurar default
        </button>
      </div>
    </>
  )
}
