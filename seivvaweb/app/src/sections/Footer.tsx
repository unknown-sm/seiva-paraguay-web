import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Instagram, Facebook, Twitter } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

const productLinks = ['Espirulina', 'Ashwagandha', 'Matcha', 'Cúrcuma', 'Maca']
const companyLinks = ['Sobre Nosotros', 'Nuestro Proceso', 'Certificaciones', 'Blog']
const supportLinks = [
  { label: 'Contacto', to: '/contacto' },
  { label: 'Preguntas Frecuentes', to: '/faq' },
  { label: 'Políticas', to: '/politicas' },
]

export default function Footer() {
  const footerRef = useRef<HTMLElement>(null)
  const [email, setEmail] = useState('')

  useEffect(() => {
    const ctx = gsap.context(() => {
      const els = footerRef.current?.querySelectorAll('.animate-in')
      if (els) {
        gsap.fromTo(els,
          { y: 20, opacity: 0 },
          {
            y: 0, opacity: 1, stagger: 0.1, duration: 0.5, ease: 'power2.out',
            scrollTrigger: {
              trigger: footerRef.current,
              start: 'top 95%',
              toggleActions: 'play none none none',
            }
          }
        )
      }
    }, footerRef)

    return () => ctx.revert()
  }, [])

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      alert('¡Gracias por suscribirte!')
      setEmail('')
    }
  }

  return (
    <footer
      id="footer"
      ref={footerRef}
      className="pt-16 pb-8"
      style={{ backgroundColor: 'var(--theme-primary, #1B4332)' }}
    >
      <div className="container-main">
        {/* Newsletter */}
        <div
          className="animate-in rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 mb-12"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
          <div>
            <h3 className="font-display font-semibold text-lg text-white">
              Únete a nuestra comunidad
            </h3>
            <p className="font-body text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Recibe tips de salud y descuentos exclusivos.
            </p>
          </div>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Tu email"
              className="w-full sm:w-64 h-11 px-5 rounded-full font-body text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[#D4A843] transition-all"
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            />
            <button
              type="submit"
              className="h-11 px-6 rounded-full font-body font-semibold text-sm transition-all duration-300 hover:scale-105 whitespace-nowrap"
              style={{
                backgroundColor: 'var(--theme-accent, #D4A843)',
                color: 'var(--theme-primary, #1B4332)',
                letterSpacing: '0.08em',
              }}
            >
              Suscribirse
            </button>
          </form>
        </div>

        {/* Main Footer Content */}
        <div className="animate-in flex flex-col lg:flex-row justify-between gap-12 mb-12">
           {/* Brand */}
           <div className="lg:w-[30%]">
             <img
               src="https://old.seiva.com.py/wp-content/uploads/seiva-logo-rectangulo.png"
               alt="Seiva"
               className="h-10 w-auto object-contain mb-3"
             />
             <p className="font-body text-sm max-w-[240px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
               Nutrición natural para una vida plena.
             </p>
            <div className="flex items-center gap-4 mt-5">
              {[Instagram, Facebook, Twitter].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="transition-colors duration-300"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#D4A843' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.6)' }}
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-12 lg:gap-16">
            <div>
              <h4 className="font-body font-semibold text-xs tracking-wider text-white mb-4">
                PRODUCTOS
              </h4>
              <ul className="space-y-2.5">
                {productLinks.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="font-body text-sm transition-colors duration-300"
                      style={{ color: 'rgba(255,255,255,0.7)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#FFFFFF' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.7)' }}
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-body font-semibold text-xs tracking-wider text-white mb-4">
                EMPRESA
              </h4>
              <ul className="space-y-2.5">
                {companyLinks.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="font-body text-sm transition-colors duration-300"
                      style={{ color: 'rgba(255,255,255,0.7)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#FFFFFF' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.7)' }}
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-body font-semibold text-xs tracking-wider text-white mb-4">
                SOPORTE
              </h4>
              <ul className="space-y-2.5">
                {supportLinks.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="font-body text-sm transition-colors duration-300"
                      style={{ color: 'rgba(255,255,255,0.7)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#FFFFFF' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.7)' }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div
          className="animate-in pt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
        >
          <span className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            © 2026 Seiva Paraguay. Todos los derechos reservados.
          </span>
          <div className="flex items-center gap-6">
            {['Términos', 'Privacidad', 'Cookies'].map((link) => (
              <a
                key={link}
                href="#"
                className="font-body text-xs transition-colors duration-300"
                style={{ color: 'rgba(255,255,255,0.5)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#FFFFFF' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)' }}
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
