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
 */
export default function ProductBadges({ product, discountText }: { product: Product; discountText?: string }) {
  const agotado = !product.stock || product.stock <= 0

  const badges: { label: string; color: string }[] = []
  if (agotado) {
    badges.push({ label: 'AGOTADO', color: COLOR_AGOTADO })
  } else {
    if (product.precio_anterior && product.precio_anterior > product.precio) {
      const pct = Math.round((1 - product.precio / product.precio_anterior) * 100)
      badges.push({ label: discountText ?? `${pct}% OFF`, color: COLOR_OFERTA })
    }
    badges.push(...getProductBadges(product))
  }

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {badges.map(b => (
        <span
          key={b.label}
          className="font-body font-semibold text-[10px] px-2 py-0.5 rounded-full"
          style={{ backgroundColor: b.color, color: '#FFFFFF', letterSpacing: '0.03em' }}
        >
          {b.label}
        </span>
      ))}
    </div>
  )
}
