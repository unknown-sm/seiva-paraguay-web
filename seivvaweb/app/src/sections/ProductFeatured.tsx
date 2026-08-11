import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Star, Check, Shield, Minus, Plus } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { fetchHeroProduct, formatPrice, stripHtml, type Product } from '../services/api'

gsap.registerPlugin(ScrollTrigger)

const benefits = [
  'Aumenta energía natural',
  'Fortalece sistema inmune',
  'Detox y alcalinización',
]

export default function ProductFeatured() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedOption, setSelectedOption] = useState(0)
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFullDesc, setShowFullDesc] = useState(false)
  const { addItem } = useCart()

  useEffect(() => {
    fetchHeroProduct()
      .then(data => {
        setProduct(data)
        setLoading(false)
      })
      .catch(() => {
        setProduct(null)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (loading || !product) return

    const ctx = gsap.context(() => {
      if (imageRef.current) {
        gsap.fromTo(imageRef.current,
          { scale: 0.85, opacity: 0 },
          {
            scale: 1, opacity: 1, duration: 0.8, ease: 'power2.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 80%',
              toggleActions: 'play none none none',
            }
          }
        )
      }

      if (contentRef.current) {
        const els = contentRef.current.querySelectorAll('.animate-in')
        gsap.fromTo(els,
          { y: 30, opacity: 0 },
          {
            y: 0, opacity: 1, stagger: 0.1, duration: 0.6, ease: 'power2.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 80%',
              toggleActions: 'play none none none',
            }
          }
        )
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [loading, product])

  const addToCart = () => {
    if (!product) return
    addItem(product, quantity)
  }

  if (loading || !product) return null

  const cleanDesc = stripHtml(product.descripcion || '')
    .replace(/[•·]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const shortDesc = cleanDesc.length > 160 ? cleanDesc.substring(0, 160).trim() + '...' : cleanDesc
  const displayDesc = showFullDesc ? cleanDesc : shortDesc

  const descuento = product.precio_anterior
    ? Math.round((1 - product.precio / product.precio_anterior) * 100)
    : 0

  const varianteActiva = product.variantes?.[selectedOption]
  const displayPrice = varianteActiva?.precio || product.precio

  return (
    <section
      id="featured"
      ref={sectionRef}
      className="py-14 lg:py-20 overflow-hidden"
      style={{ backgroundColor: 'var(--theme-primary, #1B4332)' }}
    >
      <div className="container-main">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Imagen */}
          <div ref={imageRef} className="flex justify-center lg:justify-end">
            <div className="relative">
              <div
                className="w-72 h-72 lg:w-96 lg:h-96 rounded-full opacity-20 absolute -inset-8"
                style={{ backgroundColor: 'var(--theme-accent, #D4A843)' }}
              />
              <img
                src={product.imagen}
                alt={product.nombre}
                className="relative w-72 h-72 lg:w-96 lg:h-96 object-contain drop-shadow-2xl"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          </div>

          {/* Contenido */}
          <div ref={contentRef}>
            <div
              className="animate-in inline-flex items-center gap-1.5 font-body font-semibold text-xs px-3 py-1 rounded-full mb-6"
              style={{ backgroundColor: 'rgba(212,168,67,0.2)', color: 'var(--theme-accent, #D4A843)' }}
            >
              <Star className="w-3 h-3 fill-current" />
              PRODUCTO DESTACADO
            </div>

            <h2
              className="animate-in font-display font-bold text-4xl lg:text-5xl leading-tight mb-4 text-white"
              style={{ textShadow: '0 2px 16px rgba(0,0,0,0.3)' }}
            >
              {product.nombre}
            </h2>
            <div className="animate-in mb-6">
              <p
                className="font-body text-base lg:text-lg leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.8)' }}
              >
                {displayDesc || 'Producto premium de alta calidad.'}
              </p>
              {cleanDesc.length > 160 && (
                <button
                  onClick={() => setShowFullDesc(!showFullDesc)}
                  className="mt-2 text-sm font-semibold hover:underline"
                  style={{ color: 'var(--theme-accent, #D4A843)' }}
                >
                  {showFullDesc ? 'Ver menos ↑' : 'Ver más →'}
                </button>
              )}
            </div>

            {/* Precio */}
            <div className="animate-in flex items-baseline gap-3 mb-6">
              <span className="font-body font-bold text-4xl text-white">
                {formatPrice(displayPrice)}
              </span>
              {product.precio_anterior && product.precio_anterior > product.precio && (
                <>
                  <span className="font-body text-xl line-through opacity-60 text-white">
                    {formatPrice(product.precio_anterior)}
                  </span>
                  <span className="font-body font-bold text-sm px-2 py-1 rounded-full" style={{ backgroundColor: '#E63946', color: '#FFF' }}>
                    -{descuento}%
                  </span>
                </>
              )}
            </div>

            {/* Presentaciones */}
            {product.variantes && product.variantes.length > 0 && (
              <div className="animate-in flex flex-wrap gap-2 mb-6">
                {product.variantes.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedOption(i)}
                    className="font-body text-sm px-4 py-2 rounded-full border transition-all"
                    style={{
                      borderColor: selectedOption === i ? 'var(--theme-accent, #D4A843)' : 'rgba(255,255,255,0.3)',
                      backgroundColor: selectedOption === i ? 'var(--theme-accent, #D4A843)' : 'transparent',
                      color: selectedOption === i ? 'var(--theme-text, #3D2817)' : 'rgba(255,255,255,0.85)',
                    }}
                  >
                    {v.nombre}{v.precio ? ' ' + formatPrice(v.precio) : ''}
                  </button>
                ))}
              </div>
            )}

            {/* Beneficios */}
            <div className="animate-in flex flex-wrap gap-x-6 gap-y-2 mb-8">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-2 font-body text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <Check className="w-4 h-4" style={{ color: 'var(--theme-accent, #D4A843)' }} />
                  {b}
                </div>
              ))}
            </div>

            {/* Cantidad + Agregar */}
            <div className="animate-in flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-full flex items-center justify-center border border-white/30 text-white hover:bg-white/10 transition-colors">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-body font-bold w-8 text-center text-lg text-white">{quantity}</span>
                <button onClick={() => setQuantity(q => q + 1)}
                  className="w-10 h-10 rounded-full flex items-center justify-center border border-white/30 text-white hover:bg-white/10 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={addToCart}
                disabled={product.stock <= 0}
                className="inline-flex items-center justify-center gap-2 font-body font-semibold text-sm px-8 py-3 rounded-full transition-all duration-300 hover:scale-105"
                style={{
                  backgroundColor: product.stock <= 0 ? '#6B7280' : 'var(--theme-accent, #D4A843)',
                  color: 'var(--theme-text, #3D2817)',
                  boxShadow: '0 4px 16px rgba(212,168,67,0.35)',
                }}
              >
                {product.stock <= 0 ? 'Agotado' : 'Agregar al carrito'}
              </button>
            </div>

            {/* Badge */}
            <div className="animate-in flex items-center gap-2 mt-6 pt-6 border-t border-white/10">
              <Shield className="w-4 h-4" style={{ color: 'var(--theme-accent, #D4A843)' }} />
              <span className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Calidad garantizada · Envíos a todo Paraguay
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
