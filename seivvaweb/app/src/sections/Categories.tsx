import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { fetchProducts, formatPrice, stripHtml, getProductBadges, getTierLabel, type Product } from '../services/api'

gsap.registerPlugin(ScrollTrigger)
import { useCart } from '../context/CartContext'
import ProductSkeleton from '../components/ProductSkeleton'

export default function Categories() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { addItem } = useCart()

  useEffect(() => {
    fetchProducts()
      .then(data => {
        setProducts(data.slice(0, 9))
        setLoading(false)
      })
      .catch(() => {
        setProducts([])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (loading || products.length === 0) return

    setTimeout(() => {
      const ctx = gsap.context(() => {
        if (headerRef.current) {
          const els = headerRef.current.querySelectorAll('.animate-in')
          gsap.fromTo(els,
            { y: 30, opacity: 0 },
            {
              y: 0, opacity: 1, stagger: 0.1, duration: 0.6, ease: 'power2.out',
              scrollTrigger: {
                trigger: headerRef.current,
                start: 'top 85%',
                toggleActions: 'play none none none',
              }
            }
          )
        }

        cardsRef.current.forEach((card, i) => {
          if (card) {
            gsap.fromTo(card,
              { y: 50, opacity: 0 },
              {
                y: 0, opacity: 1, duration: 0.7, ease: 'power2.out', delay: i * 0.15,
                scrollTrigger: {
                  trigger: card,
                  start: 'top 85%',
                  toggleActions: 'play none none none',
                }
              }
            )
          }
        })
      }, sectionRef)

      return () => ctx.revert()
    }, 300)

    return () => {}
  }, [loading, products])

  return (
    <section
      id="categories"
      ref={sectionRef}
      className="py-12 lg:py-16"
      style={{ backgroundColor: 'var(--theme-bg, #F2EDE6)' }}
    >
      <div className="container-main">
        <div ref={headerRef} className="text-center mb-12">
          <div
            className="animate-in font-body font-semibold text-xs tracking-[0.1em] mb-3"
            style={{ color: 'var(--theme-primary, #1B4332)' }}
          >
            NUESTROS PRODUCTOS
          </div>
          <h2
            className="animate-in font-display font-bold leading-tight"
            style={{ color: 'var(--theme-text, #3D2817)', fontSize: 'clamp(28px, 3.5vw, 48px)' }}
          >
            Suplementos<br />100% Naturales
          </h2>
          <p
            className="animate-in font-body text-base mt-4 max-w-lg mx-auto leading-relaxed"
            style={{ color: 'var(--theme-muted, #5C4033)' }}
          >
            Calidad premium. Pedidos por WhatsApp. Envíos a todo Paraguay.
          </p>
        </div>

        {loading ? (
          <ProductSkeleton count={6} className="lg:grid-cols-3" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {products.map((product, i) => (
              <div
                key={product.id}
                ref={(el) => { cardsRef.current[i] = el }}
                className="group rounded-2xl p-4 sm:p-6 transition-all duration-300 hover:-translate-y-1.5 cursor-pointer"
                style={{
                  backgroundColor: 'var(--theme-surface, #FFFFFF)',
                  boxShadow: '0 2px 12px rgba(45, 106, 79, 0.10), 0 0 0 1px var(--theme-border, rgba(45, 106, 79, 0.08))',
                }}
                onClick={() => navigate(`/producto/${product.slug || product.id}`)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(45, 106, 79, 0.18), 0 0 0 1px rgba(45, 106, 79, 0.12)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(45, 106, 79, 0.10), 0 0 0 1px rgba(45, 106, 79, 0.08)'
                }}
              >
                <div className="relative">
                <div
                  className="aspect-square overflow-hidden"
                  style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }}
                >
                  <img
                    src={product.imagen}
                    alt={product.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23f0f0f0" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999" font-size="12">Sin imagen</text></svg>'
                    }}
                  />
                </div>
                {/* Badges - outside overflow-hidden */}
                <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-1 z-10 pointer-events-none">
                  {product.precio_anterior && (
                    <span className="font-body font-semibold text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E63946', color: '#FFFFFF' }}>
                      OFERTA
                    </span>
                  )}
                  {product.stock <= 0 && (
                    <span className="font-body font-semibold text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}>
                      AGOTADO
                    </span>
                  )}
                  {(() => {
                    const badges = getProductBadges(product)
                    if (!badges.length) return null
                    return badges.map(b => (
                      <span key={b.label} className="font-body font-semibold text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: b.color, color: '#fff' }}>
                        {b.label}
                      </span>
                    ))
                  })()}
                </div>
              </div>

                <h3
                  className="font-body font-semibold text-sm sm:text-base mt-4 leading-snug"
                  style={{ color: 'var(--theme-text, #1A1A1A)' }}
                >
                  {product.nombre}
                </h3>
                <p className="font-body text-xs sm:text-sm mt-1.5 leading-relaxed line-clamp-1" style={{ color: 'var(--theme-muted, #6B6B6B)' }}>
                  {stripHtml(product.descripcion)}
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 gap-2">
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-body font-bold text-sm sm:text-xl" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                        {formatPrice(product.precio)}
                      </span>
                      {product.precio_anterior && (
                        <span className="font-body text-xs sm:text-sm line-through" style={{ color: 'var(--theme-muted, #999)' }}>
                          {formatPrice(product.precio_anterior)}
                        </span>
                      )}
                    </div>
                    {product.price_tiers && product.price_tiers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {product.price_tiers.slice(0, 2).map((t, i) => (
                          <span key={i} className="font-body font-medium text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--theme-primary-bg-05, rgba(27,67,50,0.06))', color: 'var(--theme-primary, #1B4332)' }}>
                            {getTierLabel(t, product)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      addItem(product, 1)
                    }}
                    className="font-body font-semibold text-xs px-5 py-2.5 rounded-full transition-all duration-300 hover:scale-105 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto"
                    style={{
                      backgroundColor: 'var(--theme-primary, #1B4332)',
                      color: 'var(--theme-text-on-primary, #FFFFFF)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    Agregar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
