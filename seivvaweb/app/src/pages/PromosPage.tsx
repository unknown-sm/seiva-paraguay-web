import { useEffect, useState } from 'react'
import { Sparkles, Gift, ShoppingCart, Percent, Tags } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchProducts, formatPrice, type Product } from '../services/api'

interface Promo {
  id: number
  tipo: string
  nombre: string
  producto_id: number | null
  marca_id: number | null
  compra_min_cantidad: number
  compra_min_monto: number
  regala_cantidad: number
  regala_producto_id: number | null
  descuento_valor: number
  descuento_tipo: string
  cupon_codigo: string | null
  creado: string
}

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://85.239.246.177:3001/api'
  : '/api'

const tipoIcons: Record<string, any> = {
  bogo: Tags,
  regalo: Gift,
  descuento_carrito: Percent,
  cupon: Percent,
}

const tipoLabels: Record<string, string> = {
  bogo: 'Llevá más, pagá menos',
  regalo: 'Regalo gratis',
  descuento_carrito: 'Descuento en carrito',
  cupon: 'Cupón',
}

function formatCondition(p: Promo, products: Product[]): string {
  const parts: string[] = []
  if (p.producto_id) {
    const prod = products.find(x => x.id === p.producto_id)
    parts.push(prod ? `En ${prod.nombre}` : `En producto #${p.producto_id}`)
  }
  if (p.compra_min_cantidad > 1) parts.push(`Comprando +${p.compra_min_cantidad} unid.`)
  if (p.compra_min_monto > 0) parts.push(`Compras +${formatPrice(p.compra_min_monto)}`)
  return parts.join(' · ') || 'Sin mínimo'
}

function formatBenefit(p: Promo, products: Product[]): string {
  if (p.tipo === 'bogo') return `Llevá ${p.regala_cantidad || 3}, pagá ${(p.regala_cantidad || 3) - 1}`
  if (p.tipo === 'regalo') {
    const prod = p.regala_producto_id ? products.find(x => x.id === p.regala_producto_id) : null
    return `+ ${prod?.nombre || 'Producto'} gratis`
  }
  if (p.tipo === 'cupon') {
    const val = p.descuento_tipo === 'porcentaje' ? `${p.descuento_valor}%` : formatPrice(p.descuento_valor)
    return `Código: ${p.cupon_codigo} (${val} off)`
  }
  const val = p.descuento_tipo === 'porcentaje' ? `${p.descuento_valor}%` : formatPrice(p.descuento_valor)
  return `${val} de descuento`
}

export default function PromosPage() {
  const [promos, setPromos] = useState<Promo[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/promos`).then(r => r.json()),
      fetchProducts()
    ]).then(([promoData, productData]) => {
      // Orden: más nuevos primero
      const sorted = (promoData as Promo[]).sort((a, b) =>
        new Date(b.creado).getTime() - new Date(a.creado).getTime()
      )
      setPromos(sorted)
      setProducts(productData)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [])

  return (
    <main className="pt-24 pb-20" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)', minHeight: '100vh' }}>
      <div className="container-main">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 font-body font-semibold text-xs tracking-[0.1em] px-4 py-2 rounded-full mb-6"
            style={{ backgroundColor: 'var(--theme-primary, #1B4332)', color: 'var(--theme-text-on-primary, #FFFFFF)' }}>
            <Sparkles className="w-4 h-4" />
            PROMOCIONES ACTIVAS
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl mb-4" style={{ color: 'var(--theme-text, #3D2817)' }}>
            Promos y Ofertas
          </h1>
          <p className="font-body text-lg max-w-lg mx-auto" style={{ color: 'var(--theme-muted, #5C4033)' }}>
            Aprovechá descuentos, regalos y ofertas especiales.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="rounded-2xl h-48 animate-pulse" style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }} />
            ))}
          </div>
        ) : promos.length === 0 ? (
          <div className="text-center py-20">
            <Sparkles className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--theme-muted, #CCC)' }} />
            <h2 className="font-display font-bold text-2xl mb-2" style={{ color: 'var(--theme-text, #3D2817)' }}>
              No hay promos activas
            </h2>
            <p className="font-body text-lg" style={{ color: 'var(--theme-muted, #5C4033)' }}>
              Volvé pronto. Estamos preparando nuevas ofertas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {promos.map(promo => {
              const Icon = tipoIcons[promo.tipo] || Gift
              return (
                <div
                  key={promo.id}
                  className="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5"
                  style={{
                    backgroundColor: 'var(--theme-surface, #FFFFFF)',
                    boxShadow: '0 4px 20px rgba(27,67,50,0.10), 0 0 0 1px var(--theme-border, rgba(27,67,50,0.06))',
                  }}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'var(--theme-primary-bg-05, rgba(27,67,50,0.08))' }}
                    >
                      <Icon className="w-6 h-6" style={{ color: 'var(--theme-primary, #1B4332)' }} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-lg leading-tight" style={{ color: 'var(--theme-text, #3D2817)' }}>
                        {promo.nombre}
                      </h3>
                      <span
                        className="inline-block font-body font-semibold text-[10px] px-2 py-0.5 rounded-full mt-1.5"
                        style={{ backgroundColor: 'var(--theme-primary, #1B4332)', color: 'var(--theme-text-on-primary, #FFFFFF)' }}
                      >
                        {tipoLabels[promo.tipo] || promo.tipo}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-5">
                    <div className="flex items-start gap-2">
                      <span className="font-body font-semibold text-xs shrink-0 mt-0.5" style={{ color: 'var(--theme-muted, #999)' }}>
                        Condición:
                      </span>
                      <span className="font-body text-sm" style={{ color: 'var(--theme-text, #3D2817)' }}>
                        {formatCondition(promo, products)}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-body font-semibold text-xs shrink-0 mt-0.5" style={{ color: 'var(--theme-muted, #999)' }}>
                        Beneficio:
                      </span>
                      <span className="font-body text-sm font-semibold" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                        {formatBenefit(promo, products)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (promo.producto_id) {
                        const prod = products.find(p => p.id === promo.producto_id)
                        if (prod) navigate(`/producto/${prod.slug || prod.id}`)
                        else navigate('/tienda')
                      } else {
                        navigate('/tienda')
                      }
                    }}
                    className="w-full font-body font-semibold text-sm py-3 rounded-full transition-all duration-300 hover:scale-105 inline-flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: 'var(--theme-primary, #1B4332)',
                      color: 'var(--theme-text-on-primary, #FFFFFF)',
                    }}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {promo.producto_id ? 'Ver producto' : 'Ir a la tienda'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
