import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Product } from '../services/api'
import { getDiscountedPrice } from '../services/api'
import { fetchPromos, validateCupon, type Promo } from '../services/api'

export interface CartItem {
  product: Product
  quantity: number
}

interface CartContextValue {
  items: CartItem[]
  isOpen: boolean
  addItem: (product: Product, quantity?: number) => void
  removeItem: (productId: number) => void
  updateQuantity: (productId: number, quantity: number) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
  totalItems: number
  totalPrice: number
  totalSavings: number
  activePromos: Promo[]
  promoDiscount: number
  appliedCoupon: Promo | null
  applyCoupon: (codigo: string) => Promise<boolean>
  removeCoupon: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = 'seiva-cart'
const SESSION_KEY = 'seiva-cart-session'

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as CartItem[]
  } catch {
    // ignore parse errors
  }
  return []
}

function getSessionToken(): string {
  let token = localStorage.getItem(SESSION_KEY)
  if (!token) {
    token = 'cart_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10)
    localStorage.setItem(SESSION_KEY, token)
  }
  return token
}

function trackCart(items: CartItem[]) {
  const token = getSessionToken()
  const productos = items.map(i => ({
    id: i.product.id,
    nombre: i.product.nombre,
    precio: i.product.precio,
    cantidad: i.quantity
  }))
  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://85.239.246.177:3001/api'
    : '/api'
  fetch(`${API_BASE}/carritos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_token: token, productos }),
    keepalive: true
  }).catch(() => {})
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart)
  const [isOpen, setIsOpen] = useState(false)
  const [activePromos, setActivePromos] = useState<Promo[]>([])
  const [appliedCoupon, setAppliedCoupon] = useState<Promo | null>(null)

  useEffect(() => {
    fetchPromos().then(setActivePromos).catch(() => setActivePromos([]))
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    if (items.length > 0) trackCart(items)
  }, [items])

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  const addItem = useCallback((product: Product, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        return prev.map(i =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        )
      }
      return [...prev, { product, quantity }]
    })
    setIsOpen(true)
  }, [])

  const removeItem = useCallback((productId: number) => {
    setItems(prev => prev.filter(i => i.product.id !== productId))
  }, [])

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.product.id !== productId))
      return
    }
    setItems(prev =>
      prev.map(i =>
        i.product.id === productId ? { ...i, quantity } : i
      )
    )
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setIsOpen(false)
  }, [])

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const totalPrice = items.reduce((sum, i) => {
    const discountedPrice = getDiscountedPrice(i.product, i.quantity)
    return sum + discountedPrice * i.quantity
  }, 0)
  const totalSavings = items.reduce((sum, i) => {
    const discountedPrice = getDiscountedPrice(i.product, i.quantity)
    const saving = (i.product.precio - discountedPrice) * i.quantity
    return sum + saving
  }, 0)

  // Calcular descuento de promos activas (descuento_carrito + cupón)
  const promoDiscount = (() => {
    let discount = 0
    for (const promo of activePromos) {
      if (promo.tipo === 'descuento_carrito') {
        const meetsQty = items.some(i => i.quantity >= promo.compra_min_cantidad) || promo.compra_min_cantidad <= 1
        const meetsMonto = totalPrice >= (promo.compra_min_monto || 0)
        if (meetsQty && meetsMonto) {
          if (promo.descuento_tipo === 'porcentaje') {
            discount += Math.round(totalPrice * promo.descuento_valor / 100)
          } else {
            discount += promo.descuento_valor
          }
        }
      }
      if (promo === appliedCoupon && promo.tipo === 'cupon') {
        const meetsMonto = totalPrice >= (promo.compra_min_monto || 0)
        if (meetsMonto) {
          if (promo.descuento_tipo === 'porcentaje') {
            discount += Math.round(totalPrice * promo.descuento_valor / 100)
          } else {
            discount += promo.descuento_valor
          }
        }
      }
    }
    return discount
  })()

  const applyCoupon = useCallback(async (codigo: string): Promise<boolean> => {
    const cupon = await validateCupon(codigo)
    if (!cupon) return false
    const fullPromo = activePromos.find(p => p.id === cupon.id)
    if (fullPromo) {
      setAppliedCoupon(fullPromo)
      return true
    }
    // Si el cupón fue validado pero no está en activePromos, buscar en API
    const promos = await fetchPromos()
    const found = promos.find(p => p.id === cupon.id)
    if (found) {
      setActivePromos(prev => [...prev.filter(p => p.id !== found.id), found])
      setAppliedCoupon(found)
      return true
    }
    return false
  }, [activePromos])

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null)
  }, [])

  return (
    <CartContext.Provider value={{ items, isOpen, addItem, removeItem, updateQuantity, clearCart, openCart, closeCart, totalItems, totalPrice, totalSavings, activePromos, promoDiscount, appliedCoupon, applyCoupon, removeCoupon }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
