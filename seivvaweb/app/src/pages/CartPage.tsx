import { Link, useNavigate } from 'react-router-dom'
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, Send } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { formatPrice } from '../services/api'

export default function CartPage() {
  const navigate = useNavigate()
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalPrice } = useCart()

  if (items.length === 0) {
    return (
      <main className="pt-24 pb-20" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)', minHeight: '100vh' }}>
        <div className="container-main text-center py-20">
          <ShoppingBag className="w-16 h-16 mx-auto mb-6" style={{ color: 'var(--theme-primary, #1B4332)' }} />
          <h1 className="font-display font-bold text-2xl mb-3" style={{ color: 'var(--theme-text, #3D2817)' }}>
            Tu carrito está vacío
          </h1>
          <p className="font-body mb-8" style={{ color: 'var(--theme-muted, #5C4033)' }}>
            Agregá productos para armar tu pedido.
          </p>
          <Link
            to="/tienda"
            className="inline-flex items-center gap-2 font-body font-semibold text-sm px-8 py-3 rounded-full"
            style={{ backgroundColor: 'var(--theme-primary, #1B4332)', color: 'var(--theme-text-on-primary, #FFFFFF)' }}
          >
            <ArrowLeft className="w-4 h-4" /> Ir a la tienda
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-20" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)', minHeight: '100vh' }}>
      <div className="container-main">
        <h1 className="font-display font-bold text-3xl mb-8" style={{ color: 'var(--theme-text, #3D2817)' }}>
          Tu Carrito ({totalItems})
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          {/* Items */}
          <div className="space-y-4">
            {items.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl"
                style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)', boxShadow: '0 2px 12px rgba(27,67,50,0.06)' }}
              >
                <Link to={`/producto/${product.slug || product.id}`} className="shrink-0">
                  <img
                    src={product.imagen}
                    alt={product.nombre}
                    className="w-24 h-24 object-contain rounded-xl"
                    style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }}
                  />
                </Link>

                <div className="flex-1 min-w-0">
                  <Link to={`/producto/${product.slug || product.id}`} className="block">
                    <h3 className="font-display font-semibold text-base leading-snug truncate" style={{ color: 'var(--theme-text, #3D2817)' }}>
                      {product.nombre}
                    </h3>
                  </Link>
                  <p className="font-body font-bold mt-1" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                    {formatPrice(product.precio)}
                  </p>

                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={() => updateQuantity(product.id, quantity - 1)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                      style={{ backgroundColor: 'var(--theme-border, #E8E0D5)', color: 'var(--theme-text, #3D2817)' }}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-body font-bold w-6 text-center" style={{ color: 'var(--theme-text, #3D2817)' }}>
                      {quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(product.id, quantity + 1)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                      style={{ backgroundColor: 'var(--theme-border, #E8E0D5)', color: 'var(--theme-text, #3D2817)' }}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between">
                  <button
                    onClick={() => removeItem(product.id)}
                    className="p-2 rounded-full transition-colors hover:bg-red-50"
                    style={{ color: '#E63946' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="font-body font-bold" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                    {formatPrice(product.precio * quantity)}
                  </span>
                </div>
              </div>
            ))}

            <button
              onClick={clearCart}
              className="font-body text-sm underline"
              style={{ color: 'var(--theme-muted, #999)' }}
            >
              Vaciar carrito
            </button>
          </div>

          {/* Summary */}
          <div
            className="p-6 rounded-2xl h-fit sticky top-24"
            style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)', boxShadow: '0 4px 24px rgba(27,67,50,0.08)' }}
          >
            <h2 className="font-display font-bold text-xl mb-6" style={{ color: 'var(--theme-text, #3D2817)' }}>
              Resumen
            </h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between font-body" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                <span>Subtotal ({totalItems} items)</span>
                <span>{formatPrice(totalPrice)}</span>
              </div>
              <div className="flex justify-between font-body" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                <span>Envío</span>
                <span style={{ color: 'var(--theme-primary, #1B4332)' }}>A coordinar</span>
              </div>
            </div>

            <div
              className="flex justify-between items-center pt-4 mb-6"
              style={{ borderTop: '1px solid rgba(61,40,23,0.1)' }}
            >
              <span className="font-display font-bold text-lg" style={{ color: 'var(--theme-text, #3D2817)' }}>Total</span>
              <span className="font-body font-bold text-2xl" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                {formatPrice(totalPrice)}
              </span>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              className="w-full flex items-center justify-center gap-3 font-body font-semibold text-sm sm:text-base px-4 py-3 sm:px-6 sm:py-4 rounded-full transition-all duration-300 hover:scale-105"
              style={{
                backgroundColor: 'var(--theme-primary, #1B4332)',
                color: 'var(--theme-text-on-primary, #FFFFFF)',
                boxShadow: '0 4px 24px rgba(27,67,50,0.25)',
              }}
            >
              <Send className="w-5 h-5" />
              Finalizar Pedido
            </button>

            <Link
              to="/tienda"
              className="block text-center mt-4 font-body font-medium text-sm"
              style={{ color: 'var(--theme-primary, #1B4332)' }}
            >
              Seguir comprando
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
