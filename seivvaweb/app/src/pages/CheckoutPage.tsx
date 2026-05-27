import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Check, MapPin, CreditCard, MessageCircle, Package } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { formatPrice, createPedido } from '../services/api'
import { ciudadesParaguay, parseCiudadSeleccionada } from '../data/ciudades'

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items, clearCart, totalPrice } = useCart()

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0 && !pedidoId) {
      navigate('/carrito')
    }
  }, [items])

  // Form fields — matching WooCommerce fields minus email
  const [telefono, setTelefono] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [direccion, setDireccion] = useState('')
  const [ciudadSeleccionada, setCiudadSeleccionada] = useState('')
  const [ciudadInput, setCiudadInput] = useState('')
  const [showCiudadDropdown, setShowCiudadDropdown] = useState(false)
  const [ruc, setRuc] = useState('')
  const [codigoPostal, setCodigoPostal] = useState('')
  const [metodoPago, setMetodoPago] = useState('whatsapp')
  const [notas, setNotas] = useState('')
  const [sending, setSending] = useState(false)
  const [pedidoId, setPedidoId] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

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

  const handleSubmitPedido = async () => {
    if (!validate()) return
    setSending(true)
    try {
      const productos = items.map(i => ({
        id: i.product.id,
        nombre: i.product.nombre,
        precio: i.product.precio,
        cantidad: i.quantity
      }))
      const { departamento, ciudad } = parseCiudadSeleccionada(ciudadSeleccionada)
      const result = await createPedido({
        cliente: `${nombre} ${apellido}`,
        whatsapp: telefono,
        direccion: `${direccion}, ${ciudad}, ${departamento}${codigoPostal ? `, CP: ${codigoPostal}` : ''}${ruc ? `, RUC: ${ruc}` : ''}`,
        productos,
        total: totalPrice,
        metodo_pago: metodoPago,
        notas
      })
      setPedidoId(result.id)
      clearCart()

      setTimeout(() => {
        const lines = items.map(i => `• ${i.product.nombre} x${i.quantity} = ${formatPrice(i.product.precio * i.quantity)}`)
        const msg = encodeURIComponent(
          `Hola Seiva! Acabo de hacer el pedido #${result.id}:\n\n${lines.join('\n')}\n\n*Total: ${formatPrice(totalPrice)}*\n\nNombre: ${nombre} ${apellido}\nDirección: ${direccion}, ${ciudad}, ${departamento}`
        )
        window.open(`https://wa.me/595992120303?text=${msg}`, '_blank')
      }, 1500)
    } catch (e) {
      alert('Error al enviar el pedido. Intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  if (pedidoId) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)' }}>
        <div className="container-main max-w-2xl mx-auto pt-20 pb-20 px-4">
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#d1fae5' }}>
              <Check className="w-10 h-10" style={{ color: '#065f46' }} />
            </div>
            <h1 className="font-body font-bold text-2xl mb-3" style={{ color: 'var(--theme-text, #3D2817)' }}>
              ¡Pedido confirmado!
            </h1>
            <p className="font-body mb-2" style={{ color: 'var(--theme-muted, #5C4033)' }}>
              Pedido #{pedidoId} enviado correctamente.
            </p>
            <p className="font-body mb-8" style={{ color: 'var(--theme-muted, #5C4033)' }}>
              Te abrimos WhatsApp para que confirmés tu pedido.
            </p>
            <Link
              to="/tienda"
              className="inline-flex items-center gap-2 font-body font-semibold text-sm px-8 py-3 rounded-full"
              style={{ backgroundColor: 'var(--theme-primary, #1B4332)', color: '#FFF' }}
            >
              Seguir comprando
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
              {/* Contact */}
              <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)', boxShadow: '0 2px 12px rgba(27,67,50,0.06)' }}>
                <h2 className="font-body font-bold text-base mb-4" style={{ color: 'var(--theme-text, #3D2817)' }}>
                  Contacto
                </h2>
                <div>
                  <label className="block font-body text-sm font-medium mb-1.5" style={{ color: 'var(--theme-text, #3D2817)' }}>
                    Teléfono / WhatsApp <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={e => { setTelefono(e.target.value); setErrors(prev => ({ ...prev, telefono: '' })) }}
                    placeholder="0991234567"
                    className="w-full px-4 py-3 rounded-lg font-body text-sm border transition-colors focus:outline-none focus:ring-2"
                    style={{ borderColor: errors.telefono ? '#ef4444' : 'var(--theme-border, #E8E0D5)', backgroundColor: '#fff', color: 'var(--theme-text, #3D2817)' }}
                  />
                  {errors.telefono && <p className="text-xs mt-1 font-body" style={{ color: '#ef4444' }}>{errors.telefono}</p>}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)', boxShadow: '0 2px 12px rgba(27,67,50,0.06)' }}>
                <h2 className="font-body font-bold text-base mb-4" style={{ color: 'var(--theme-text, #3D2817)' }}>
                  Dirección de envío
                </h2>
                <div className="space-y-4">
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
                        className="w-full px-4 py-3 rounded-lg font-body text-sm border transition-colors focus:outline-none focus:ring-2"
                        style={{ borderColor: errors.nombre ? '#ef4444' : 'var(--theme-border, #E8E0D5)', backgroundColor: '#fff', color: 'var(--theme-text, #3D2817)' }}
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
                        className="w-full px-4 py-3 rounded-lg font-body text-sm border transition-colors focus:outline-none focus:ring-2"
                        style={{ borderColor: errors.apellido ? '#ef4444' : 'var(--theme-border, #E8E0D5)', backgroundColor: '#fff', color: 'var(--theme-text, #3D2817)' }}
                      />
                      {errors.apellido && <p className="text-xs mt-1 font-body" style={{ color: '#ef4444' }}>{errors.apellido}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block font-body text-sm font-medium mb-1.5" style={{ color: 'var(--theme-text, #3D2817)' }}>
                      Dirección o referencia <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={direccion}
                      onChange={e => { setDireccion(e.target.value); setErrors(prev => ({ ...prev, direccion: '' })) }}
                      placeholder="Calle Principal 123, cerca de..."
                      className="w-full px-4 py-3 rounded-lg font-body text-sm border transition-colors focus:outline-none focus:ring-2"
                      style={{ borderColor: errors.direccion ? '#ef4444' : 'var(--theme-border, #E8E0D5)', backgroundColor: '#fff', color: 'var(--theme-text, #3D2817)' }}
                    />
                    {errors.direccion && <p className="text-xs mt-1 font-body" style={{ color: '#ef4444' }}>{errors.direccion}</p>}
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
                      className="w-full px-4 py-3 rounded-lg font-body text-sm border transition-colors focus:outline-none focus:ring-2"
                      style={{ borderColor: errors.ciudad ? '#ef4444' : 'var(--theme-border, #E8E0D5)', backgroundColor: '#fff', color: 'var(--theme-text, #3D2817)' }}
                    />
                    {errors.ciudad && <p className="text-xs mt-1 font-body" style={{ color: '#ef4444' }}>{errors.ciudad}</p>}

                    {showCiudadDropdown && (
                      <div
                        className="absolute z-50 w-full mt-1 max-h-64 overflow-y-auto rounded-lg border shadow-lg"
                        style={{ backgroundColor: '#fff', borderColor: 'var(--theme-border, #E8E0D5)' }}
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-body text-sm font-medium mb-1.5" style={{ color: 'var(--theme-text, #3D2817)' }}>
                        RUC <span className="font-normal" style={{ color: 'var(--theme-muted, #5C4033)' }}>(opcional)</span>
                      </label>
                      <input
                        type="text"
                        value={ruc}
                        onChange={e => setRuc(e.target.value)}
                        placeholder="Ej: 1234567-8"
                        className="w-full px-4 py-3 rounded-lg font-body text-sm border transition-colors focus:outline-none focus:ring-2"
                        style={{ borderColor: 'var(--theme-border, #E8E0D5)', backgroundColor: '#fff', color: 'var(--theme-text, #3D2817)' }}
                      />
                    </div>
                    <div>
                      <label className="block font-body text-sm font-medium mb-1.5" style={{ color: 'var(--theme-text, #3D2817)' }}>
                        Código postal <span className="font-normal" style={{ color: 'var(--theme-muted, #5C4033)' }}>(opcional)</span>
                      </label>
                      <input
                        type="text"
                        value={codigoPostal}
                        onChange={e => setCodigoPostal(e.target.value)}
                        placeholder="Ej: 001"
                        className="w-full px-4 py-3 rounded-lg font-body text-sm border transition-colors focus:outline-none focus:ring-2"
                        style={{ borderColor: 'var(--theme-border, #E8E0D5)', backgroundColor: '#fff', color: 'var(--theme-text, #3D2817)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-body text-sm font-medium mb-1.5" style={{ color: 'var(--theme-text, #3D2817)' }}>
                      Notas adicionales <span className="font-normal" style={{ color: 'var(--theme-muted, #5C4033)' }}>(opcional)</span>
                    </label>
                    <textarea
                      value={notas}
                      onChange={e => setNotas(e.target.value)}
                      placeholder="Indicaciones especiales para la entrega..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg font-body text-sm border transition-colors focus:outline-none focus:ring-2 resize-none"
                      style={{ borderColor: 'var(--theme-border, #E8E0D5)', backgroundColor: '#fff', color: 'var(--theme-text, #3D2817)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)', boxShadow: '0 2px 12px rgba(27,67,50,0.06)' }}>
                <h2 className="font-body font-bold text-base mb-4" style={{ color: 'var(--theme-text, #3D2817)' }}>
                  Método de pago
                </h2>
                <div className="space-y-3">
                  {[
                    { value: 'whatsapp', label: 'WhatsApp (pago a coordinar)', icon: MessageCircle, desc: 'Te contactaremos por WhatsApp para coordinar el pago' },
                    { value: 'efectivo', label: 'Efectivo al recibir', icon: CreditCard, desc: 'Pagás cuando recibís el producto' },
                    { value: 'transferencia', label: 'Transferencia bancaria', icon: Package, desc: 'Te enviamos los datos para transferir' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setMetodoPago(option.value)}
                      className="w-full flex items-start gap-4 p-4 rounded-lg border-2 transition-all text-left"
                      style={{
                        borderColor: metodoPago === option.value ? 'var(--theme-primary, #1B4332)' : 'var(--theme-border, #E8E0D5)',
                        backgroundColor: metodoPago === option.value ? 'rgba(27,67,50,0.04)' : '#fff',
                      }}
                    >
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5" style={{ borderColor: metodoPago === option.value ? 'var(--theme-primary, #1B4332)' : 'var(--theme-border, #E8E0D5)' }}>
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

              {/* Submit */}
              <button
                onClick={handleSubmitPedido}
                disabled={sending}
                className="w-full font-body font-semibold text-sm py-4 rounded-lg transition-all duration-300 hover:scale-[1.02] disabled:opacity-50"
                style={{ backgroundColor: 'var(--theme-primary, #1B4332)', color: '#FFFFFF' }}
              >
                {sending ? 'Procesando...' : `Completar pedido — ${formatPrice(totalPrice)}`}
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
              style={{ backgroundColor: 'var(--theme-surface, #FFFFFF)', boxShadow: '0 4px 24px rgba(27,67,50,0.08)' }}
            >
              <h2 className="font-body font-bold text-lg mb-6" style={{ color: 'var(--theme-text, #3D2817)' }}>
                Resumen del pedido
              </h2>

              {/* Products */}
              <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                {items.map(({ product, quantity }) => (
                  <div key={product.id} className="flex gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={product.imagen}
                        alt={product.nombre}
                        className="w-16 h-16 object-contain rounded-lg"
                        style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)' }}
                      />
                      <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'var(--theme-primary, #1B4332)', color: '#fff' }}>
                        {quantity}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-medium truncate" style={{ color: 'var(--theme-text, #3D2817)' }}>
                        {product.nombre}
                      </p>
                      <p className="font-body text-sm mt-1" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                        {formatPrice(product.precio)}
                      </p>
                    </div>
                    <div className="font-body text-sm font-semibold" style={{ color: 'var(--theme-text, #3D2817)' }}>
                      {formatPrice(product.precio * quantity)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-3 pt-6" style={{ borderTop: '1px solid rgba(61,40,23,0.1)' }}>
                <div className="flex justify-between font-body text-sm" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                  <span>Subtotal</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between font-body text-sm" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                  <span>Envío</span>
                  <span style={{ color: 'var(--theme-primary, #1B4332)' }}>A coordinar</span>
                </div>
                <div
                  className="flex justify-between items-center pt-3"
                  style={{ borderTop: '1px solid rgba(61,40,23,0.1)' }}
                >
                  <span className="font-body font-bold text-base" style={{ color: 'var(--theme-text, #3D2817)' }}>Total</span>
                  <span className="font-body font-bold text-xl" style={{ color: 'var(--theme-primary, #1B4332)' }}>
                    {formatPrice(totalPrice)}
                  </span>
                </div>
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
