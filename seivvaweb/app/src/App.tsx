import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { ThemeProvider } from './context/ThemeContext'
import CartDrawer from './components/CartDrawer'
import MobileTabBar from './components/MobileTabBar'
import ScrollToTop from './components/ScrollToTop'
import Navbar from './sections/Navbar'

const Footer = lazy(() => import('./sections/Footer'))
import HomePage from './pages/HomePage'
import TiendaPage from './pages/TiendaPage'
import ProductoPage from './pages/ProductoPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import FaqPage from './pages/FaqPage'
import ContactoPage from './pages/ContactoPage'
import PoliticasPage from './pages/PoliticasPage'
import PromosPage from './pages/PromosPage'
import DynamicPage from './pages/DynamicPage'

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="pb-[76px] md:pb-0">{children}</div>
      <Suspense fallback={<div className="min-h-[30vh]" />}>
        <Footer />
      </Suspense>
      <CartDrawer />
      <MobileTabBar />
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <CartProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Layout><HomePage /></Layout>} />
            <Route path="/tienda" element={<Layout><TiendaPage /></Layout>} />
            <Route path="/producto/:slug" element={<Layout><ProductoPage /></Layout>} />
            <Route path="/carrito" element={<Layout><CartPage /></Layout>} />
            <Route path="/checkout" element={<Layout><CheckoutPage /></Layout>} />
            <Route path="/faq" element={<Layout><FaqPage /></Layout>} />
            <Route path="/contacto" element={<Layout><ContactoPage /></Layout>} />
            <Route path="/politicas" element={<Layout><PoliticasPage /></Layout>} />
            <Route path="/promos" element={<Layout><PromosPage /></Layout>} />
            <Route path="/pagina/:slug" element={<Layout><DynamicPage /></Layout>} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </ThemeProvider>
  )
}
