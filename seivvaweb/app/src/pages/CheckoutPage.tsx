import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Check, MapPin, CreditCard, MessageCircle, Package, ShoppingCart } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { formatPrice, createPedido, fetchProducts, type Product } from '../services/api'
import type { CartItem } from '../context/CartContext'
import { ciudadesParaguay, parseCiudadSeleccionada } from '../data/ciudades'

// LocalStorage helpers for persisting checkout form
const CHECKOUT_STORAGE_KEY = 'seiva_checkout_form'
function saveCheckoutForm(data: Record<string, string>) {
  try { localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(data)) } catch(e) {}
}
function loadCheckoutForm(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CHECKOUT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch(e) { return {} }
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items, clearCart, totalPrice, totalSavings, getEffectiveUnitPrice } = useCart()

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0 && !pedidoId) {
      navigate('/carrito')
    }
  }, [items])

  // Form fields — matching WooCommerce fields minus email
  const [telefono, setTelefono] = useState('')
  const [codigoPais, setCodigoPais] = useState('+595')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [direccion, setDireccion] = useState('')
  const [ciudadSeleccionada, setCiudadSeleccionada] = useState('')
  const [ciudadInput, setCiudadInput] = useState('')
  const [showCiudadDropdown, setShowCiudadDropdown] = useState(false)
  const [ruc, setRuc] = useState('')
  const [metodoPago, setMetodoPago] = useState('whatsapp')
  const [sending, setSending] = useState(false)
  const [pedidoId, setPedidoId] = useState<number | null>(null)
  const [pedidoCompletado, setPedidoCompletado] = useState<{
    items: CartItem[]
    envioCosto: number
    envioTipo: 'delivery' | 'encomienda'
    envioGratis: boolean
    totalConEnvio: number
    ciudad: string
    departamento: string
    direccion: string
    ruc: string
    nombre: string
    apellido: string
    telefono: string
    codigoPais: string
    metodoPago: string
  } | null>(null)
  const [crossSell, setCrossSell] = useState<Product[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [envioCosto, setEnvioCosto] = useState(0)
  const [envioCiudad, setEnvioCiudad] = useState('')
  const [envioTipo, setEnvioTipo] = useState<'delivery' | 'encomienda'>('delivery')
  const [envioMinimoGratis, setEnvioMinimoGratis] = useState(0)
  const [qrInfo, setQrInfo] = useState<{ activo: boolean; imagen: string; instrucciones: string }>({ activo: false, imagen: '', instrucciones: '' })
  const [pagosInstrucciones, setPagosInstrucciones] = useState('')
  const [transferenciaInstrucciones, setTransferenciaInstrucciones] = useState('')
  const [metodosPago, setMetodosPago] = useState<{ whatsapp: boolean; efectivo: boolean; transferencia: boolean }>({ whatsapp: true, efectivo: true, transferencia: true })

  // Load saved form data from localStorage on mount
  useEffect(() => {
    const saved = loadCheckoutForm()
    if (saved.nombre) setNombre(saved.nombre)
    if (saved.apellido) setApellido(saved.apellido)
    if (saved.telefono) setTelefono(saved.telefono)
    if (saved.ruc) setRuc(saved.ruc)
    if (saved.direccion) setDireccion(saved.direccion)
    if (saved.ciudadSeleccionada) setCiudadSeleccionada(saved.ciudadSeleccionada)
    if (saved.metodoPago) setMetodoPago(saved.metodoPago)
  }, [])

  // Save form data to localStorage on changes
  useEffect(() => {
    saveCheckoutForm({ nombre, apellido, telefono, ruc, direccion, ciudadSeleccionada, metodoPago })
  }, [nombre, apellido, telefono, ruc, direccion, ciudadSeleccionada, metodoPago])

  useEffect(() => {
    if (!ciudadSeleccionada) { setEnvioCosto(0); setEnvioCiudad(''); setEnvioTipo('delivery'); return }
    const { ciudad: soloCiudad } = parseCiudadSeleccionada(ciudadSeleccionada)
    fetch('/api/envios').then(r => r.json()).then((data) => {
      const match = data.find((e: any) =>
        e.ciudad.toLowerCase() === soloCiudad.toLowerCase()
      )
      const fallback = data.find((e: any) => e.ciudad === 'Otra ciudad')
      const result = match || fallback
      if (result) {
        setEnvioCosto(result.costo)
        setEnvioCiudad(result.tipo === 'encomienda' ? 'Encomienda' : soloCiudad)
        setEnvioTipo(result.tipo || 'delivery')
      }
    }).catch(() => {})
  }, [ciudadSeleccionada])

   useEffect(() => {
     fetch('/api/contenido').then(r => r.json()).then((data) => {
       if (data.qr_activo === '1' || data.qr_activo === 'true') {
         setQrInfo({ activo: true, imagen: data.qr_imagen || '', instrucciones: data.qr_instrucciones || '' })
       }
       setEnvioMinimoGratis(parseInt(data.envio_minimo_gratis) || 0)
       if (data.pagos_instrucciones) setPagosInstrucciones(data.pagos_instrucciones)
       if (data.transferencia_instrucciones) setTransferenciaInstrucciones(data.transferencia_instrucciones)
       setMetodosPago({
         whatsapp: data.whatsapp_activo !== '0',
         efectivo: data.efectivo_activo !== '0',
         transferencia: data.transferencia_activo !== '0'
       })
     }).catch(() => {})
   }, [])

  const ciudadRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ciudadRef.current && !ciudadRef.current.contains(e.target as Node)) {
        setShowCiudadDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredCiudades = useMemo(() => {
    const query = ciudadInput.trim().toLowerCase()
    if (!query) return ciudadesParaguay
    return ciudadesParaguay.filter(c =>
      c.ciudad.toLowerCase().includes(query) ||
      c.departamento.toLowerCase().includes(query)
    )
  }, [ciudadInput])

  const groupedCiudades = useMemo(() => {
    const groups: Record<string, typeof ciudadesParaguay> = {}
    for (const c of filteredCiudades) {
      if (!groups[c.departamento]) groups[c.departamento] = []
      groups[c.departamento].push(c)
    }
    return groups
  }, [filteredCiudades])

  const handleSelectCiudad = (value: string, label: string) => {
    setCiudadSeleccionada(value)
    setCiudadInput(label)
    setShowCiudadDropdown(false)
    setErrors(prev => ({ ...prev, ciudad: '' }))
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!telefono.trim()) newErrors.telefono = 'Ingresá tu teléfono'
    if (!nombre.trim()) newErrors.nombre = 'Ingresá tu nombre'
    if (!apellido.trim()) newErrors.apellido = 'Ingresá tu apellido'
    if (!direccion.trim()) newErrors.direccion = 'Ingresá tu dirección'
    if (!ciudadSeleccionada.trim()) newErrors.ciudad = 'Seleccioná tu ciudad y departamento'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

    const envioGratis = envioTipo === 'delivery' && (
      (envioMinimoGratis > 0 && totalPrice >= envioMinimoGratis) ||
      items.some(i => i.product.delivery_gratis)
    );
    const envioTotal = envioTipo === 'delivery' ? (envioGratis ? 0 : envioCosto) : 0
    const totalConEnvio = totalPrice + envioTotal

  const handleSubmitPedido = async () => {
    if (!validate()) return
    setSending(true)
    try {
      const productos = items.map(i => {
        const unit = getEffectiveUnitPrice(i)
        return {
          id: i.product.id,
          nombre: i.product.nombre,
          precio: unit,
          cantidad: i.quantity
        }
      })
      const { departamento, ciudad } = parseCiudadSeleccionada(ciudadSeleccionada)
      const result = await createPedido({
        cliente: `${nombre} ${apellido}`,
        whatsapp: codigoPais + telefono,
        direccion: `${direccion}, ${ciudad}, ${departamento}${ruc ? `, RUC: ${ruc}` : ''}`,
        productos,
        total: totalConEnvio,
        metodo_pago: metodoPago,
      })
      setPedidoId(result.id)
      // Snapshot del pedido ANTES de limpiar el carrito
      setPedidoCompletado({
        items: [...items],
        envioCosto,
        envioTipo,
        envioGratis: envioGratis || false,
        totalConEnvio,
        ciudad,
        departamento,
        direccion,
        ruc,
        nombre,
        apellido,
        telefono,
        codigoPais,
        metodoPago,
      })

      // Cargar cross-sell basado en marcas del carrito
      try {
        const allProducts = await fetchProducts()
        const marcasCompradas = new Set(items.map(i => i.product.marca).filter(Boolean))
        const categoriasCompradas = new Set(items.map(i => i.product.categoria).filter(Boolean))
        const idsComprados = new Set(items.map(i => i.product.id))
        const candidatos = allProducts
          .filter(p => p.activo && p.stock > 0 && !idsComprados.has(p.id))
          .map(p => {
            let score = 0
            if (p.marca && marcasCompradas.has(p.marca)) score += 3
            if (p.categoria && categoriasCompradas.has(p.categoria)) score += 2
            return { product: p, score }
          })
          .filter(c => c.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 4)
          .map(c => c.product)
        setCrossSell(candidatos)
      } catch {
        setCrossSell([])
      }

      // Precomputar mensaje ANTES de clearCart (captura items en closure seguro)
      const lines = items.map(i => {
        const unit = getEffectiveUnitPrice(i)
        const lineTotal = unit * i.quantity
        const ahorro = (i.product.precio - unit) * i.quantity
        let s = `• ${i.product.nombre} x${i.quantity} = ${formatPrice(lineTotal)}`
        if (ahorro > 0) s += ` (ahorra ${formatPrice(ahorro)})`
        return s
      })
      const envioLine = envioTipo === 'delivery'
        ? (envioGratis ? '\n*Delivery:* Gratis' : `\n*Delivery:* ${formatPrice(envioCosto)}`)
        : '\n*Envío:* Encomienda (a consultar)'
      const metodoPagoLabel: Record<string, string> = {
        whatsapp: 'WhatsApp (a coordinar)',
        efectivo: 'Efectivo al recibir',
        transferencia: 'Transferencia bancaria',
        qr: 'Pago QR',
      }
      const rucLine = ruc ? `\n*RUC:* ${ruc}` : ''
      const msg = encodeURIComponent(
        `Hola Seiva! Acabo de hacer el pedido #${result.id}:\n\n${lines.join('\n')}${envioLine}\n\n*Total: ${formatPrice(totalConEnvio)}*\n\n*Cliente:*\n${nombre} ${apellido}\n*Teléfono:* ${codigoPais} ${telefono}${rucLine}\n\n*Ciudad:* ${ciudad}\n*Departamento:* ${departamento}\n*Dirección:* ${direccion}\n\n*Pago:* ${metodoPagoLabel[metodoPago] || metodoPago}`
      )

      clearCart()

      setTimeout(() => {
        window.open(`https://wa.me/595992120303?text=${msg}`, '_blank')
      }, 1500)
    } catch (e) {
      alert('Error al enviar el pedido. Intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  if (pedidoId && pedidoCompletado) {
    const { items: pedidoItems, totalConEnvio: totalFinal, envioTipo: eTipo, envioCosto: eCosto, envioGratis: eGratis, ciudad: eCiudad, departamento: eDepto, direccion: eDir, ruc: eRuc, nombre: eNom, apellido: eApe, telefono: eTel, codigoPais: eCod, metodoPago: eMet } = pedidoCompletado
    const metodoPagoLabel: Record<string, string> = {
      whatsapp: 'WhatsApp (a coordinar)',
      efectivo: 'Efectivo al recibir',
      transferencia: 'Transferencia bancaria',
      qr: 'Pago QR',
    }
    return (
      <main className="min-h-screen" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)' }}>
        <div className="container-main max-w-3xl mx-auto pt-20 pb-20 px-4">
          {/* Hero success */}
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#d1fae5' }}>
              <Check className="w-10 h-10" style={{ color: '#065f46' }} />
            </div>
            <h1 className="font-body font-bold text-2xl sm:text-3xl mb-3" style={{ color: 'var(--theme-text, #3D2817)' }}>
              ¡Gracias por tu compra!
            </h1>
            <p className="font-body mb-2" style={{ color: 'var(--theme-muted, #5C4033)' }}>
              Tu pedido <strong>#{pedidoId}</strong> fue enviado correctamente.
            </p>
            <p className="font-body mb-6" style={{ color: 'var(--theme-muted, #5C4033)' }}>
              Te abrimos WhatsApp para que confirmes el pago y la entrega.
            </p>
            <a
              href={`https://wa.me/595992120303?text=${encodeURIComponent(`Hola Seiva! Quiero confirmar mi pedido #${pedidoId}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-body font-semibold text-sm px-6 py-3 rounded-full"
              style={{ backgroundColor: '#25D366', color: '#FFFFFF' }}
            >
              <MessageCircle className="w-4 h-4" />
              Confirmar por WhatsApp
            </a>
          </div>

          {/* Resumen del pedido */}
          <div className="mt-8 rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            <h2 className="font-body font-bold text-lg mb-4" style={{ color: 'var(--theme-text, #3D2817)' }}>
              Resumen del pedido #{pedidoId}
            </h2>

            {/* Items */}
            <div className="space-y-3 mb-5">
              {pedidoItems.map(({ product, quantity }) => {
                const unit = getEffectiveUnitPrice({ product, quantity })
                return (
                  <div key={product.id} className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid rgba(61,40,23,0.08)' }}>
                    <img src={product.imagen} alt={product.nombre} className="w-14 h-14 object-contain rounded-lg" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-medium truncate" style={{ color: 'var(--theme-text, #3D2817)' }}>
                        {product.nombre}
                      </p>
                      <p className="font-body text-xs" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                        {quantity} × {formatPrice(unit)}
                      </p>
                    </div>
                    <span className="font-body font-semibold text-sm" style={{ color: 'var(--theme-text, #3D2817)' }}>
                      {formatPrice(unit * quantity)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Datos del cliente */}
            <div className="space-y-2 mb-5 text-sm font-body" style={{ color: 'var(--theme-muted, #5C4033)' }}>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold" style={{ color: 'var(--theme-text, #3D2817)' }}>{eNom} {eApe}</p>
                  <p>{eDir}</p>
                  <p>{eCiudad}, {eDepto}</p>
                  {eRuc && <p>RUC: {eRuc}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <MessageCircle className="w-4 h-4" />
                <span>{eCod} {eTel}</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span>{metodoPagoLabel[eMet] || eMet}</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span>
                  {eTipo === 'delivery' ? `Delivery${eGratis ? ' (Gratis)' : ` (${formatPrice(eCosto)})`}` : 'Encomienda (a consultar)'}
                </span>
              </div>
            </div>

            {/* Total */}
            <div className="pt-4 flex justify-between items-center" style={{ borderTop: '2px solid rgba(61,40,23,0.1)' }}>
              <span className="font-body font-bold text-base" style={{ color: 'var(--theme-text, #3D2817)' }}>Total</span>
              <span className="font-body font-bold text-xl" style={{ color: 'var(--theme-primary, #1B4332)' }}>{formatPrice(totalFinal)}</span>
            </div>
          </div>

          {/* Payment Instructions on confirmation */}
          {(eMet === 'transferencia' && transferenciaInstrucciones) && (
            <div className="mt-8 rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
              <h2 className="font-body font-bold text-lg mb-4" style={{ color: 'var(--theme-text, #3D2817)' }}>
                Datos para transferencia
              </h2>
              <div className="font-body text-sm prose prose-sm" style={{ color: 'var(--theme-muted, #5C4033)' }} dangerouslySetInnerHTML={{ __html: transferenciaInstrucciones }} />
            </div>
          )}

          {(eMet === 'qr' && qrInfo.imagen) && (
            <div className="mt-8 rounded-xl p-6 text-center" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
              <h2 className="font-body font-bold text-lg mb-4" style={{ color: 'var(--theme-text, #3D2817)' }}>
                Escaneá el QR para pagar
              </h2>
              <img src={qrInfo.imagen} alt="QR de pago" className="mx-auto rounded-lg" style={{ maxWidth: 200, maxHeight: 200 }} />
              {qrInfo.instrucciones && (
                <p className="font-body text-sm mt-3" style={{ color: 'var(--theme-muted, #5C4033)' }}>{qrInfo.instrucciones}</p>
              )}
            </div>
          )}

          {/* Cross-sell */}
          {crossSell.length > 0 && (
            <div className="mt-10">
              <div className="text-center mb-6">
                <div className="font-body font-semibold text-xs tracking-[0.1em] mb-2" style={{ color: 'var(--theme-accent, #D4A843)' }}>
                  TAMBIÉN TE PUEDE INTERESAR
                </div>
                <h2 className="font-display font-bold text-2xl" style={{ color: 'var(--theme-text, #3D2817)' }}>
                  Complementa tu compra
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {crossSell.map((product) => (
                  <Link
                    key={product.id}
                    to={`/producto/${product.slug || product.id}`}
                    className="group rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 flex flex-col"
                    style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(45, 106, 79, 0.10)' }}
                  >
                    <div className="relative rounded-xl overflow-hidden mb-3" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)', border: '1px solid var(--theme-border, #F0EDE8)', height: '160px' }}>
                      <img
                        src={product.imagen}
                        alt={product.nombre}
                        className="absolute inset-0 w-full h-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                    <h3 className="font-body font-semibold text-sm leading-snug line-clamp-2" style={{ color: 'var(--theme-text, #1A1A1A)' }}>
                      {product.nombre}
                    </h3>
                    <div className="mt-auto pt-2">
                      <span className="font-body font-bold text-base" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                        {formatPrice(product.precio)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Botones finales */}
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/tienda"
              className="inline-flex items-center justify-center gap-2 font-body font-semibold text-sm px-6 py-3 rounded-full"
              style={{ backgroundColor: 'var(--theme-primary, #1B4332)', color: 'var(--theme-text-on-primary, #FFFFFF)' }}
            >
              <ShoppingCart className="w-4 h-4" />
              Seguir comprando
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 font-body font-semibold text-sm px-6 py-3 rounded-full"
              style={{ backgroundColor: '#FFFFFF', color: 'var(--theme-primary, #1B4332)', border: '2px solid var(--theme-primary, #1B4332)' }}
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)' }}>
      <div className="container-main max-w-6xl mx-auto pt-16 pb-20 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="font-body font-bold text-xl" style={{ color: 'var(--theme-primary, #1B4332)' }}>
            🌿 Seiva
          </Link>
          <div className="flex items-center gap-2 text-sm font-body" style={{ color: 'var(--theme-muted, #5C4033)' }}>
            <Lock className="w-4 h-4" />
            <span>Compra segura</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-12">
          {/* Left: Form */}
          <div className="order-2 lg:order-1">
            <h1 className="font-body font-bold text-xl mb-6" style={{ color: 'var(--theme-text, #3D2817)' }}>
              Información de facturación y envío
            </h1>

            <div className="space-y-6">
              <div className="rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)' }}>
                <h2 className="font-body font-bold text-base mb-4" style={{ color: 'var(--theme-text, #3D2817)' }}>
                  Contacto y dirección de envío
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block font-body text-sm font-medium mb-1.5" style={{ color: 'var(--theme-text, #3D2817)' }}>
                      Teléfono / WhatsApp <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={codigoPais}
                        onChange={e => setCodigoPais(e.target.value)}
                        className="px-2 py-3 rounded-lg font-body text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary,#1B4332)] focus:border-[var(--theme-primary,#1B4332)] cursor-pointer"
                        style={{ borderColor: errors.telefono ? '#ef4444' : 'rgba(0,0,0,0.18)', backgroundColor: '#FFFFFF', color: 'var(--theme-text, #3D2817)', minWidth: '100px', backgroundImage: 'none' }}
                      >
                        <option value="+595">🇵🇾 +595</option>
                        <option value="+55">🇧🇷 +55</option>
                        <option value="+54">🇦🇷 +54</option>
                        <option value="+598">🇺🇾 +598</option>
                        <option value="+591">🇧🇴 +591</option>
                        <option value="+34">🇪🇸 +34</option>
                      </select>
                      <input
                        type="tel"
                        value={telefono}
                        onChange={e => { setTelefono(e.target.value); setErrors(prev => ({ ...prev, telefono: '' })) }}
                        placeholder="0991234567"
                        className="flex-1 px-4 py-3 rounded-lg font-body text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary,#1B4332)] focus:border-[var(--theme-primary,#1B4332)]"
                        style={{ borderColor: errors.telefono ? '#ef4444' : 'rgba(0,0,0,0.18)', backgroundColor: '#FFFFFF', color: 'var(--theme-text, #3D2817)' }}
                      />
                    </div>
                    {errors.telefono && <p className="text-xs mt-1 font-body" style={{ color: '#ef4444' }}>{errors.telefono}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-body text-sm font-medium mb-1.5" style={{ color: 'var(--theme-text, #3D2817)' }}>
                        Nombre <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={nombre}
                        onChange={e => { setNombre(e.target.value); setErrors(prev => ({ ...prev, nombre: '' })) }}
                        placeholder="Juan"
                        className="w-full px-4 py-3 rounded-lg font-body text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary,#1B4332)] focus:border-[var(--theme-primary,#1B4332)]"
                        style={{ borderColor: errors.nombre ? '#ef4444' : 'rgba(0,0,0,0.18)', backgroundColor: '#FFFFFF', color: 'var(--theme-text, #3D2817)' }}
                      />
                      {errors.nombre && <p className="text-xs mt-1 font-body" style={{ color: '#ef4444' }}>{errors.nombre}</p>}
                    </div>
                    <div>
                      <label className="block font-body text-sm font-medium mb-1.5" style={{ color: 'var(--theme-text, #3D2817)' }}>
                        Apellido <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={apellido}
                        onChange={e => { setApellido(e.target.value); setErrors(prev => ({ ...prev, apellido: '' })) }}
                        placeholder="Pérez"
                        className="w-full px-4 py-3 rounded-lg font-body text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary,#1B4332)] focus:border-[var(--theme-primary,#1B4332)]"
                        style={{ borderColor: errors.apellido ? '#ef4444' : 'rgba(0,0,0,0.18)', backgroundColor: '#FFFFFF', color: 'var(--theme-text, #3D2817)' }}
                      />
                      {errors.apellido && <p className="text-xs mt-1 font-body" style={{ color: '#ef4444' }}>{errors.apellido}</p>}
                    </div>
                  </div>

                  <div ref={ciudadRef} className="relative">
                    <label className="block font-body text-sm font-medium mb-1.5" style={{ color: 'var(--theme-text, #3D2817)' }}>
                      Ciudad / Departamento <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={ciudadInput}
                      onChange={e => {
                        setCiudadInput(e.target.value)
                        setCiudadSeleccionada('')
                        setShowCiudadDropdown(true)
                      }}
                      onFocus={() => setShowCiudadDropdown(true)}
                      placeholder="Escribí para buscar... (ej: Asunción, Capiatá)"
                      className="w-full px-4 py-3 rounded-lg font-body text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary,#1B4332)] focus:border-[var(--theme-primary,#1B4332)]"
                      style={{ borderColor: errors.ciudad ? '#ef4444' : 'rgba(0,0,0,0.18)', backgroundColor: '#FFFFFF', color: 'var(--theme-text, #3D2817)' }}
                    />
                    {errors.ciudad && <p className="text-xs mt-1 font-body" style={{ color: '#ef4444' }}>{errors.ciudad}</p>}

                    {showCiudadDropdown && (
                      <div
                        className="absolute z-50 w-full mt-1 max-h-64 overflow-y-auto rounded-lg border shadow-lg"
                        style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.18)' }}
                      >
                        {Object.keys(groupedCiudades).length === 0 ? (
                          <div className="px-4 py-3 text-sm font-body" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                            No se encontraron ciudades
                          </div>
                        ) : (
                          Object.entries(groupedCiudades).map(([dep, ciudades]) => (
                            <div key={dep}>
                              <div
                                className="px-4 py-1.5 text-xs font-body font-bold uppercase tracking-wide"
                                style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)', color: 'var(--theme-primary, #1B4332)' }}
                              >
                                {dep}
                              </div>
                              {ciudades.map(c => (
                                <button
                                  key={c.value}
                                  type="button"
                                  onClick={() => handleSelectCiudad(c.value, c.value)}
                                  className="w-full text-left px-4 py-2.5 font-body text-sm transition-colors hover:bg-opacity-50"
                                  style={{
                                    color: 'var(--theme-text, #3D2817)',
                                    backgroundColor: ciudadSeleccionada === c.value ? 'rgba(27,67,50,0.08)' : 'transparent',
                                  }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,67,50,0.06)' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ciudadSeleccionada === c.value ? 'rgba(27,67,50,0.08)' : 'transparent' }}
                                >
                                  {c.ciudad}
                                </button>
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-body text-sm font-medium mb-1.5" style={{ color: 'var(--theme-text, #3D2817)' }}>
                      Dirección o referencia <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <textarea
                      value={direccion}
                      onChange={e => { setDireccion(e.target.value); setErrors(prev => ({ ...prev, direccion: '' })) }}
                      placeholder="Calle Principal 123, casa blanca, cerca del supermercado..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg font-body text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary,#1B4332)] focus:border-[var(--theme-primary,#1B4332)] resize-none"
                      style={{ borderColor: errors.direccion ? '#ef4444' : 'rgba(0,0,0,0.18)', backgroundColor: '#FFFFFF', color: 'var(--theme-text, #3D2817)' }}
                    />
                    {errors.direccion && <p className="text-xs mt-1 font-body" style={{ color: '#ef4444' }}>{errors.direccion}</p>}
                  </div>

                  <div>
                    <label className="block font-body text-sm font-medium mb-1.5" style={{ color: 'var(--theme-text, #3D2817)' }}>
                      RUC <span className="font-normal" style={{ color: 'var(--theme-muted, #5C4033)' }}>(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={ruc}
                      onChange={e => setRuc(e.target.value)}
                      placeholder="Ej: 1234567-8"
                      className="w-full px-4 py-3 rounded-lg font-body text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary,#1B4332)] focus:border-[var(--theme-primary,#1B4332)]"
                      style={{ borderColor: 'rgba(0,0,0,0.18)', backgroundColor: '#FFFFFF', color: 'var(--theme-text, #3D2817)' }}
                    />
                 </div>
                 {pagosInstrucciones && (
                   <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'rgba(27,67,50,0.04)', border: '1px solid rgba(27,67,50,0.15)' }}>
                     <p className="font-body font-semibold text-xs mb-1" style={{ color: 'var(--theme-primary, #1B4332)' }}>Instrucciones de pago</p>
                     <div className="font-body text-xs prose prose-sm" style={{ color: 'var(--theme-muted, #5C4033)' }} dangerouslySetInnerHTML={{ __html: pagosInstrucciones }} />
                   </div>
                 )}
               </div>
              </div>

              {/* Payment Method */}
              <div className="rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)' }}>
                <h2 className="font-body font-bold text-base mb-4" style={{ color: 'var(--theme-text, #3D2817)' }}>
                  Método de pago
                </h2>
                <div className="space-y-3">
                  {[
                    ...(metodosPago.whatsapp ? [{ value: 'whatsapp', label: 'WhatsApp (pago a coordinar)', icon: MessageCircle, desc: 'Te contactaremos por WhatsApp para coordinar el pago' }] : []),
                    ...(metodosPago.efectivo && envioTipo !== 'encomienda' ? [{ value: 'efectivo', label: 'Efectivo al recibir', icon: CreditCard, desc: 'Pagás cuando recibís el producto' }] : []),
                    ...(metodosPago.transferencia ? [{ value: 'transferencia', label: 'Transferencia bancaria', icon: Package, desc: 'Te enviamos los datos para transferir' }] : []),
                    ...(qrInfo.activo ? [{ value: 'qr', label: 'Pago QR', icon: CreditCard, desc: qrInfo.instrucciones || 'Escaneá y pagá' }] : []),
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setMetodoPago(option.value)}
                      className="w-full flex items-start gap-4 p-4 rounded-lg border-2 transition-all text-left"
                      style={{
                        borderColor: metodoPago === option.value ? 'var(--theme-primary, #1B4332)' : 'rgba(0,0,0,0.18)',
                        backgroundColor: metodoPago === option.value ? 'rgba(27,67,50,0.04)' : '#FFFFFF',
                      }}
                    >
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5" style={{ borderColor: metodoPago === option.value ? 'var(--theme-primary, #1B4332)' : 'rgba(0,0,0,0.18)' }}>
                        {metodoPago === option.value && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--theme-primary, #1B4332)' }} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <option.icon className="w-4 h-4" style={{ color: 'var(--theme-primary, #1B4332)' }} />
                          <span className="font-body font-semibold text-sm" style={{ color: 'var(--theme-text, #3D2817)' }}>{option.label}</span>
                        </div>
                        <p className="font-body text-xs mt-1" style={{ color: 'var(--theme-muted, #5C4033)' }}>{option.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

               {metodoPago === 'qr' && qrInfo.imagen && (
                 <div className="rounded-xl p-6 text-center" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(27,67,50,0.06)' }}>
                   <h3 className="font-body font-semibold text-sm mb-3" style={{ color: 'var(--theme-text, #3D2817)' }}>Escaneá el QR para pagar</h3>
                   <img src={qrInfo.imagen} alt="QR de pago" className="mx-auto rounded-lg" style={{ maxWidth: 200, maxHeight: 200 }} />
                   {qrInfo.instrucciones && (
                     <p className="font-body text-xs mt-3" style={{ color: 'var(--theme-muted, #5C4033)' }}>{qrInfo.instrucciones}</p>
                   )}
                 </div>
               )}

               {metodoPago === 'transferencia' && transferenciaInstrucciones && (
                 <div className="rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(27,67,50,0.06)' }}>
                   <h3 className="font-body font-semibold text-sm mb-2" style={{ color: 'var(--theme-text, #3D2817)' }}>Datos para transferencia</h3>
                   <div className="font-body text-xs prose prose-sm" style={{ color: 'var(--theme-muted, #5C4033)' }} dangerouslySetInnerHTML={{ __html: transferenciaInstrucciones }} />
                 </div>
               )}

              {/* Submit */}
              <button
                onClick={handleSubmitPedido}
                disabled={sending}
                className="w-full font-body font-semibold text-sm py-4 rounded-lg transition-all duration-300 hover:scale-[1.02] disabled:opacity-50"
                style={{ backgroundColor: 'var(--theme-primary, #1B4332)', color: 'var(--theme-text-on-primary, #FFFFFF)' }}
              >
                {sending ? 'Procesando...' : `Completar pedido — ${formatPrice(totalConEnvio)}`}
              </button>

              <div className="flex items-center justify-center gap-1 text-xs font-body" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                <Lock className="w-3.5 h-3.5" />
                <span>Tus datos están protegidos</span>
              </div>
            </div>
          </div>

          {/* Right: Order Summary */}
          <div className="order-1 lg:order-2">
            <div
              className="rounded-xl p-6 lg:sticky lg:top-24"
              style={{ backgroundColor: '#FFFFFF', boxShadow: '0 4px 24px rgba(27,67,50,0.08)' }}
            >
              <h2 className="font-body font-bold text-lg mb-6" style={{ color: 'var(--theme-text, #3D2817)' }}>
                Resumen del pedido
              </h2>

              {/* Products */}
              <div className="space-y-4 mb-6 max-h-64 overflow-y-visible">
                {items.map((item) => {
                  const unit = getEffectiveUnitPrice(item)
                  const lineTotal = unit * item.quantity
                  const originalLineTotal = item.product.precio * item.quantity
                  const hasDiscount = lineTotal < originalLineTotal
                  return (
                  <div key={item.product.id} className="flex gap-3">
                    <div className="relative shrink-0" style={{ overflow: 'visible' }}>
                      <img
                        src={item.product.imagen}
                        alt={item.product.nombre}
                        className="w-16 h-16 object-contain rounded-lg"
                        style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)' }}
                      />
                      <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'var(--theme-primary, #1B4332)', color: 'var(--theme-text-on-primary, #FFFFFF)', zIndex: 10 }}>
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-medium truncate" style={{ color: 'var(--theme-text, #3D2817)' }}>
                        {item.product.nombre}
                      </p>
                      <p className="font-body text-sm mt-1" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                        {hasDiscount ? (
                          <>
                            <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{formatPrice(item.product.precio)}</span>
                            {' '}
                            <span style={{ color: 'var(--theme-primary, #1B4332)', fontWeight: 600 }}>{formatPrice(unit)}</span>
                          </>
                        ) : (
                          formatPrice(item.product.precio)
                        )}
                      </p>
                    </div>
                    <div className="font-body text-sm font-semibold" style={{ color: 'var(--theme-text, #3D2817)' }}>
                      {formatPrice(lineTotal)}
                    </div>
                  </div>
                  )
                })}
              </div>

              {/* Totals */}
              <div className="space-y-3 pt-6" style={{ borderTop: '1px solid rgba(61,40,23,0.1)' }}>
                <div className="flex justify-between font-body text-sm" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                  <span>Subtotal</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                {totalSavings > 0 && (
                  <div className="flex justify-between font-body text-sm" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                    <span>Ahorrás</span>
                    <span>−{formatPrice(totalSavings)}</span>
                  </div>
                )}
                {envioTipo === 'delivery' ? (
                  <div className="flex justify-between font-body text-sm" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                    <span>Delivery ({envioCiudad})</span>
                    <span style={{ color: 'var(--theme-primary, #1B4332)' }}>{envioGratis ? 'Gratis' : formatPrice(envioCosto)}</span>
                  </div>
                ) : envioTipo === 'encomienda' ? (
                  <div className="flex justify-between font-body text-sm" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                    <span>Encomienda</span>
                    <span style={{ color: 'var(--theme-muted, #5C4033)' }}>A consultar</span>
                  </div>
                ) : null}
                <div
                  className="flex justify-between items-center pt-3"
                  style={{ borderTop: '1px solid rgba(61,40,23,0.1)' }}
                >
                  <span className="font-body font-bold text-base" style={{ color: 'var(--theme-text, #3D2817)' }}>Total</span>
                  <span className="font-body font-bold text-xl" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                    {formatPrice(totalConEnvio)}
                  </span>
                </div>
                <p className="font-body text-xs text-right" style={{ color: 'var(--theme-muted, #999)' }}>
                  Incluye {formatPrice(Math.round(totalConEnvio * 10 / 110))} IVA
                </p>
              </div>

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-4 mt-6 pt-6" style={{ borderTop: '1px solid rgba(61,40,23,0.1)' }}>
                <div className="flex items-center gap-1.5 text-xs font-body" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Pago seguro</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-body" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Envíos a todo PY</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
