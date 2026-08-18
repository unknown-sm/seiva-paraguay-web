import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchProducts, type Product, formatPrice, getProductBadges, getTierLabel } from '../services/api'
import { useCart } from '../context/CartContext'
import { Search, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react'
import ProductSkeleton from '../components/ProductSkeleton'

const CATEGORIAS = [
  { id: 'all', label: 'Todos' },
  { id: 'suplementos', label: 'Suplementos' },
  { id: 'combos', label: 'Combos' },
]

const PRODUCTS_PER_PAGE_OPTIONS = [10, 20, 30, 40, 50]

export default function TiendaPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [activeCat, setActiveCat] = useState('all')
  const [filterSubcat, setFilterSubcat] = useState(searchParams.get('subcategoria') || '')
  const [filterEtiqueta, setFilterEtiqueta] = useState(searchParams.get('etiqueta') || '')
  const [filterMarca, setFilterMarca] = useState(searchParams.get('marca') || '')
  const [page, setPage] = useState(1)
  const [productsPerPage, setProductsPerPage] = useState(10)
  const { addItem } = useCart()
  const navigate = useNavigate()

  useEffect(() => {
    fetchProducts()
      .then(data => {
        setProducts(data)
        setLoading(false)
      })
      .catch(() => {
        setProducts([])
        setLoading(false)
      })
  }, [])

  // Read URL params for filters
  useEffect(() => {
    const cat = searchParams.get('categoria')
    if (cat) setActiveCat(cat.toLowerCase())
    setFilterSubcat(searchParams.get('subcategoria') || '')
    setFilterEtiqueta(searchParams.get('etiqueta') || '')
    setFilterMarca(searchParams.get('marca') || '')
    setPage(1)
  }, [searchParams])

  const filtered = useMemo(() => {
    let result = products
    if (activeCat !== 'all') {
      result = result.filter(p => p.categoria.toLowerCase() === activeCat)
    }
    if (filterSubcat) {
      result = result.filter(p => p.subcategoria?.toLowerCase() === filterSubcat.toLowerCase())
    }
    if (filterEtiqueta) {
      result = result.filter(p => p.etiquetas?.some(e => e.toLowerCase() === filterEtiqueta.toLowerCase()))
    }
    if (filterMarca) {
      result = result.filter(p => p.marca?.toLowerCase() === filterMarca.toLowerCase())
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(q))
      )
    }
    // Productos con stock primero, agotados al final
    result = [...result].sort((a, b) => {
      const aHas = a.stock > 0 ? 0 : 1
      const bHas = b.stock > 0 ? 0 : 1
      return aHas - bHas
    })
    return result
  }, [products, activeCat, filterSubcat, filterEtiqueta, filterMarca, search])

  const totalPages = Math.ceil(filtered.length / productsPerPage)
  const paginated = useMemo(() => {
    const start = (page - 1) * productsPerPage
    return filtered.slice(start, start + productsPerPage)
  }, [filtered, page, productsPerPage])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [activeCat, filterSubcat, filterEtiqueta, filterMarca, search])

  // Sync search with URL params
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    if (urlSearch !== search) {
      setSearch(urlSearch)
    }
  }, [searchParams])

  const goPage = (p: number) => {
    if (p >= 1 && p <= totalPages) {
      setPage(p)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Build page numbers array (show max 5 around current)
  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return []
    const pages: (number | string)[] = []
    const add = (n: number) => pages.push(n)
    const dots = () => { if (pages[pages.length - 1] !== '...') pages.push('...') }

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) add(i)
    } else {
      add(1)
      if (page > 3) dots()
      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)
      for (let i = start; i <= end; i++) add(i)
      if (page < totalPages - 2) dots()
      add(totalPages)
    }
    return pages
  }, [totalPages, page])

  return (
    <main className="pt-20" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)', minHeight: '100vh' }}>
      <div className="container-main py-12">
        <div className="text-center mb-10">
          <h1 className="font-display font-bold leading-tight" style={{ color: 'var(--theme-text, #3D2817)', fontSize: 'clamp(28px, 4vw, 48px)' }}>
            Nuestra Tienda
          </h1>
          <p className="font-body text-base mt-3" style={{ color: 'var(--theme-muted, #5C4033)' }}>
            {products.length} productos naturales. Pedí por WhatsApp.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mx-auto mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--theme-muted, #999)' }} />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              if (e.target.value.trim()) {
                setSearchParams({ search: e.target.value.trim() })
              } else {
                setSearchParams({})
              }
            }}
            className="w-full pl-12 pr-4 py-3.5 rounded-full font-body text-sm border-0 outline-none"
            style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)', boxShadow: '0 2px 12px var(--theme-shadow-md, rgba(0,0,0,0.06))' }}
          />
        </div>

        {/* Active filters indicator */}
        {(filterSubcat || filterEtiqueta || filterMarca) && (
          <div className="flex flex-wrap justify-center items-center gap-2 mb-6">
            <span className="font-body text-sm" style={{ color: 'var(--theme-muted, #5C4033)' }}>Filtros activos:</span>
            {filterSubcat && (
              <span className="inline-flex items-center gap-1 font-body text-xs px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--theme-primary-bg-10, rgba(27,67,50,0.1))', color: 'var(--theme-primary, #1B4332)' }}>
                {filterSubcat}
                <button onClick={() => { setFilterSubcat(''); setSearchParams({}) }} className="ml-1 hover:opacity-70">×</button>
              </span>
            )}
            {filterEtiqueta && (
              <span className="inline-flex items-center gap-1 font-body text-xs px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(230,57,70,0.1)', color: '#E63946' }}>
                #{filterEtiqueta}
                <button onClick={() => { setFilterEtiqueta(''); setSearchParams({}) }} className="ml-1 hover:opacity-70">×</button>
              </span>
            )}
            {filterMarca && (
              <span className="inline-flex items-center gap-1 font-body text-xs px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--theme-primary-bg-10, rgba(27,67,50,0.1))', color: 'var(--theme-primary, #1B4332)' }}>
                {filterMarca}
                <button onClick={() => { setFilterMarca(''); setSearchParams({}) }} className="ml-1 hover:opacity-70">×</button>
              </span>
            )}
            <button 
              onClick={() => { setActiveCat('all'); setFilterSubcat(''); setFilterEtiqueta(''); setFilterMarca(''); setSearchParams({}) }}
              className="font-body text-xs underline" 
              style={{ color: 'var(--theme-muted, #5C4033)' }}
            >
              Limpiar todo
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {CATEGORIAS.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className="font-body font-semibold text-sm px-6 py-2.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor: activeCat === cat.id ? 'var(--theme-primary, #1B4332)' : 'var(--theme-surface, #FFFFFF)',
                color: activeCat === cat.id ? 'var(--theme-text-on-primary, #FFFFFF)' : 'var(--theme-text, #3D2817)',
                border: activeCat === cat.id ? 'none' : '1px solid rgba(61,40,23,0.15)',
                letterSpacing: '0.04em',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        {loading ? (
          <ProductSkeleton count={8} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 font-body" style={{ color: 'var(--theme-muted, #5C4033)' }}>
            No se encontraron productos con esos filtros.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
              {paginated.map(product => (
                <div
                  key={product.id}
                  className="group rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5"
                  style={{
                    backgroundColor: 'var(--theme-surface, #FDF8F0)',
                    boxShadow: '0 8px 32px rgba(27, 67, 50, 0.12)',
                    border: '1px solid rgba(27, 67, 50, 0.06)',
                  }}
                >
                  {/* Image - clickable */}
                    <div
                    className="aspect-square overflow-hidden cursor-pointer relative"
                    style={{ backgroundColor: 'var(--theme-border, #E8E0D5)' }}
                    onClick={() => navigate(`/producto/${product.slug || product.id}`)}
                  >
                    <img
                      src={product.imagen}
                      alt={product.nombre}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={(e) => {
                        const t = e.target as HTMLImageElement
                        if (!t.dataset.fallback) {
                          t.dataset.fallback = '1'
                          t.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23f0f0f0" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999" font-size="12">Sin imagen</text></svg>'
                        }
                      }}
                    />
                    {product.precio_anterior && (
                      <span
                        className="absolute bottom-2 right-2 font-body font-bold text-[9px] px-2 py-0.5 rounded-full z-10"
                        style={{ backgroundColor: '#E63946', color: '#FFF' }}
                      >
                        OFERTA
                      </span>
                    )}
                    {!product.stock && (
                      <div className="absolute inset-0 flex items-center justify-center z-[5]" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                        <span
                          className="font-body font-black text-xl sm:text-2xl px-6 py-3 rounded-xl tracking-widest"
                          style={{ backgroundColor: '#DC2626', color: '#FFFFFF', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
                        >
                          AGOTADO
                        </span>
                      </div>
                    )}
                    {product.stock > 0 && (() => {
                      const badges = getProductBadges(product)
                      if (!badges.length) return null
                      return (
                        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 z-10">
                          {badges.map(b => (
                            <span key={b.label} className="font-body font-semibold text-[8px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: b.color, color: '#fff' }}>
                              {b.label}
                            </span>
                          ))}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3
                      className="font-body font-semibold text-base leading-snug cursor-pointer"
                      style={{ color: 'var(--theme-text, #3D2817)' }}
                      onClick={() => navigate(`/producto/${product.slug || product.id}`)}
                    >
                      {product.nombre}
                    </h3>
                    <div className="flex flex-wrap items-baseline gap-x-2 mt-3">
                      <span className="font-body font-bold text-base sm:text-lg" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                        {formatPrice(product.precio)}
                      </span>
                      {product.precio_anterior && (
                        <span className="font-body text-[11px] sm:text-xs line-through" style={{ color: 'var(--theme-muted, #999)' }}>
                          {formatPrice(product.precio_anterior)}
                        </span>
                      )}
                    </div>
                    {product.price_tiers && product.price_tiers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {product.price_tiers.slice(0, 2).map((t, i) => (
                          <span key={i} className="font-body font-medium text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--theme-primary-bg-05, rgba(27,67,50,0.06))', color: 'var(--theme-primary, #1B4332)' }}>
                            {getTierLabel(t, product)}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        if (!product.stock) return
                        e.preventDefault()
                        e.stopPropagation()
                        addItem(product)
                      }}
                      disabled={!product.stock}
                      className="mt-3 w-full inline-flex items-center justify-center gap-2 font-body font-semibold text-xs px-4 py-2.5 rounded-full transition-all duration-300"
                      style={{
                        backgroundColor: product.stock ? 'var(--theme-accent, #D4A843)' : 'var(--theme-border, #E8E0D5)',
                        color: product.stock ? 'var(--theme-primary, #1B4332)' : 'var(--theme-muted, #999)',
                        letterSpacing: '0.04em',
                        cursor: product.stock ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {product.stock ? 'Agregar' : 'Agotado'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col items-center gap-4 mt-12">
                {/* Dot Navigation */}
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goPage(i + 1)}
                      className="w-2.5 h-2.5 rounded-full transition-all duration-200"
                      style={{
                        backgroundColor: page === i + 1 ? 'var(--theme-primary, #1B4332)' : 'var(--theme-border, #E8E0D5)',
                        transform: page === i + 1 ? 'scale(1.3)' : 'scale(1)',
                      }}
                      aria-label={`Ir a página ${i + 1}`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => goPage(page - 1)}
                  disabled={page === 1}
                  className="flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                >
                  <ChevronLeft className="w-4 h-4" style={{ color: 'var(--theme-text, #3D2817)' }} />
                </button>

                {pageNumbers.map((p, i) => (
                  p === '...' ? (
                    <span key={`dots-${i}`} className="font-body text-sm px-1" style={{ color: 'var(--theme-muted, #5C4033)' }}>...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goPage(p as number)}
                      className="flex items-center justify-center w-9 h-9 rounded-full font-body text-sm font-semibold transition-all duration-200 cursor-pointer"
                      style={{
                        backgroundColor: page === p ? 'var(--theme-primary, #1B4332)' : 'var(--theme-surface, #FFFFFF)',
                        color: page === p ? 'var(--theme-text-on-primary, #FFFFFF)' : 'var(--theme-text, #3D2817)',
                        boxShadow: page === p ? '0 4px 12px rgba(27,67,50,0.25)' : '0 2px 8px rgba(0,0,0,0.08)',
                      }}
                    >
                      {p}
                    </button>
                  )
                ))}

                <button
                  onClick={() => goPage(page + 1)}
                  disabled={page === totalPages}
                  className="flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                >
                  <ChevronRight className="w-4 h-4" style={{ color: 'var(--theme-text, #3D2817)' }} />
                </button>
                </div>

                {/* Products per page selector */}
                <div className="flex items-center gap-2">
                  <span className="font-body text-xs" style={{ color: 'var(--theme-muted, #5C4033)' }}>Productos por página:</span>
                  <select
                    value={productsPerPage}
                    onChange={e => {
                      setProductsPerPage(Number(e.target.value))
                      setPage(1)
                    }}
                    className="font-body text-xs px-2 py-1 rounded-lg border cursor-pointer"
                    style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)', borderColor: 'var(--theme-border, #E8E0D5)', color: 'var(--theme-text, #3D2817)' }}
                  >
                    {PRODUCTS_PER_PAGE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Showing info */}
            <p className="text-center mt-4 font-body text-xs" style={{ color: 'var(--theme-muted, #5C4033)' }}>
              Mostrando {paginated.length} de {filtered.length} productos
            </p>
          </>
        )}
      </div>
    </main>
  )
}
