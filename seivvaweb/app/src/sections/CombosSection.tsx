import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useCart } from '../context/CartContext'
import { type Product } from '../services/api'

gsap.registerPlugin(ScrollTrigger)

const API = window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : '/api'

export default function CombosSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const { addItem } = useCart()

  useEffect(() => {
    fetch(`${API}/productos/combos`)
      .then(r => r.json())
      .then(data => {
        setProducts(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading || products.length === 0) return

    const ctx = gsap.context(() => {
      gsap.fromTo('.combo-card',
        { y: 40, opacity: 0 },
        {
          y: 0, opacity: 1, stagger: 0.1, duration: 0.6, ease: 'power2.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 85%',
          }
        }
      )
    }, sectionRef)

    return () => ctx.revert()
  }, [loading, products])

  if (loading || products.length === 0) return null

  return (
    <section
      ref={sectionRef}
      className="py-16 px-4"
      style={{ backgroundColor: 'var(--theme-primary, #1B4332)' }}
    >
      <div className="container-main">
        <div className="text-center mb-10">
          <p
            className="font-body text-sm tracking-widest uppercase mb-2"
            style={{ color: '#E9C46A' }}
          >
            ¿Buscás descuentos?
          </p>
          <h2
            className="font-display text-3xl md:text-4xl font-bold"
            style={{ color: '#FFFFFF' }}
          >
            Combos de Oferta
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => {
            const tieneDescuento = product.precio_anterior && product.precio_anterior > product.precio

            return (
              <div
                key={product.id}
                className="combo-card rounded-2xl overflow-hidden relative group cursor-pointer"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={product.imagen || '/images/placeholder.png'}
                    alt={product.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {tieneDescuento && (
                    <div
                      className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: '#E9C46A',
                        color: '#1B4332',
                      }}
                    >
                      -{Math.round((1 - product.precio / (product.precio_anterior || product.precio)) * 100)}%
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <h3
                    className="font-display font-bold text-lg mb-3 leading-tight"
                    style={{ color: '#FFFFFF' }}
                  >
                    {product.nombre}
                  </h3>

                  <div className="flex items-center gap-3">
                    {tieneDescuento && (
                      <span
                        className="text-sm line-through"
                        style={{ color: 'rgba(255,255,255,0.5)' }}
                      >
                        Gs.{product.precio_anterior!.toLocaleString('es-PY')}
                      </span>
                    )}
                    <span
                      className="font-display font-bold text-xl"
                      style={{ color: '#E9C46A' }}
                    >
                      Gs.{product.precio.toLocaleString('es-PY')}
                    </span>
                  </div>

                  <button
                    onClick={() => addItem(product, 1)}
                    className="mt-4 w-full py-2.5 rounded-full font-body font-semibold text-sm transition-all duration-300 hover:scale-105"
                    style={{
                      backgroundColor: '#E9C46A',
                      color: '#1B4332',
                    }}
                  >
                    Agregar al carrito
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
