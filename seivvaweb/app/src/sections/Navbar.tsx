import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, ShoppingCart, Search } from 'lucide-react'
import gsap from 'gsap'
import { useCart } from '../context/CartContext'

export default function Navbar() {
  const navRef = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { totalItems, openCart } = useCart()
  const location = useLocation()
  const navigate = useNavigate()
  const isOpaque = location.pathname !== '/'

  useEffect(() => {
    const handler = () => setMobileOpen(true)
    window.addEventListener('open-mobile-menu', handler)
    return () => window.removeEventListener('open-mobile-menu', handler)
  }, [])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (navRef.current) {
      gsap.fromTo(navRef.current,
        { y: -64, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.2 }
      )
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/tienda?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
      setMobileOpen(false)
    }
  }

  const navLinks = [
    { label: 'Inicio', to: '/' },
    { label: 'Tienda', to: '/tienda' },
    { label: 'Promos', to: '/promos' },
    { label: 'Contacto', to: '/contacto' },
  ]

  return (
    <>
      <nav
        ref={navRef}
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: scrolled || isOpaque ? 'var(--theme-primary, #1B4332)' : 'transparent',
          backdropFilter: scrolled || isOpaque ? 'blur(12px)' : 'none',
          boxShadow: scrolled || isOpaque ? '0 4px 24px rgba(0,0,0,0.2)' : 'none',
        }}
      >
        <div className="container-main flex items-center justify-between h-16 gap-3">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <img
              src="https://old.seiva.com.py/wp-content/uploads/seiva-logo-rectangulo.png"
              alt="Seiva"
              className="h-8 w-auto object-contain"
            />
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="relative font-body font-medium text-sm text-white/85 hover:text-white transition-all duration-300 group"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#D4A843] transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </div>

          {/* Desktop Search */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex flex-1 max-w-sm items-center relative"
          >
            <Search className="absolute left-3 w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full h-9 pl-9 pr-3 rounded-full font-body text-sm text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-[#D4A843] transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            />
          </form>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobile Search */}
            <form
              onSubmit={handleSearch}
              className="md:hidden flex items-center relative"
            >
              <Search className="absolute left-2.5 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.6)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-28 sm:w-36 h-8 pl-8 pr-2 rounded-full font-body text-xs text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-[#D4A843] transition-all"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
              />
            </form>

            <button
              onClick={openCart}
              className="relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-300 hover:scale-105 cursor-pointer"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <ShoppingCart className="w-4 h-4 text-white" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold font-body"
                  style={{ backgroundColor: '#E63946', color: '#FFF' }}
                >
                  {totalItems}
                </span>
              )}
            </button>
            <a
              href="https://wa.me/595992120303"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 font-body font-semibold text-sm px-4 py-2 rounded-full transition-all duration-300 hover:scale-105"
              style={{
                backgroundColor: '#25D366',
                color: '#FFFFFF',
                letterSpacing: '0.04em',
              }}
            >
              WhatsApp
            </a>
            <button
              className="md:hidden text-white p-1"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[280px] p-6 pt-20" style={{ backgroundColor: 'var(--theme-primary, #1B4332)' }}>
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="block font-display text-xl text-white/90 hover:text-white py-4 border-b border-white/10 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={() => { setMobileOpen(false); openCart(); }}
              className="flex items-center gap-3 font-display text-xl text-white/90 hover:text-white py-4 border-b border-white/10 transition-colors text-left w-full cursor-pointer"
            >
              <ShoppingCart className="w-5 h-5" /> Carrito {totalItems > 0 && `(${totalItems})`}
            </button>
            <a
              href="https://wa.me/595992120303"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="block mt-6 text-center font-body font-semibold text-sm px-6 py-3 rounded-full"
              style={{ backgroundColor: '#25D366', color: '#FFFFFF' }}
            >
              WhatsApp
            </a>
          </div>
        </div>
      )}
    </>
  )
}
