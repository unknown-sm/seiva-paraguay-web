import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchProducts, formatPrice, generateWhatsAppLink, stripHtml, type Product } from '../services/api'
import ProductSkeleton from '../components/ProductSkeleton'

export default function Categories() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

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
            Suplementos y Snacks<br />100% Naturales
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
                <div
                  className="relative rounded-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)', border: '1px solid var(--theme-border, #F0EDE8)', height: '220px' }}
                >
                  <img
                    src={product.imagen}
                    alt={product.nombre}
                    className="absolute inset-0 w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                  <span
                    className="absolute top-3 left-3 font-body font-semibold text-[10px] px-2.5 py-1 rounded-full tracking-wider"
                    style={{
                      backgroundColor: 'var(--theme-primary, #1B4332)',
                      color: 'var(--theme-text-on-primary, #FFFFFF)',
                      zIndex: 10,
                    }}
                  >
                    {product.categoria.toUpperCase()}
                  </span>
                  {product.precio_anterior && (
                    <span
                      className="absolute top-3 right-3 font-body font-semibold text-[10px] px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: '#E63946', color: '#FFFFFF', zIndex: 10 }}
                    >
                      OFERTA
                    </span>
                  )}
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
                  <a
                    href={generateWhatsAppLink(product)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="font-body font-semibold text-xs px-5 py-2.5 rounded-full transition-all duration-300 hover:scale-105 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto"
                    style={{
                      backgroundColor: '#25D366',
                      color: '#FFFFFF',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
                    </svg>
                    Pedir
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
