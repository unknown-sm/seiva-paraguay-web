import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchProducts, type Product, formatPrice, getDiscountedPrice, getActiveTier, fixImageUrl, cleanHtml } from '../services/api'
import { useCart } from '../context/CartContext'
import { ShoppingCart, Minus, Plus, ChevronLeft, ChevronRight, Tag, Box, Info, Package, ChevronDown } from 'lucide-react'
import GlobalSections from '../components/GlobalSections'

function extractFirstParagraph(html: string): string {
  const blocks = html.split('\n\n').filter(b => b.trim())
  if (blocks.length <= 3) return html
  return blocks.slice(0, 3).join('\n\n')
}

function hasMoreParagraphs(html: string): boolean {
  const blocks = html.split('\n\n').filter(b => b.trim())
  return blocks.length > 3
}

function extractRestParagraphs(html: string): string {
  const blocks = html.split('\n\n').filter(b => b.trim())
  return blocks.slice(3).join('\n\n')
}

export default function ProductoPage() {
  const { slug } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [selectedImage, setSelectedImage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showShort, setShowShort] = useState(false)
  const [showLong, setShowLong] = useState(false)
  const { addItem } = useCart()

  useEffect(() => {
    fetchProducts()
      .then(data => {
        setAllProducts(data)
        // Try slug first, fallback to id for backward compat
        const found = data.find(p => p.slug === slug) || data.find(p => p.id === Number(slug))
        setProduct(found || null)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [slug])

  // SEO meta tags
  useEffect(() => {
    if (!product) return

    const originalTitle = document.title
    const metaDesc = document.querySelector('meta[name="description"]')
    const originalDesc = metaDesc?.getAttribute('content') || ''

    // Title
    document.title = `${product.nombre} - Seiva Paraguay`

    // Meta description
    if (metaDesc) {
      const desc = product.seo_descripcion || product.descripcion?.replace(/<[^>]*>/g, '').substring(0, 160) || ''
      metaDesc.setAttribute('content', desc)
    }

    // Open Graph tags
    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute('property', property)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    setMeta('og:title', product.nombre)
    setMeta('og:description', product.seo_descripcion || product.descripcion?.replace(/<[^>]*>/g, '').substring(0, 160) || '')
    setMeta('og:type', 'product')
    setMeta('og:url', window.location.href)
    if (product.imagen) setMeta('og:image', product.imagen)
    setMeta('product:price:amount', product.precio.toString())
    setMeta('product:price:currency', 'PYG')

    return () => {
      document.title = originalTitle
      if (metaDesc) metaDesc.setAttribute('content', originalDesc)
    }
  }, [product])

  const getCrosssell = (): Product[] => {
    if (!product || !allProducts.length) return []

    // 1. Manual crosssell (priority)
    if (product.crosssell && product.crosssell.length) {
      return product.crosssell
        .map(cid => allProducts.find(p => p.id === cid))
        .filter(Boolean) as Product[]
    }

    // 2. Smart fallback: same category + similar tags, exclude current product
    const candidates = allProducts
      .filter(p => p.id !== product.id && p.activo)
      .map(p => {
        let score = 0
        // Same category
        if (p.categoria === product.categoria) score += 3
        if (p.subcategoria === product.subcategoria) score += 2
        // Same brand
        if (product.marca && p.marca === product.marca) score += 2
        // Same tags
        const sharedTags = (product.etiquetas || []).filter(t => (p.etiquetas || []).includes(t))
        score += sharedTags.length
        return { product: p, score }
      })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(c => c.product)

    return candidates
  }

  const crosssell = getCrosssell()
  const allImages = product?.galeria?.length
    ? product.galeria.map((img: string) => fixImageUrl(img))
    : product?.imagen ? [product.imagen] : []

  const prevImage = () => setSelectedImage(i => (i > 0 ? i - 1 : allImages.length - 1))
  const nextImage = () => setSelectedImage(i => (i < allImages.length - 1 ? i + 1 : 0))

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
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (error || !product) {
    return (
      <main className="pt-24 pb-20" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)', minHeight: '100vh' }}>
        <div className="container-main text-center">
          <h1 className="font-body font-bold text-3xl mb-4" style={{ color: 'var(--theme-text, #3D2817)' }}>Producto no encontrado</h1>
          <Link to="/tienda" className="font-body font-semibold text-sm px-8 py-3 rounded-full inline-block" style={{ backgroundColor: 'var(--theme-primary, #1B4332)', color: 'var(--theme-text-on-primary, #FFFFFF)' }}>
            Ver Tienda
          </Link>
        </div>
      </main>
    )
  }

  const descuento = product.precio_anterior
    ? Math.round((1 - product.precio / product.precio_anterior) * 100)
    : 0

  const currentPrice = getDiscountedPrice(product, quantity)
  const activeTier = getActiveTier(product, quantity)
  const quantitySaving = product.precio - currentPrice

  return (
    <main className="pt-24 pb-20" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)', minHeight: '100vh' }}>
      <div className="container-main px-4">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 font-body text-sm mb-6 flex-wrap" aria-label="Breadcrumb">
          <Link to="/" className="hover:underline" style={{ color: 'var(--theme-muted, #5C4033)' }}>Inicio</Link>
          <span style={{ color: 'var(--theme-muted, #5C4033)' }}>/</span>
          <Link to="/tienda" className="hover:underline" style={{ color: 'var(--theme-muted, #5C4033)' }}>Tienda</Link>
          <span style={{ color: 'var(--theme-muted, #5C4033)' }}>/</span>
          <Link to={`/tienda?categoria=${encodeURIComponent(product.categoria)}`} className="hover:underline" style={{ color: 'var(--theme-muted, #5C4033)' }}>
            {product.categoria}
          </Link>
          {product.subcategoria && (
            <>
              <span style={{ color: 'var(--theme-muted, #5C4033)' }}>/</span>
              <Link to={`/tienda?categoria=${encodeURIComponent(product.categoria)}&subcategoria=${encodeURIComponent(product.subcategoria)}`} className="hover:underline" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                {product.subcategoria}
              </Link>
            </>
          )}
          <span style={{ color: 'var(--theme-muted, #5C4033)' }}>/</span>
          <span className="font-semibold truncate max-w-[200px]" style={{ color: 'var(--theme-text, #3D2817)' }}>
            {product.nombre}
          </span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Image Gallery */}
          <div>
            <div className="relative rounded-3xl overflow-hidden group" style={{ backgroundColor: 'var(--theme-border, #E8E0D5)', boxShadow: '0 8px 32px rgba(27,67,50,0.12)' }}>
              <img
                src={allImages[selectedImage]}
                alt={product.nombre}
                className="w-full aspect-square object-contain p-4"
              />
              {allImages.length > 1 && (
                <>
                  <button onClick={prevImage} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: 'var(--theme-text, #3D2817)' }}>
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={nextImage} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: 'var(--theme-text, #3D2817)' }}>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                {allImages.map((img: string, i: number) => (
                  <button key={i} onClick={() => setSelectedImage(i)}
                    className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all"
                    style={{ borderColor: selectedImage === i ? 'var(--theme-primary, #1B4332)' : 'transparent', opacity: selectedImage === i ? 1 : 0.6 }}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col justify-center">
            {descuento > 0 && (
              <span className="self-start font-body font-bold text-xs px-3 py-1.5 rounded-full mb-3" style={{ backgroundColor: '#E63946', color: '#FFF' }}>
                AHORRÁ {descuento}%
              </span>
            )}

            <Link 
              to={`/tienda?categoria=${encodeURIComponent(product.categoria)}`}
              className="self-start font-body font-semibold text-xs tracking-[0.1em] mb-2 hover:underline" 
              style={{ color: 'var(--theme-primary, #1B4332)' }}
            >
              {product.categoria.toUpperCase()}
            </Link>

            <h1 className="font-body font-bold leading-tight" style={{ color: 'var(--theme-text, #3D2817)', fontSize: 'clamp(24px, 3.5vw, 36px)' }}>
              {product.nombre}
            </h1>

            {/* Marca */}
            {product.marca && (
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="inline-flex items-center gap-1 font-body text-xs" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                  <Box className="w-3 h-3" /> {product.marca}
                </span>
              </div>
            )}

            <div className="relative">
              <div 
                className={`font-body text-base leading-relaxed mt-4 product-description ${!showShort ? 'line-clamp-4' : ''}`} 
                style={{ color: 'var(--theme-text, #3D2817)' }}
                dangerouslySetInnerHTML={{ __html: cleanHtml(product.descripcion) || 'Producto natural de alta calidad.' }}
              />
              <button
                onClick={() => setShowShort(!showShort)}
                className="inline-flex items-center gap-1 mt-2 font-body text-sm hover:opacity-80 transition-opacity"
                style={{ color: 'var(--theme-primary, #1B4332)' }}
              >
                {showShort ? 'Ver menos' : 'Ver más'}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showShort ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Long description */}
            {product.descripcion_larga && (
              <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--theme-border, #E8E0D5)' }}>
                <h3 className="font-body font-semibold text-lg mb-3" style={{ color: 'var(--theme-text, #3D2817)' }}>
                  Descripción detallada
                </h3>
                <div
                  className="font-body text-base leading-relaxed product-description"
                  style={{ color: 'var(--theme-text, #3D2817)' }}
                  dangerouslySetInnerHTML={{ __html: cleanHtml(product.descripcion_larga) }}
                />
              </div>
            )}

            {/* Price */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-6">
              <span className="font-body font-bold" style={{ color: 'var(--theme-primary, #1B4332)', fontSize: 'clamp(28px, 3vw, 48px)' }}>
                {formatPrice(currentPrice)}
              </span>
              {currentPrice < product.precio && (
                <span className="font-body text-sm sm:text-lg line-through" style={{ color: 'var(--theme-muted, #999)' }}>
                  {formatPrice(product.precio)}
                </span>
              )}
              {product.precio_anterior && currentPrice >= product.precio && (
                <span className="font-body text-sm sm:text-lg line-through" style={{ color: 'var(--theme-muted, #999)' }}>
                  {formatPrice(product.precio_anterior)}
                </span>
              )}
            </div>
            {quantitySaving > 0 && (
              <p className="font-body font-semibold text-sm mt-1" style={{ color: '#2D6A4F' }}>
                Ahorrás {formatPrice(quantitySaving)} por unidad
              </p>
            )}

            {/* Quantity Discount Table */}
            {product.stock > 0 && product.price_tiers && product.price_tiers.length > 0 && (
              <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--theme-primary-bg-05, rgba(27,67,50,0.05))', border: '1px solid var(--theme-primary-bg-10, rgba(27,67,50,0.1))' }}>
                <h3 className="font-body font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                  <Tag className="w-4 h-4" /> Descuento por cantidad
                </h3>
                <div className="space-y-1.5">
                  {product.price_tiers.map((tier, i) => {
                    const isActive = activeTier === tier
                    const tierPrice = product.precio - tier.descuento
                    return (
                      <div 
                        key={i} 
                        className="flex items-center justify-between px-3 py-2 rounded-lg transition-all text-sm"
                        style={{ 
                          backgroundColor: isActive ? 'var(--theme-primary, #1B4332)' : 'transparent',
                          color: isActive ? 'var(--theme-text-on-primary, #FFFFFF)' : 'var(--theme-text, #3D2817)',
                          fontWeight: isActive ? 600 : 400
                        }}
                      >
                        <span>
                          {tier.min_cantidad} {tier.max_cantidad ? `- ${tier.max_cantidad}` : 'o más'} unid.
                        </span>
                        <span className="font-body font-bold">
                          {formatPrice(tierPrice)}
                          <span className="font-normal text-xs ml-1 opacity-75">
                            (-{formatPrice(tier.descuento)})
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tags */}
            {product.etiquetas && product.etiquetas.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {product.etiquetas.map(tag => (
                  <Link 
                    key={tag} 
                    to={`/tienda?etiqueta=${encodeURIComponent(tag)}`}
                    className="font-body font-semibold text-[11px] px-3 py-1 rounded-full hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: ['nuevo', 'popular'].includes(tag) ? 'rgba(45,106,79,0.1)' : 'rgba(230,57,70,0.1)',
                      color: ['nuevo', 'popular'].includes(tag) ? 'var(--theme-primary, #1B4332)' : '#E63946',
                    }}
                  >
                    <Tag className="w-3 h-3 inline mr-1" />
                    {tag}
                  </Link>
                ))}
              </div>
            )}

            {/* Quantity + Add to Cart */}
            {product.stock > 0 ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mt-8">
                <div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="w-10 h-10 rounded-full flex items-center justify-center border"
                      style={{ borderColor: 'var(--theme-border, #E8E0D5)', color: 'var(--theme-text, #3D2817)' }}>
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-body font-bold w-8 text-center text-lg" style={{ color: 'var(--theme-text, #3D2817)' }}>{quantity}</span>
                    <button onClick={() => setQuantity(q => q + 1)}
                      className="w-10 h-10 rounded-full flex items-center justify-center border"
                      style={{ borderColor: 'var(--theme-border, #E8E0D5)', color: 'var(--theme-text, #3D2817)' }}>
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {product.price_tiers && product.price_tiers.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {product.price_tiers.map((tier, i) => (
                        <button
                          key={i}
                          onClick={() => setQuantity(tier.min_cantidad)}
                          className="font-body text-xs px-2.5 py-1 rounded-full border transition-all"
                          style={{
                            borderColor: quantity === tier.min_cantidad ? 'var(--theme-primary, #1B4332)' : 'var(--theme-border, #E8E0D5)',
                            backgroundColor: quantity === tier.min_cantidad ? 'var(--theme-primary, #1B4332)' : 'transparent',
                            color: quantity === tier.min_cantidad ? 'var(--theme-text-on-primary, #FFFFFF)' : 'var(--theme-muted, #5C4033)',
                          }}
                        >
                          {tier.min_cantidad}u
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => { addItem(product, quantity); setAdded(true); setTimeout(() => setAdded(false), 2000) }}
                  className="inline-flex items-center justify-center gap-2 font-body font-semibold text-sm px-8 py-4 rounded-full transition-all duration-300 hover:scale-105 hover:opacity-90"
                  style={{ backgroundColor: 'var(--theme-primary, #1B4332)', color: 'var(--theme-text-on-primary, #FFFFFF)', boxShadow: '0 4px 16px var(--theme-primary-shadow, rgba(27,67,50,0.35))' }}>
                  <ShoppingCart className="w-4 h-4" />
                  {added ? 'Agregado!' : 'Agregar al carrito'}
                </button>
              </div>
            ) : (
              <div className="mt-8">
                <button disabled
                  className="inline-flex items-center justify-center gap-2 font-body font-semibold text-sm px-8 py-4 rounded-full opacity-50"
                  style={{ backgroundColor: 'var(--theme-border, #E8E0D5)', color: 'var(--theme-muted, #999)', cursor: 'not-allowed' }}>
                  <ShoppingCart className="w-4 h-4" />
                  Producto agotado
                </button>
              </div>
            )}

            {/* Stock */}
            <div className="flex flex-wrap items-center gap-4 mt-4">
              <span className="inline-flex items-center gap-1.5 font-body text-sm" style={{ color: product.stock > 0 ? '#2D6A4F' : '#E63946' }}>
                <Package className="w-4 h-4" />
                {product.stock > 0 ? `${product.stock} disponibles` : 'Agotado'}
              </span>
            </div>

            <Link to="/carrito" className="inline-block mt-4 font-body text-sm underline" style={{ color: 'var(--theme-primary, #1B4332)' }}>
              Ver carrito →
            </Link>
          </div>
        </div>

        {/* Descripcion larga + Secciones globales */}
        <section className="mt-16 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Columna izquierda: Descripción larga */}
            <div className="lg:col-span-2">
              {product.descripcion_larga ? (
                <div className="rounded-2xl p-8" style={{ backgroundColor: 'var(--theme-surface, #FFF)', boxShadow: '0 2px 16px rgba(27,67,50,0.06)' }}>
                  <h2 className="font-serif text-2xl mb-6 flex items-center gap-2" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                    <Info className="w-5 h-5" /> Descripción
                  </h2>
                  <div
                    className="font-body text-sm leading-relaxed whitespace-pre-line [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1"
                    style={{ color: 'var(--theme-text, #3D2817)' }}
                    dangerouslySetInnerHTML={{ __html: extractFirstParagraph(product.descripcion_larga) }}
                  />
                  {hasMoreParagraphs(product.descripcion_larga) && (
                    <>
                      <div
                        className={`overflow-hidden transition-all duration-400 ${showLong ? 'max-h-[5000px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}
                      >
                        <div
                          className="font-body text-sm leading-relaxed whitespace-pre-line [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1"
                          style={{ color: 'var(--theme-text, #3D2817)' }}
                          dangerouslySetInnerHTML={{ __html: extractRestParagraphs(product.descripcion_larga) }}
                        />
                      </div>
                      <button
                        onClick={() => setShowLong(!showLong)}
                        className="inline-flex items-center gap-1 mt-3 font-body text-sm hover:opacity-80 transition-opacity"
                        style={{ color: 'var(--theme-primary, #1B4332)' }}
                      >
                        {showLong ? 'Leer menos' : 'Leer más'}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showLong ? 'rotate-180' : ''}`} />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl p-8" style={{ backgroundColor: 'var(--theme-surface, #FFF)', boxShadow: '0 2px 16px rgba(27,67,50,0.06)' }}>
                  <h2 className="font-serif text-2xl mb-6 flex items-center gap-2" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                    <Info className="w-5 h-5" /> Descripción
                  </h2>
                  <p className="font-body text-sm" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                    {product.descripcion?.replace(/<[^>]*>/g, '') || 'Producto natural de alta calidad.'}
                  </p>
                </div>
              )}
            </div>

            {/* Columna derecha: Secciones globales */}
            <div className="lg:col-span-1">
              <GlobalSections />
            </div>
          </div>
        </section>

        {/* Crosssell */}
        {crosssell.length > 0 && (
          <section className="mt-16">
            <h2 className="font-serif text-2xl mb-8 text-center" style={{ color: 'var(--theme-primary, #1B4332)' }}>
              También te puede interesar
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
              {crosssell.map(p => (
                <Link key={p.id} to={`/producto/${p.slug || p.id}`}
                  className="group rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
                  style={{ backgroundColor: 'var(--theme-surface, #FFF)', boxShadow: '0 2px 12px rgba(27,67,50,0.06)' }}>
                  <div className="aspect-square overflow-hidden" style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }}>
                    <img src={p.imagen} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-4">
                    <p className="font-body text-xs mb-1" style={{ color: 'var(--theme-primary, #1B4332)' }}>{p.categoria}</p>
                    <h3 className="font-body font-semibold text-sm leading-tight line-clamp-2 mb-2" style={{ color: 'var(--theme-text, #3D2817)' }}>{p.nombre}</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="font-body font-bold text-sm" style={{ color: 'var(--theme-primary, #1B4332)' }}>{formatPrice(p.precio)}</span>
                      {p.precio_anterior && <span className="font-body text-xs line-through" style={{ color: 'var(--theme-muted, #999)' }}>{formatPrice(p.precio_anterior)}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
