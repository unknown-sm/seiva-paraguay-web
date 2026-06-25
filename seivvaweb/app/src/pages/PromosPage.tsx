import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Sparkles } from 'lucide-react'
import { fetchProducts, formatPrice, getProductBadges, type Product } from '../services/api'
import { useCart } from '../context/CartContext'
import ProductSkeleton from '../components/ProductSkeleton'

export default function PromosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { addItem } = useCart()

  useEffect(() => {
    fetchProducts()
      .then(data => {
        const combos = data.filter(p =>
          p.categoria?.toLowerCase() === 'combos' ||
          (p.etiquetas || []).some(t => t.toLowerCase() === 'combo')
        )
        setProducts(combos)
        setLoading(false)
      })
      .catch(() => {
        setProducts([])
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
            PROMOS Y COMBOS
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl mb-4" style={{ color: 'var(--theme-text, #3D2817)' }}>
            Promociones
          </h1>
          <p className="font-body text-lg max-w-lg mx-auto" style={{ color: 'var(--theme-muted, #5C4033)' }}>
            Combos seleccionados con los mejores precios. Ahorrá comprando packs.
          </p>
        </div>

        {loading ? (
          <ProductSkeleton count={6} className="lg:grid-cols-3" />
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Sparkles className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--theme-muted, #CCC)' }} />
            <p className="font-body text-lg" style={{ color: 'var(--theme-muted, #5C4033)' }}>
              No hay promos disponibles por el momento.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {products.map(product => (
              <div
                key={product.id}
                className="group rounded-2xl p-4 sm:p-6 transition-all duration-300 hover:-translate-y-1.5 cursor-pointer flex flex-col"
                style={{
                  backgroundColor: 'var(--theme-surface, #FFFFFF)',
                  boxShadow: '0 2px 12px rgba(45, 106, 79, 0.10), 0 0 0 1px var(--theme-border, rgba(45, 106, 79, 0.08))',
                }}
                onClick={() => navigate(`/producto/${product.slug || product.id}`)}
              >
                <div
                  className="relative rounded-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)', border: '1px solid var(--theme-border, #F0EDE8)', height: '260px' }}
                >
                  <img
                    src={product.imagen}
                    alt={product.nombre}
                    className="absolute inset-0 w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span
                    className="absolute top-3 left-3 font-body font-semibold text-[10px] px-2.5 py-1 rounded-full tracking-wider z-10"
                    style={{ backgroundColor: 'var(--theme-primary, #1B4332)', color: 'var(--theme-text-on-primary, #FFFFFF)' }}
                  >
                    {product.categoria.toUpperCase()}
                  </span>
                  {product.precio_anterior && product.precio_anterior > product.precio && (
                    <span
                      className="absolute top-3 right-3 font-body font-semibold text-[10px] px-2.5 py-1 rounded-full z-10"
                      style={{ backgroundColor: '#E63946', color: '#FFFFFF' }}
                    >
                      {Math.round((1 - product.precio / product.precio_anterior) * 100)}% OFF
                    </span>
                  )}
                  {(() => {
                    const badges = getProductBadges(product)
                    if (!badges.length) return null
                    return (
                      <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 z-10">
                        {badges.map(b => (
                          <span key={b.label} className="font-body font-semibold text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: b.color, color: '#fff' }}>
                            {b.label}
                          </span>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                <h3 className="font-display font-semibold text-lg mt-4 leading-snug" style={{ color: 'var(--theme-text, #1A1A1A)' }}>
                  {product.nombre}
                </h3>
                <div className="flex items-baseline gap-x-2 mt-2">
                  <span className="font-body font-bold text-2xl" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                    {formatPrice(product.precio)}
                  </span>
                  {product.precio_anterior && product.precio_anterior > product.precio && (
                    <span className="font-body text-sm line-through" style={{ color: 'var(--theme-muted, #999)' }}>
                      {formatPrice(product.precio_anterior)}
                    </span>
                  )}
                </div>

                <div className="mt-auto pt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      addItem(product, 1)
                    }}
                    className="font-body font-semibold text-sm px-6 py-3 rounded-full transition-all duration-300 hover:scale-105 inline-flex items-center justify-center gap-2 w-full"
                    style={{
                      backgroundColor: 'var(--theme-primary, #1B4332)',
                      color: 'var(--theme-text-on-primary, #FFFFFF)',
                      boxShadow: '0 4px 16px rgba(27,67,50,0.3)',
                    }}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Agregar al carrito
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
