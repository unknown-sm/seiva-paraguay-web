import { useEffect } from 'react'

type Kind = 'terminos' | 'privacidad' | 'cookies'

const contenido: Record<Kind, { titulo: string; bajada: string; secciones: { h: string; p: string }[] }> = {
  terminos: {
    titulo: 'Términos y Condiciones',
    bajada: 'Las condiciones para comprar en Seiva Paraguay.',
    secciones: [
      {
        h: '1. Pedidos',
        p: 'Al realizar un pedido a través de nuestra web o WhatsApp aceptás estos términos. El pedido queda confirmado cuando recibís la confirmación de nuestro equipo. La disponibilidad está sujeta a stock.',
      },
      {
        h: '2. Precios y pagos',
        p: 'Los precios están expresados en Guaraníes (Gs.) e incluyen IVA. Nos reservamos el derecho de modificar precios sin previo aviso. Aceptamos transferencia bancaria, Pago QR y efectivo contra entrega (según los medios habilitados en el checkout).',
      },
      {
        h: '3. Envíos',
        p: 'Enviamos a todo Paraguay. En Asunción y alrededores coordinamos la entrega por WhatsApp (costo según distancia). Al interior, despachamos por encomienda con las empresas de transporte disponibles. El costo de envío corre por cuenta del cliente, salvo promociones de delivery gratis. No nos hacemos responsables por demoras de las empresas de encomienda.',
      },
      {
        h: '4. Devoluciones',
        p: 'Aceptamos devoluciones dentro de los 7 días corridos desde la entrega. El producto debe estar sin abrir, en su empaque original y en condiciones de reventa. Los gastos de envío por devolución corren por cuenta del cliente. Para iniciar una devolución escribinos por WhatsApp.',
      },
      {
        h: '5. Productos de suplementación',
        p: 'Los suplementos alimenticios no son medicamentos y no reemplazan una dieta equilibrada ni el consejo de un profesional de la salud. Ante dudas o condiciones preexistentes, consultá a tu médico. Las imágenes son ilustrativas y pueden variar del producto real.',
      },
      {
        h: '6. Contacto',
        p: 'Para cualquier consulta sobre estos términos escribinos por WhatsApp al número publicado en el sitio.',
      },
    ],
  },
  privacidad: {
    titulo: 'Política de Privacidad',
    bajada: 'Cómo tratamos tus datos personales (Ley N° 6534/2020 de protección de datos personales).',
    secciones: [
      {
        h: '1. Datos que recabamos',
        p: 'Al realizar un pedido recabamos: nombre, número de teléfono, dirección de envío y, si lo solicitás para la factura, RUC. Las conversaciones por WhatsApp son privadas entre vos y Seiva.',
      },
      {
        h: '2. Para qué los usamos',
        p: 'Exclusivamente para procesar tu pedido, coordinar la entrega, emitir la factura y comunicarnos con vos sobre tu compra. No enviamos publicidad sin tu autorización.',
      },
      {
        h: '3. No compartimos tus datos',
        p: 'No vendemos ni cedemos tu información a terceros con fines comerciales. Solo la compartimos con la empresa de transporte cuando es necesario para entregarte el pedido (nombre, dirección y teléfono).',
      },
      {
        h: '4. Tus derechos (habeas data)',
        p: 'Conforme a la Ley N° 6534/2020 y el artículo 135 de la Constitución Nacional, podés solicitar en cualquier momento el acceso, rectificación, actualización o supresión de tus datos escribiéndonos por WhatsApp.',
      },
      {
        h: '5. Conservación',
        p: 'Conservamos los datos de tus pedidos el tiempo necesario para cumplir obligaciones legales y de garantía.',
      },
    ],
  },
  cookies: {
    titulo: 'Política de Cookies',
    bajada: 'Qué cookies y almacenamiento local usa este sitio y para qué.',
    secciones: [
      {
        h: '1. Qué usamos',
        p: 'Este sitio utiliza únicamente cookies técnicas y almacenamiento local (localStorage) necesarios para su funcionamiento: mantener tu carrito de compras entre visitas, recordar tus preferencias de tema e interfaz, y tu sesión si sos administrador.',
      },
      {
        h: '2. No usamos cookies de terceros',
        p: 'No utilizamos cookies publicitarias, de redes sociales ni de seguimiento de terceros. No compartimos información de navegación con terceros.',
      },
      {
        h: '3. Cómo gestionarlas',
        p: 'Podés borrar o bloquear las cookies desde la configuración de tu navegador. Tené en cuenta que borrar el almacenamiento local vacía tu carrito de compras.',
      },
      {
        h: '4. Aceptación',
        p: 'Al usar este sitio aceptás el uso de estas cookies técnicas, necesarias para que la tienda funcione.',
      },
    ],
  },
}

export default function LegalPage({ kind }: { kind: Kind }) {
  const c = contenido[kind]

  useEffect(() => {
    document.title = c.titulo + ' — Seiva Paraguay'
  }, [c.titulo])

  return (
    <main className="pt-24 pb-16 min-h-screen" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)' }}>
      <div className="container-main">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-bold" style={{ color: 'var(--theme-primary, #1B4332)' }}>
            {c.titulo}
          </h1>
          <p className="font-body mt-2" style={{ color: 'var(--theme-muted, #5C4033)' }}>
            {c.bajada}
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-4">
          {c.secciones.map((s, i) => (
            <div
              key={i}
              className="rounded-xl p-6"
              style={{ backgroundColor: 'var(--theme-surface, #FDF8F0)', border: '1px solid var(--theme-border, #E8E0D5)' }}
            >
              <h2 className="font-display font-bold text-lg mb-2" style={{ color: 'var(--theme-text, #3D2817)' }}>
                {s.h}
              </h2>
              <p className="font-body leading-relaxed" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                {s.p}
              </p>
            </div>
          ))}
          <p className="text-center font-body text-xs pt-2" style={{ color: 'var(--theme-muted, #999)' }}>
            Última actualización: septiembre 2026 · Seiva Paraguay
          </p>
        </div>
      </div>
    </main>
  )
}
