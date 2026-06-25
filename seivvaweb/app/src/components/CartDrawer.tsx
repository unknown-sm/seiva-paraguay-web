import { Link } from 'react-router-dom'
import { X, Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { formatPrice, getDiscountedPrice, getNextTier } from '../services/api'

export default function CartDrawer() {
  const { items, isOpen, removeItem, updateQuantity, closeCart, totalItems, totalPrice, totalSavings } = useCart()

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-300"
        style={{
          backgroundColor: 'rgba(0,0,0,0.4)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={closeCart}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-[201] flex flex-col overflow-y-auto transition-transform duration-300"
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: 'var(--theme-surface, #FFFFFF)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '1px solid var(--theme-border, #E8E0D5)' }}>
          <h2 className="font-display font-bold text-xl" style={{ color: 'var(--theme-text, #3D2817)' }}>
            Tu Carrito ({totalItems})
          </h2>
          <button
            onClick={closeCart}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
            style={{
              border: '1px solid var(--theme-border, #E8E0D5)',
              color: 'var(--theme-text, #3D2817)',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <ShoppingBag className="w-14 h-14 mb-4" style={{ color: 'var(--theme-muted, #5C4033)' }} />
              <p className="font-body text-base mb-1" style={{ color: 'var(--theme-text, #3D2817)' }}>
                Tu carrito está vacío
              </p>
              <p className="font-body text-sm" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                Agregá productos para armar tu pedido.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {items.map(({ product, quantity }) => {
                const discountedPrice = getDiscountedPrice(product, quantity)
                const hasDiscount = discountedPrice < product.precio
                return (
                <div
                  key={product.id}
                  className="flex gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)' }}
                >
                  <Link to={`/producto/${product.slug || product.id}`} onClick={closeCart} className="shrink-0">
                    <img
                      src={product.imagen}
                      alt={product.nombre}
                      className="w-16 h-16 object-contain rounded-lg"
                      style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }}
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link to={`/producto/${product.slug || product.id}`} onClick={closeCart}>
                      <h4 className="font-display font-semibold text-sm leading-snug truncate" style={{ color: 'var(--theme-text, #3D2817)' }}>
                        {product.nombre}
                      </h4>
                    </Link>
                    <div className="mt-1">
                      <p className="font-body font-bold text-sm" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                        {formatPrice(discountedPrice)}
                      </p>
                      {hasDiscount && (
                        <p className="font-body text-xs line-through" style={{ color: 'var(--theme-muted, #999)' }}>
                          {formatPrice(product.precio)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)', color: 'var(--theme-text, #3D2817)' }}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-body font-bold text-sm w-5 text-center" style={{ color: 'var(--theme-text, #3D2817)' }}>
                        {quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)', color: 'var(--theme-text, #3D2817)' }}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {(() => {
                      const next = getNextTier(product, quantity)
                      if (!next) return null
                      const needed = next.min_cantidad - quantity
                      return (
                        <p className="font-body text-xs mt-2" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                          Comprá {needed} más → {formatPrice(product.precio - next.descuento)} c/u (ahorrás {formatPrice(next.descuento)}/u)
                        </p>
                      )
                    })()}
                  </div>

                  <div className="flex flex-col items-end justify-between">
                    <button
                      onClick={() => removeItem(product.id)}
                      className="p-1.5 rounded-full transition-colors"
                      style={{ color: '#E63946' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-body font-bold text-sm" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                      {formatPrice(discountedPrice * quantity)}
                    </span>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-5 shrink-0" style={{ borderTop: '1px solid var(--theme-border, #E8E0D5)' }}>
            {totalSavings > 0 && (
              <div className="flex justify-between items-center mb-3 p-2 rounded-lg" style={{ backgroundColor: 'rgba(45,106,79,0.08)' }}>
                <span className="font-body text-sm font-medium" style={{ color: '#2D6A4F' }}>
                  Ahorrás con descuento por cantidad
                </span>
                <span className="font-body font-bold text-sm" style={{ color: '#2D6A4F' }}>
                  -{formatPrice(totalSavings)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center mb-4">
              <span className="font-body font-medium" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                Total ({totalItems} items)
              </span>
              <span className="font-display font-bold text-xl" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                {formatPrice(totalPrice)}
              </span>
            </div>

            <Link
              to="/carrito"
              onClick={closeCart}
              className="w-full flex items-center justify-center gap-2 font-body font-semibold text-sm px-5 py-3.5 rounded-full transition-all duration-300 hover:scale-105"
              style={{
                backgroundColor: 'var(--theme-primary, #1B4332)',
                color: 'var(--theme-text-on-primary, #FFFFFF)',
                boxShadow: '0 4px 16px rgba(27,67,50,0.25)',
              }}
            >
              Finalizar Pedido
            </Link>

            <Link
              to="/carrito"
              onClick={closeCart}
              className="flex items-center justify-center gap-2 w-full mt-3 font-body font-medium text-sm"
              style={{ color: 'var(--theme-primary, #1B4332)' }}
            >
              Ver carrito completo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
