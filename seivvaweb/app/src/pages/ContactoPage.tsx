import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { MessageCircle, Mail, MapPin, Clock, Truck, Leaf } from 'lucide-react'

const contacts = [
  {
    icon: MessageCircle,
    label: 'WhatsApp Principal',
    value: '0992 120303',
    sub: 'Click para abrir chat',
    href: 'https://wa.me/595992120303',
    color: '#25D366',
  },
  {
    icon: MessageCircle,
    label: 'WhatsApp Secundario',
    value: '0992 309367',
    sub: 'Click para abrir chat',
    href: 'https://wa.me/595992309367',
    color: '#25D366',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'contacto@seiva.com.py',
    sub: 'Respondemos en 24h',
    href: 'mailto:contacto@seiva.com.py',
    color: '#D4A843',
  },
  {
    icon: MapPin,
    label: 'Dirección',
    value: 'Capiatá, Departamento Central, Paraguay',
    sub: null,
    href: null,
    color: '#1B4332',
  },
  {
    icon: Clock,
    label: 'Horarios',
    value: 'Lunes a Viernes: 8:00 - 18:00',
    sub: 'Sábados: 8:00 - 13:00',
    href: null,
    color: '#1B4332',
  },
  {
    icon: Truck,
    label: 'Envíos',
    value: 'Asunción y alrededores: entrega el mismo día',
    sub: 'Interior: por encomienda',
    href: null,
    color: '#1B4332',
  },
]

export default function ContactoPage() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const els = sectionRef.current?.querySelectorAll('.animate-in')
      if (els) {
        gsap.fromTo(els,
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.08, duration: 0.5, ease: 'power2.out' }
        )
      }
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <main ref={sectionRef} className="pt-24 pb-16 min-h-screen" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)' }}>
      <div className="container-main">
        <div className="animate-in text-center mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-bold" style={{ color: 'var(--theme-primary, #1B4332)' }}>
            Contacto
          </h1>
          <p className="font-body mt-2" style={{ color: 'var(--theme-muted, #5C4033)' }}>
            Elegí el canal que prefieras. Respondemos rápido.
          </p>
        </div>

        <div className="animate-in grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {contacts.map((item, i) => {
            const Icon = item.icon
            const card = (
              <div
                className="rounded-xl p-6 transition-all duration-300 hover:shadow-lg h-full"
                style={{
                  backgroundColor: 'var(--theme-surface, #FDF8F0)',
                  border: '1px solid var(--theme-border, #E8E0D5)',
                }}
              >
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-full mb-4"
                  style={{ backgroundColor: `${item.color}18` }}
                >
                  <Icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
                <h3 className="font-body font-semibold mb-1" style={{ color: 'var(--theme-text, #3D2817)' }}>
                  {item.label}
                </h3>
                <p className="font-body text-sm" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                  {item.value}
                </p>
                {item.sub && (
                  <p className="font-body text-xs mt-1 opacity-70" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                    {item.sub}
                  </p>
                )}
              </div>
            )

            if (item.href) {
              return (
                <a key={i} href={item.href} target="_blank" rel="noopener noreferrer" className="block">
                  {card}
                </a>
              )
            }
            return <div key={i}>{card}</div>
          })}
        </div>

        <div className="animate-in text-center mt-10">
          <div
            className="inline-flex items-center gap-3 rounded-xl px-6 py-4"
            style={{ backgroundColor: 'var(--theme-primary, #1B4332)' }}
          >
            <Leaf className="w-5 h-5" style={{ color: '#D4A843' }} />
            <span className="font-body text-sm text-white">
              También podés escribirnos por WhatsApp haciendo clic en el botón verde
            </span>
          </div>
        </div>
      </div>
    </main>
  )
}
