import { getProductBadges, type Product } from '../services/api'

// Verde identidad (mismo tono que las sombras de las tarjetas); negro
// reservado exclusivamente para AGOTADO.
const COLOR_OFERTA = '#2D6A4F'
const COLOR_AGOTADO = '#111827'

/**
 * Badges de una tarjeta de producto, en su propio contenedor (flex-wrap).
 * Prioridad absoluta: si el producto está agotado se muestra ÚNICAMENTE
 * el badge AGOTADO (negro); cualquier otro badge (oferta, popular, etc.)
 * queda oculto hasta que haya stock.
 *
 * discountText: texto custom para el badge de descuento (por defecto "X% OFF";
 * p.ej. la home pasa "OFERTA").
 * onDark: variante para secciones de fondo oscuro — el badge de descuento
 * va en blanco con texto verde y el AGOTADO lleva un anillo sutil para
 * definirse sobre el fondo.
 * className: clases extra del contenedor (ej. padding si la imagen es full-bleed).
 */
export default function ProductBadges({ product, discountText, onDark, className }: { product: Product; discountText?: string; onDark?: boolean; className?: string }) {
  const agotado = !product.stock || product.stock <= 0

  const badges: { label: string; color: string; textColor?: string; ring?: boolean }[] = []
  if (agotado) {
    badges.push(
      onDark
        ? { label: 'AGOTADO', color: COLOR_AGOTADO, textColor: '#FFFFFF', ring: true }
        : { label: 'AGOTADO', color: COLOR_AGOTADO, textColor: '#FFFFFF' }
    )
  } else {
    if (product.precio_anterior && product.precio_anterior > product.precio) {
      const pct = Math.round((1 - product.precio / product.precio_anterior) * 100)
      badges.push(
        onDark
          ? { label: discountText ?? `${pct}% OFF`, color: '#FFFFFF', textColor: COLOR_OFERTA }
          : { label: discountText ?? `${pct}% OFF`, color: COLOR_OFERTA, textColor: '#FFFFFF' }
      )
    }
    badges.push(...getProductBadges(product))
  }

  if (badges.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1.5 mb-2${className ? ' ' + className : ''}`}>
      {badges.map(b => (
        <span
          key={b.label}
          className="font-body font-semibold text-[10px] px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: b.color,
            color: b.textColor ?? '#FFFFFF',
            letterSpacing: '0.03em',
            ...(b.ring ? { boxShadow: '0 0 0 1px rgba(255,255,255,0.25)' } : {}),
          }}
        >
          {b.label}
        </span>
      ))}
    </div>
  )
}
