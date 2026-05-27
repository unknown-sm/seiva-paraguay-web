import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Star, Check, Shield, Minus, Plus } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { formatPrice } from '../services/api'

gsap.registerPlugin(ScrollTrigger)

const options = ['120 cápsulas', '240 cápsulas', 'Polvo 500g']
const benefits = [
  'Aumenta energía natural',
  'Fortalece sistema inmune',
  'Detox y alcalinización',
]

export default function ProductFeatured() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [selectedOption, setSelectedOption] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const { addItem } = useCart()

  useEffect(() => {
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
  }, [])

  const addToCart = () => {
    addItem({
      id: 0,
      nombre: 'Espirulina Orgánica Premium',
      precio: 29990,
      precio_anterior: 39990,
      categoria: 'suplementos',
      subcategoria: 'polvo',
      descripcion: 'Superalimento verde con 70% proteína vegetal completa.',
      imagen: '/images/product-spirulina.jpg',
      etiquetas: ['popular'],
      destacado: true,
    }, quantity)
  }

  return (
    <section
      id="featured"
      ref={sectionRef}
      className="relative py-20 lg:py-24"
      style={{ backgroundColor: 'var(--theme-primary, #1B4332)' }}
    >
      <div className="container-main grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left - Product Image */}
        <div ref={imageRef} className="relative flex justify-center">
          {/* Circular glow */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div
              className="w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(82,183,136,0.2) 0%, transparent 70%)',
              }}
            />
          </div>
          <img
            src="/images/product-spirulina.jpg"
            alt="Espirulina Orgánica Premium"
            className="relative z-10 w-[280px] sm:w-[350px] rounded-2xl object-cover"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
          />
          {/* Decorative floating leaves */}
          <img
            src="/images/floating-leaf.png"
            alt=""
            className="absolute top-4 left-4 w-12 h-12 opacity-60 float-animation"
          />
          <img
            src="/images/floating-mint.png"
            alt=""
            className="absolute bottom-8 right-8 w-14 h-14 opacity-50 float-animation float-animation-delay-2"
          />
        </div>

        {/* Right - Product Details */}
        <div ref={contentRef}>
          <div
            className="animate-in font-body font-semibold text-xs tracking-[0.12em] mb-3"
            style={{ color: 'var(--theme-accent, #D4A843)' }}
          >
            PRODUCTO DESTACADO
          </div>

          <h2
            className="animate-in font-display font-bold text-white leading-tight"
            style={{ fontSize: 'clamp(28px, 3.5vw, 40px)' }}
          >
            Espirulina Orgánica Premium
          </h2>

          <div className="animate-in flex items-center gap-2 mt-3">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4.5 h-4.5" style={{ color: 'var(--theme-accent, #D4A843)' }} fill="#D4A843" />
            ))}
            <span className="font-body text-sm ml-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
              (2,847 reseñas)
            </span>
          </div>

          <p
            className="animate-in font-body text-base leading-relaxed mt-4 max-w-md"
            style={{ color: 'rgba(255,255,255,0.75)' }}
          >
            Superalimento verde con 70% proteína vegetal completa, vitaminas B12, hierro y antioxidantes. Cultivada en aguas puras sin pesticidas ni aditivos.
          </p>

          {/* Benefits */}
          <div className="animate-in flex flex-col gap-3 mt-6">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <Check className="w-[18px] h-[18px] flex-shrink-0" style={{ color: '#52B788' }} />
                <span className="font-body text-sm text-white">{b}</span>
              </div>
            ))}
          </div>

          {/* Options */}
          <div className="animate-in mt-7">
            <span className="font-body text-sm block mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Presentación:
            </span>
            <div className="flex flex-wrap gap-2">
              {options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedOption(i)}
                  className="font-body font-semibold text-xs px-5 py-2.5 rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: selectedOption === i ? '#D4A843' : 'rgba(255,255,255,0.1)',
                    color: selectedOption === i ? '#1B4332' : '#FFFFFF',
                    border: selectedOption === i ? 'none' : '1px solid rgba(255,255,255,0.15)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div className="animate-in flex items-center gap-3 sm:gap-4 mt-7">
            <span className="font-body font-bold text-3xl sm:text-4xl" style={{ color: 'var(--theme-accent, #D4A843)' }}>
              {formatPrice(29990)}
            </span>
            <span
              className="font-body font-bold text-lg sm:text-xl line-through"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              {formatPrice(39990)}
            </span>
            <span
              className="font-body font-semibold text-[10px] sm:text-[11px] px-2.5 py-1 rounded-full"
              style={{ backgroundColor: '#E63946', color: '#FFFFFF', letterSpacing: '0.08em' }}
            >
              -25%
            </span>
          </div>

          {/* Actions */}
          <div className="animate-in flex flex-wrap items-center gap-4 mt-7">
            {/* Quantity */}
            <div
              className="flex items-center rounded-full h-12"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            >
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-12 flex items-center justify-center text-white hover:text-[#D4A843] transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-body font-semibold text-white">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-12 flex items-center justify-center text-white hover:text-[#D4A843] transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Add to Cart */}
            <button
              onClick={addToCart}
              className="font-body font-semibold text-sm px-9 py-3.5 rounded-full transition-all duration-300 hover:scale-[1.03]"
              style={{
                backgroundColor: '#D4A843',
                color: '#1B4332',
                letterSpacing: '0.08em',
                boxShadow: '0 4px 16px rgba(212, 168, 67, 0.35)',
              }}
            >
              Agregar al Carrito
            </button>
          </div>

          {/* Trust */}
          <div className="animate-in flex items-center gap-2 mt-4">
            <Shield className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
            <span className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Envío seguro y garantía de satisfacción
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
