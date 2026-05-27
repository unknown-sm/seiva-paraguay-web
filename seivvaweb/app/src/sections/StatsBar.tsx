import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Star, Truck, ShieldCheck, Leaf } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

const stats = [
  { icon: Star, value: '4.9', label: 'Valoración', fill: true },
  { icon: Truck, value: 'Envío Gratis', label: 'En pedidos +$50', fill: false },
  { icon: ShieldCheck, value: 'Garantía', label: '30 días de devolución', fill: false },
  { icon: Leaf, value: 'Orgánico', label: 'Certificado USDA', fill: false },
]

export default function StatsBar() {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(barRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.6, ease: 'power2.out',
          scrollTrigger: {
            trigger: barRef.current,
            start: 'top 90%',
            toggleActions: 'play none none none',
          }
        }
      )

      const items = barRef.current?.querySelectorAll('.stat-item')
      if (items) {
        gsap.fromTo(items,
          { y: 20, opacity: 0 },
          {
            y: 0, opacity: 1, stagger: 0.1, duration: 0.5, ease: 'power2.out', delay: 0.2,
            scrollTrigger: {
              trigger: barRef.current,
              start: 'top 90%',
              toggleActions: 'play none none none',
            }
          }
        )
      }
    }, barRef)

    return () => ctx.revert()
  }, [])

  return (
    <div
      ref={barRef}
      className="relative z-20 -mt-10 mx-4 sm:mx-6 lg:mx-auto lg:max-w-[1160px] rounded-t-[20px]"
      style={{
        backgroundColor: 'var(--theme-bg, #FAF3E8)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.1)',
      }}
    >
      <div className="grid grid-cols-2 sm:flex sm:flex-row items-center justify-around gap-3 sm:gap-4 py-4 sm:py-6 px-4 sm:px-8">
        {stats.map((stat, i) => (
          <div key={i} className="stat-item flex items-center gap-3">
            <stat.icon
              className="w-5 h-5 flex-shrink-0"
              style={{ color: stat.fill ? 'var(--theme-accent, #D4A843)' : 'var(--theme-primary, #2D6A4F)' }}
              fill={stat.fill ? '#D4A843' : 'none'}
            />
            <div>
              <div className="font-body font-bold text-lg sm:text-xl" style={{ color: 'var(--theme-text, #3D2817)' }}>
                {stat.value}
              </div>
              <div className="font-body text-sm" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                {stat.label}
              </div>
            </div>
            {i < stats.length - 1 && (
              <div
                className="hidden lg:block w-px h-10 ml-4"
                style={{ backgroundColor: 'rgba(61,40,23,0.15)' }}
              />
            )}
          </div>
        ))}

        <a
          href="#featured"
          className="stat-item font-body font-semibold text-sm px-7 py-3 rounded-full transition-all duration-300 hover:scale-105 whitespace-nowrap"
          style={{
            backgroundColor: 'var(--theme-primary, #1B4332)',
            color: '#FFFFFF',
            letterSpacing: '0.08em',
          }}
        >
          Comprar Ahora
        </a>
      </div>
    </div>
  )
}
