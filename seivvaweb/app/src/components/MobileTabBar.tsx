import { Link, useLocation } from 'react-router-dom'
import { Home, Store, MessageCircle, ShoppingCart, Menu } from 'lucide-react'
import { useCart } from '../context/CartContext'

export default function MobileTabBar() {
  const location = useLocation()
  const { totalItems, openCart } = useCart()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const openMobileMenu = () => {
    window.dispatchEvent(new CustomEvent('open-mobile-menu'))
  }

  const tabs = [
    { icon: Home, label: 'Inicio', to: '/', action: null },
    { icon: Store, label: 'Tienda', to: '/tienda', action: null },
    {
      icon: MessageCircle,
      label: 'WhatsApp',
      to: null,
      action: () => window.open('https://wa.me/595992120303', '_blank'),
      isCenter: true,
    },
    {
      icon: ShoppingCart,
      label: 'Carrito',
      to: null,
      action: () => openCart(),
      badge: totalItems,
    },
    { icon: Menu, label: 'Menú', to: null, action: openMobileMenu },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50">
      <div
        className="mx-auto max-w-lg rounded-t-3xl px-2 pb-safe"
        style={{
          backgroundColor: '#FDF8F0',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <div className="relative flex items-end justify-around h-[72px] pb-2">
          {tabs.map((tab, idx) => {
            const Icon = tab.icon
            const active = tab.to ? isActive(tab.to) : false

            if (tab.isCenter) {
              return (
                <button
                  key={idx}
                  onClick={tab.action || undefined}
                  className="relative -top-1 flex flex-col items-center justify-center cursor-pointer"
                >
                  <div
                    className="flex items-center justify-center w-14 h-14 rounded-full transition-transform duration-300 active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                      boxShadow: '0 8px 24px rgba(37,211,102,0.45)',
                      border: '4px solid #FDF8F0',
                    }}
                  >
                    <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] font-semibold mt-1" style={{ color: '#25D366' }}>
                    {tab.label}
                  </span>
                </button>
              )
            }

            const content = (
              <div className="flex flex-col items-center justify-center gap-0.5 py-1 px-2">
                <div className="relative">
                  <Icon
                    className="w-5 h-5 transition-colors duration-300"
                    style={{ color: active ? '#1B4332' : '#8B8B8B' }}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  {tab.badge ? (
                    <span
                      className="absolute -top-2 -right-2 flex items-center justify-center min-w-[16px] h-4 rounded-full text-[9px] font-bold"
                      style={{ backgroundColor: '#E63946', color: '#FFF', padding: '0 4px' }}
                    >
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  ) : null}
                </div>
                <span
                  className="text-[10px] font-medium transition-colors duration-300"
                  style={{ color: active ? '#1B4332' : '#8B8B8B' }}
                >
                  {tab.label}
                </span>
                {active && (
                  <div
                    className="absolute bottom-1 w-1 h-1 rounded-full"
                    style={{ backgroundColor: '#D4A843' }}
                  />
                )}
              </div>
            )

            return tab.to ? (
              <Link
                key={idx}
                to={tab.to}
                className="relative flex-1 flex items-center justify-center"
              >
                {content}
              </Link>
            ) : (
              <button
                key={idx}
                onClick={tab.action || undefined}
                className="relative flex-1 flex items-center justify-center cursor-pointer"
              >
                {content}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
