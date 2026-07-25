import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Leaf, Instagram, Facebook, Twitter } from 'lucide-react'

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

  return (
    <footer
      id="footer"
      ref={footerRef}
      className="pt-16 pb-8"
      style={{ backgroundColor: 'var(--theme-primary, #1B4332)' }}
    >
      <div className="container-main">
        {/* WhatsApp CTA */}
        <a
          href="https://wa.me/595992120303"
          target="_blank"
          rel="noopener noreferrer"
          className="animate-in rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 mb-12 transition-all hover:scale-[1.02]"
          style={{ backgroundColor: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.25)' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#25D366' }}>
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg text-white">
                ¿Tenés dudas? Escribinos
              </h3>
              <p className="font-body text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Te respondemos al instante por WhatsApp
              </p>
            </div>
          </div>
          <span className="h-11 px-6 rounded-full font-body font-semibold text-sm transition-all duration-300 hover:scale-105 whitespace-nowrap inline-flex items-center"
            style={{ backgroundColor: '#25D366', color: '#FFF', letterSpacing: '0.04em' }}>
            0992 120303
          </span>
        </a>

        {/* Main Footer Content */}
        <div className="animate-in flex flex-col lg:flex-row justify-between gap-12 mb-12">
          {/* Brand */}
          <div className="lg:w-[30%]">
            <div className="flex items-center gap-2">
              <Leaf className="w-6 h-6" style={{ color: 'var(--theme-accent, #D4A843)' }} />
              <span className="font-display font-semibold text-xl text-white">
                SEIVA
              </span>
            </div>
            <p className="font-body text-sm mt-3 max-w-[240px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
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
