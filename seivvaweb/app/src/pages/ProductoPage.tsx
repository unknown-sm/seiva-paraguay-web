import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchProducts, type Product, formatPrice } from '../services/api'
import { useCart } from '../context/CartContext'
import { ArrowLeft, ShoppingCart, Minus, Plus } from 'lucide-react'

export default function ProductoPage() {
  const { id } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addItem } = useCart()

  useEffect(() => {
    fetchProducts()
      .then(data => {
        const found = data.find(p => p.id === Number(id))
        setProduct(found || null)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return (
      <main className="pt-24 pb-20" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)', minHeight: '100vh' }}>
        <div className="container-main px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            <div className="aspect-square rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }} />
            <div className="space-y-4">
              <div className="h-6 w-24 rounded animate-pulse" style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }} />
              <div className="h-10 w-3/4 rounded animate-pulse" style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }} />
              <div className="h-6 w-32 rounded animate-pulse" style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }} />
              <div className="h-4 w-full rounded animate-pulse" style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }} />
              <div className="h-4 w-5/6 rounded animate-pulse" style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }} />
              <div className="h-12 w-40 rounded-full animate-pulse mt-4" style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }} />
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="pt-24 pb-20" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)', minHeight: '100vh' }}>
        <div className="container-main text-center">
          <h1 className="font-body font-bold text-3xl mb-4" style={{ color: '#E63946' }}>Error</h1>
          <p className="font-body mb-6" style={{ color: 'var(--theme-muted, #5C4033)' }}>{error}</p>
          <Link to="/tienda" className="font-body font-semibold text-sm px-8 py-3 rounded-full inline-block" style={{ backgroundColor: 'var(--theme-primary, #1B4332)', color: '#FFF' }}>
            Ver Tienda
          </Link>
        </div>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="pt-24 pb-20" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)', minHeight: '100vh' }}>
        <div className="container-main text-center">
          <h1 className="font-body font-bold text-3xl mb-4" style={{ color: 'var(--theme-text, #3D2817)' }}>Producto no encontrado</h1>
          <p className="font-body mb-6" style={{ color: 'var(--theme-muted, #5C4033)' }}>Este producto (ID: {id}) no está disponible actualmente.</p>
          <Link to="/tienda" className="font-body font-semibold text-sm px-8 py-3 rounded-full inline-block" style={{ backgroundColor: 'var(--theme-primary, #1B4332)', color: '#FFF' }}>
            Ver Tienda
          </Link>
        </div>
      </main>
    )
  }

  const descuento = product.precio_anterior
    ? Math.round((1 - product.precio / product.precio_anterior) * 100)
    : 0

  return (
    <main className="pt-24 pb-20" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)', minHeight: '100vh' }}>
      <div className="container-main">
        <Link to="/tienda" className="inline-flex items-center gap-2 font-body text-sm mb-8 hover:underline" style={{ color: 'var(--theme-primary, #2D6A4F)' }}>
          <ArrowLeft className="w-4 h-4" /> Volver a la tienda
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Image */}
          <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: 'var(--theme-border, #E8E0D5)', boxShadow: '0 8px 32px rgba(27,67,50,0.12)' }}>
            <img
              src={product.imagen}
              alt={product.nombre}
              className="w-full aspect-square object-contain p-4"
            />
          </div>

          {/* Details */}
          <div className="flex flex-col justify-center">
            {descuento > 0 && (
              <span className="self-start font-body font-bold text-xs px-3 py-1.5 rounded-full mb-4" style={{ backgroundColor: '#E63946', color: '#FFF' }}>
                AHORRÁ {descuento}%
              </span>
            )}

            <span className="font-body font-semibold text-xs tracking-[0.1em] mb-2" style={{ color: 'var(--theme-primary, #2D6A4F)' }}>
              {product.categoria.toUpperCase()}
            </span>

            <h1 className="font-body font-bold leading-tight" style={{ color: 'var(--theme-text, #3D2817)', fontSize: 'clamp(24px, 3.5vw, 36px)' }}>
              {product.nombre}
            </h1>

            <p className="font-body text-base leading-relaxed mt-4" style={{ color: 'var(--theme-muted, #5C4033)' }}>
              {product.descripcion || 'Producto natural de alta calidad. Consultános por WhatsApp para más información.'}
            </p>

            {/* Price */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-6">
              <span className="font-body font-bold" style={{ color: 'var(--theme-primary, #2D6A4F)', fontSize: 'clamp(24px, 3vw, 48px)' }}>
                {formatPrice(product.precio)}
              </span>
              {product.precio_anterior && (
                <span className="font-body text-sm sm:text-lg line-through" style={{ color: '#999' }}>
                  {formatPrice(product.precio_anterior)}
                </span>
              )}
            </div>

            {/* Tags */}
            {product.etiquetas && product.etiquetas.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {product.etiquetas.map(tag => (
                  <span
                    key={tag}
                    className="font-body font-semibold text-[11px] px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: tag === 'oferta' ? 'rgba(230,57,70,0.1)' : 'rgba(45,106,79,0.1)',
                      color: tag === 'oferta' ? '#E63946' : 'var(--theme-primary, #2D6A4F)',
                    }}
                  >
                    {tag === 'popular' ? 'Popular' : tag === 'oferta' ? 'En Oferta' : tag === 'nuevo' ? 'Nuevo' : tag}
                  </span>
                ))}
              </div>
            )}

            {/* Quantity + Add to Cart */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mt-8">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--theme-border, #E8E0D5)', color: 'var(--theme-text, #3D2817)' }}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-body font-bold w-8 text-center text-lg" style={{ color: 'var(--theme-text, #3D2817)' }}>
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--theme-border, #E8E0D5)', color: 'var(--theme-text, #3D2817)' }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => {
                  addItem(product, quantity)
                  setAdded(true)
                  setTimeout(() => setAdded(false), 2000)
                }}
                className="inline-flex items-center justify-center gap-2 font-body font-semibold text-sm sm:text-base px-5 py-3 sm:px-8 sm:py-4 rounded-full transition-all duration-300 hover:scale-105"
                style={{
                  backgroundColor: added ? '#2D6A4F' : '#D4A843',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 16px rgba(212,168,67,0.35)',
                  letterSpacing: '0.04em',
                }}
              >
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                {added ? 'Agregado!' : 'Agregar al carrito'}
              </button>
            </div>

            <Link
              to="/carrito"
              className="inline-block mt-4 font-body text-sm underline"
              style={{ color: 'var(--theme-primary, #2D6A4F)' }}
            >
              Ver carrito →
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
