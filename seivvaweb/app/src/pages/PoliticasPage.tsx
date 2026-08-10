import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion'

const policies = [
  {
    title: 'Términos y Condiciones',
    content: 'Al realizar un pedido a través de nuestra plataforma, aceptás los siguientes términos. Los precios están expresados en Guaraníes (Gs.) e incluyen IVA. Nos reservamos el derecho de modificar precios sin previo aviso. Las imágenes son ilustrativas y pueden variar ligeramente del producto real.',
  },
  {
    title: 'Política de Envíos',
    content: 'Realizamos envíos a todo Paraguay. Asunción y alrededores: costo según distancia, entrega el mismo día. Interior: por encomienda con las empresas de transporte disponibles. El cliente asume el costo del envío salvo promociones especiales. No nos hacemos responsables por demoras de las empresas de encomienda.',
  },
  {
    title: 'Política de Devoluciones',
    content: 'Aceptamos devoluciones dentro de los 7 días corridos desde la entrega. El producto debe estar sin abrir, en su empaque original y en condiciones de reventa. Los gastos de envío por devolución corren por cuenta del cliente. Para iniciar una devolución, contactanos por WhatsApp. Productos perecederos (frutos secos) no tienen devolución una vez abiertos.',
  },
  {
    title: 'Política de Privacidad',
    content: 'Tus datos de contacto (nombre, teléfono, dirección) se usan exclusivamente para procesar tu pedido y coordinar la entrega. No compartimos tu información con terceros. Las conversaciones de WhatsApp son privadas entre vos y Seiva.',
  },
  {
    title: 'Programa de Afiliados',
    content: '¿Querés ganar comisiones recomendando Seiva? Escribinos por WhatsApp con el asunto "Afiliado" y te contamos cómo funciona. Ganás un porcentaje por cada venta que llegue con tu código de afiliado.',
  },
]

export default function PoliticasPage() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const els = sectionRef.current?.querySelectorAll('.animate-in')
      if (els) {
        gsap.fromTo(els,
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.08, duration: 0.5, ease: 'power2.out' }
        )
      }
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <main ref={sectionRef} className="pt-24 pb-16 min-h-screen" style={{ backgroundColor: 'var(--theme-bg, #FAF3E8)' }}>
      <div className="container-main">
        <div className="animate-in text-center mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-bold" style={{ color: 'var(--theme-primary, #1B4332)' }}>
            Políticas
          </h1>
          <p className="font-body mt-2" style={{ color: 'var(--theme-muted, #5C4033)' }}>
            Términos, condiciones y políticas de Seiva Paraguay.
          </p>
        </div>

        <div className="animate-in max-w-2xl mx-auto">
          <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--theme-surface, #FDF8F0)', border: '1px solid var(--theme-border, #E8E0D5)' }}>
            <Accordion type="single" collapsible className="w-full">
              {policies.map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="font-body text-base text-left" style={{ color: 'var(--theme-text, #3D2817)' }}>
                    {item.title}
                  </AccordionTrigger>
                  <AccordionContent className="font-body leading-relaxed" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                    {item.content}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </main>
  )
}
