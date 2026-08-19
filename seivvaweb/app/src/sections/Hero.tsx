import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

const defaultIngredients = [
  { img: '/images/floating-leaf.png', top: '8%', left: '10%', size: 80, delay: 0, duration: 3.5, rotate: -20 },
  { img: '/images/floating-orange.png', top: '5%', right: '12%', size: 90, delay: 0.5, duration: 4, rotate: 15 },
  { img: '/images/floating-berries.png', top: '35%', left: '3%', size: 70, delay: 1, duration: 3, rotate: 10 },
  { img: '/images/floating-ginger.png', bottom: '12%', right: '8%', size: 100, delay: 1.5, duration: 4.5, rotate: -10 },
  { img: '/images/floating-mint.png', bottom: '18%', left: '18%', size: 75, delay: 2, duration: 3.2, rotate: 25 },
  { img: '/images/floating-leaf.png', top: '55%', right: '22%', size: 50, delay: 2.5, duration: 3.8, rotate: -5 },
]

export default function Hero() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLParagraphElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const bottleRef = useRef<HTMLImageElement>(null)
  const ingredientRefs = useRef<(HTMLImageElement | null)[]>([])
  const [heroImage, setHeroImage] = useState('/images/hero-bottle.jpg')
  const [heroTitle, setHeroTitle] = useState('')
  const [heroSubtitle, setHeroSubtitle] = useState('')
  const [ingredients, setIngredients] = useState(defaultIngredients)

  useEffect(() => {
    const API = window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : '/api'
    fetch(API + '/contenido')
      .then(r => r.json())
      .then(data => {
        if (data.hero_imagen) setHeroImage(data.hero_imagen)
        if (data.hero_titulo) setHeroTitle(data.hero_titulo)
        if (data.hero_descripcion) setHeroSubtitle(data.hero_descripcion)
        if (data.hero_imagenes) {
          const imgList = data.hero_imagenes.split(',').map((s: string) => s.trim()).filter(Boolean)
          if (imgList.length > 0) {
            setIngredients(prev => prev.map((item, i) => ({
              ...item,
              img: imgList[i] || item.img
            })))
          }
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (headlineRef.current) {
        gsap.fromTo(headlineRef.current,
          { y: 60, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.5 }
        )
      }

      // Badge, sub, CTA
      gsap.fromTo([badgeRef.current, subRef.current, ctaRef.current],
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.15, duration: 0.7, ease: 'power2.out', delay: 0.9 }
      )

      // Bottle entrance
      if (bottleRef.current) {
        gsap.fromTo(bottleRef.current,
          { scale: 0.7, opacity: 0, rotate: -15 },
          { scale: 1, opacity: 1, rotate: -8, duration: 1.2, ease: 'elastic.out(1, 0.5)', delay: 0.6 }
        )
      }

      // Ingredients entrance
      ingredientRefs.current.forEach((el, i) => {
        if (el) {
          gsap.fromTo(el,
            { scale: 0, opacity: 0 },
            {
              scale: 1, opacity: 1, duration: 0.6,
              ease: 'back.out(1.7)', delay: 1.0 + i * 0.1,
              onComplete: () => startFloating(el, i)
            }
          )
        }
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  const startFloating = (el: HTMLImageElement, i: number) => {
    const ing = ingredients[i]
    gsap.to(el, {
      y: '+=12',
      rotation: `+=${3 + i}`,
      duration: ing.duration,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: ing.delay,
    })
    gsap.to(el, {
      x: '+=6',
      duration: 5 + i,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: ing.delay * 0.7,
    })
  }

  // Mouse parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const centerX = window.innerWidth / 2
      const centerY = window.innerHeight / 2

      ingredientRefs.current.forEach((el, i) => {
        if (!el) return
        const depth = (i + 1) * 0.3
        const x = (e.clientX - centerX) * depth * 0.01
        const y = (e.clientY - centerY) * depth * 0.01
        gsap.to(el, { x, y, duration: 0.8, ease: 'power2.out', overwrite: 'auto' })
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <>
      <section
        id="hero"
        ref={sectionRef}
        className="relative min-h-[100dvh] w-full overflow-hidden flex items-center"
        style={{ backgroundColor: 'var(--theme-primary, #1B4332)' }}
      >
        {/* Radial gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 60% 50%, rgba(45, 106, 79, 0.4) 0%, transparent 70%)',
          }}
        />

        <div className="container-main relative z-10 grid grid-cols-1 lg:grid-cols-[45%_55%] gap-8 items-center min-h-[100dvh] py-16 sm:py-24">
          {/* Left Column - Text */}
          <div className="flex flex-col justify-center order-2 lg:order-1">
            <div
              ref={badgeRef}
              className="inline-flex items-center self-start px-4 py-1.5 rounded-full text-xs font-body font-semibold tracking-widest mb-6"
              style={{
                backgroundColor: 'rgba(212, 168, 67, 0.15)',
                border: '1px solid rgba(212, 168, 67, 0.3)',
                color: '#E9C46A',
              }}
            >
               ENVÍOS A TODO PARAGUAY
            </div>

             <h1
               ref={headlineRef}
               className="font-display font-bold text-white leading-[1.05] tracking-tight"
               style={{
                 fontSize: 'clamp(40px, 6vw, 72px)',
                 textShadow: '0 4px 24px rgba(0,0,0,0.2)',
               }}
             >
               {(heroTitle || 'SUPLEMENTOS<br />PREMIUM PARA<br />TU SALUT').split('\n').map((line, i, arr) => (
                 <span key={i}>
                   {line}{i < arr.length - 1 && <br />}
                 </span>
               ))}
             </h1>

             <p
               ref={subRef}
               className="font-body text-base leading-relaxed mt-5 max-w-md"
               style={{ color: 'rgba(255,255,255,0.8)' }}
             >
               {heroSubtitle || 'Las mejores marcas de suplementos, vitaminas y proteinas. Envio rapido a todo Paraguay.'}
             </p>

            <div ref={ctaRef} className="flex flex-wrap gap-4 mt-8">
              <a
                href="/tienda"
                className="font-body font-semibold text-sm px-8 py-3.5 rounded-full transition-all duration-300 hover:scale-105 inline-flex items-center"
                style={{
                  backgroundColor: 'var(--theme-accent, #D4A843)',
                  color: 'var(--theme-primary, #1B4332)',
                  letterSpacing: '0.08em',
                  boxShadow: '0 4px 16px rgba(212, 168, 67, 0.35)',
                }}
              >
                Ver Tienda
              </a>
              <a
                href="https://wa.me/595992120303"
                target="_blank"
                rel="noopener noreferrer"
                className="font-body font-semibold text-sm px-7 py-3.5 rounded-full transition-all duration-300 hover:bg-white/10 inline-flex items-center gap-2 border-2"
                style={{
                  color: '#FFFFFF',
                  borderColor: 'rgba(255,255,255,0.3)',
                  letterSpacing: '0.08em',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
                WhatsApp
              </a>
            </div>
          </div>

          {/* Right Column - Product + Ingredients */}
          <div className="relative flex items-center justify-center order-1 lg:order-2 h-[400px] lg:h-[600px]">
            {/* Main Bottle */}
            <img
              ref={bottleRef}
              src={heroImage}
              alt="Seiva Paraguay"
              width={380}
              height={760}
              fetchPriority="high"
              decoding="async"
              className="relative z-10 w-[200px] sm:w-[280px] lg:w-[380px] object-contain"
              style={{
                aspectRatio: "380 / 760",
                filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.5))',
                transform: 'rotate(-8deg)',
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />

            {/* Floating Ingredients */}
            {ingredients.map((ing, i) => (
              <img
                key={i}
                ref={(el) => { ingredientRefs.current[i] = el }}
                src={ing.img}
                alt=""
                className="absolute z-20 pointer-events-none will-change-transform"
                style={{
                  width: ing.size,
                  height: ing.size,
                  top: ing.top,
                  left: ing.left,
                  right: ing.right,
                  bottom: ing.bottom,
                  transform: `rotate(${ing.rotate}deg)`,
                }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
