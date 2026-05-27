# Seiva Paraguay — Design System

## Visual thesis
"Frescura natural paraguaya" — un mercado natural pero elevado: cálido como las almendras tostadas, fresco como los frutos secos recién empacados. Appetitoso, no clínico. Natural, no rústico.

## Typography
- **Titles:** DM Serif Display (Google Fonts) — serif orgánica
- **Body:** Plus Jakarta Sans (Google Fonts) — limpia, moderna, excelente español
- **Accent:** Caveat (Google Fonts) — script manual para badges

Base size: 16px | Scale: 1.25 (major third)

## Color Palettes

### 1. Natural Fresco (default)
| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#FAF7F2` | Page background |
| `--surface` | `#FFFFFF` | Cards, panels |
| `--primary` | `#5B8C5A` | Buttons, links, active states |
| `--accent` | `#D4956A` | Price, badges, hover effects |
| `--text` | `#2C2416` | Body text |
| `--muted` | `#8B7E6A` | Secondary text, captions |
| `--border` | `#E8E0D5` | Borders, dividers |
| `--nav-bg` | `#FFFFFF` | Bottom nav background |
| `--shadow` | `rgba(44, 36, 22, 0.08)` | Card shadows |

### 2. Noche Oscura
| Token | Value |
|-------|-------|
| `--bg` | `#1A1814` |
| `--surface` | `#2A2620` |
| `--primary` | `#7CB87B` |
| `--accent` | `#E8B88A` |
| `--text` | `#EDE4D3` |
| `--muted` | `#A09888` |
| `--border` | `#3A3630` |
| `--nav-bg` | `#2A2620` |
| `--shadow` | `rgba(0, 0, 0, 0.3)` |

### 3. Tropical Vibrante
| Token | Value |
|-------|-------|
| `--bg` | `#FFFDF5` |
| `--surface` | `#FFFFFF` |
| `--primary` | `#E8784A` |
| `--accent` | `#3E9B6D` |
| `--text` | `#1F1A0E` |
| `--muted` | `#7A7360` |
| `--border` | `#F0E8D8` |
| `--nav-bg` | `#FFFFFF` |
| `--shadow` | `rgba(31, 26, 14, 0.08)` |

## Spacing
4px base grid: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96

## Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## Components
- Product cards: image-dominant, rounded 12px, subtle shadow, hover lift
- Buttons: pill shape (border-radius: 100px), solid primary or outlined
- Bottom nav: fixed, 4 tabs + middle WhatsApp button, glass effect
- Theme switcher: floating gear icon, slide-in panel from right

## Animations
- Scroll reveal: fade-up with 0.4s ease-out
- Card hover: translateY(-4px) + shadow increase
- Theme transition: 0.3s on all color properties
- Page transitions: opacity fade
- FAQ accordion: max-height transition
