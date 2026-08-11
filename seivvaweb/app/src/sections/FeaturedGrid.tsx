import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ShoppingCart } from 'lucide-react'
import { fetchFeatured, formatPrice, stripHtml, getProductBadges, getTierLabel, type Product } from '../services/api'
import { useCart } from '../context/CartContext'

gsap.registerPlugin(ScrollTrigger)

export default function FeaturedGrid() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { addItem } = useCart()

  useEffect(() => {
    fetchFeatured()
      .then(data => {
        setProducts(data.slice(0, 8))
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
                y: 0, opacity: 1, duration: 0.7, ease: 'power2.out', delay: i * 0.12,
                scrollTrigger: {
                  trigger: card,
                  start: 'top 88%',
                  toggleActions: 'play none none none',
                }
              }
            )
          }
        })
      }, sectionRef)

      return () => ctx.revert()
    }, 200)

    return () => {}
  }, [loading, products])

  if (loading || products.length === 0) return null

  return (
    <section
      ref={sectionRef}
      className="py-14 lg:py-20"
      style={{ backgroundColor: 'var(--theme-bg, #F2EDE6)' }}
    >
      <div className="container-main">
        <div ref={headerRef} className="text-center mb-10 lg:mb-14">
          <div
            className="animate-in font-body font-semibold text-xs tracking-[0.1em] mb-3"
            style={{ color: 'var(--theme-accent, #D4A843)' }}
          >
            SELECCIONADOS PARA TI
          </div>
          <h2
            className="animate-in font-display font-bold leading-tight"
            style={{ color: 'var(--theme-text, #3D2817)', fontSize: 'clamp(28px, 3.5vw, 48px)' }}
          >
            Productos Destacados
          </h2>
          <p
            className="animate-in font-body text-base mt-3 max-w-md mx-auto leading-relaxed"
            style={{ color: 'var(--theme-muted, #5C4033)' }}
          >
            Los favoritos de nuestra comunidad. Calidad garantizada.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {products.map((product, i) => (
            <div
              key={product.id}
              ref={(el) => { cardsRef.current[i] = el }}
              className="group rounded-2xl p-4 sm:p-5 transition-all duration-300 hover:-translate-y-1.5 cursor-pointer flex flex-col"
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
              <div
                className="relative rounded-xl overflow-hidden"
                style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)', border: '1px solid var(--theme-border, #F0EDE8)', height: '200px' }}
              >
                <img
                  src={product.imagen}
                  alt={product.nombre}
                  className="absolute inset-0 w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
                {product.precio_anterior && (
                  <span
                    className="absolute top-2.5 right-2.5 font-body font-semibold text-[10px] px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: '#E63946', color: '#FFFFFF', zIndex: 10 }}
                  >
                    OFERTA
                  </span>
                )}
                {(() => {
                  const badges = getProductBadges(product)
                  if (!badges.length) return null
                  return (
                    <div className="absolute bottom-2 left-2 flex flex-wrap gap-1" style={{ zIndex: 10 }}>
                      {badges.map(b => (
                        <span key={b.label} className="font-body font-semibold text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: b.color, color: '#fff' }}>
                          {b.label}
                        </span>
                      ))}
                    </div>
                  )
                })()}
              </div>

              <div className="flex flex-col flex-1 mt-3">
                <h3
                  className="font-body font-semibold text-sm sm:text-[15px] leading-snug line-clamp-2"
                  style={{ color: 'var(--theme-text, #1A1A1A)' }}
                >
                  {product.nombre}
                </h3>
                <p className="font-body text-xs mt-1 leading-relaxed line-clamp-1" style={{ color: 'var(--theme-muted, #6B6B6B)' }}>
                  {stripHtml(product.descripcion)}
                </p>

                <div className="mt-auto pt-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 mb-1">
                    <span className="font-body font-bold text-base sm:text-lg" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                      {formatPrice(product.precio)}
                    </span>
                    {product.precio_anterior && (
                      <span className="font-body text-xs line-through" style={{ color: 'var(--theme-muted, #999)' }}>
                        {formatPrice(product.precio_anterior)}
                      </span>
                    )}
                  </div>
                  {product.price_tiers && product.price_tiers.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {product.price_tiers.slice(0, 2).map((t, i) => (
                        <span key={i} className="font-body font-medium text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--theme-primary-bg-05, rgba(27,67,50,0.06))', color: 'var(--theme-primary, #1B4332)' }}>
                          {getTierLabel(t, product)}
                        </span>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      addItem(product, 1)
                    }}
                    className="font-body font-semibold text-xs px-5 py-2.5 rounded-full transition-all duration-300 hover:scale-105 inline-flex items-center justify-center gap-1.5 w-full"
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
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
