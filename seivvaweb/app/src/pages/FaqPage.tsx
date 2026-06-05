import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion'

const faqs = [
  {
    q: '¿Cómo hago un pedido?',
    a: 'Navegá la tienda, agregá productos al carrito, andá al checkout, completá tus datos y confirmá. Te llegará un resumen por WhatsApp para coordinar la entrega.',
  },
  {
    q: '¿Cuáles son los métodos de pago?',
    a: 'Aceptamos efectivo, transferencia bancaria y QR. En Asunción y alrededores podés pagar al recibir. Para envíos al interior, solicitamos pago anticipado.',
  },
  {
    q: '¿Hacen envíos a todo Paraguay?',
    a: 'Sí. En Asunción y alrededores entregamos el mismo día. Para el interior, enviamos por encomienda con las empresas de transporte disponibles. El costo depende del destino.',
  },
  {
    q: '¿Cuánto tarda el envío?',
    a: 'Asunción y alrededores: entre 2 y 4 horas. Interior: entre 24 y 48 horas dependiendo de la encomienda.',
  },
  {
    q: '¿Puedo devolver un producto?',
    a: 'Sí, aceptamos devoluciones dentro de los 7 días posteriores a la compra, siempre que el producto esté sin abrir y en su empaque original. Contactanos por WhatsApp para coordinar.',
  },
  {
    q: '¿Los productos tienen garantía?',
    a: 'Todos nuestros productos son seleccionados de proveedores de confianza. Si recibís un producto con algún defecto de fábrica, lo cambiamos sin costo.',
  },
  {
    q: '¿Tienen local físico?',
    a: 'Operamos desde Capiatá, Departamento Central. Si querés pasar a retirar tu pedido, coordinamos por WhatsApp.',
  },
  {
    q: '¿Cómo sé qué producto es para mí?',
    a: 'Escribinos por WhatsApp y te asesoramos según lo que necesités. Conocemos nuestros productos y te ayudamos a elegir.',
  },
]

export default function FaqPage() {
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
            Preguntas Frecuentes
          </h1>
          <p className="font-body mt-2" style={{ color: 'var(--theme-muted, #5C4033)' }}>
            Si no encontrás tu respuesta, escribinos por WhatsApp.
          </p>
        </div>

        <div className="animate-in max-w-2xl mx-auto">
          <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--theme-surface, #FDF8F0)', border: '1px solid var(--theme-border, #E8E0D5)' }}>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="font-body text-base text-left" style={{ color: 'var(--theme-text, #3D2817)' }}>
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="font-body leading-relaxed" style={{ color: 'var(--theme-muted, #5C4033)' }}>
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        <div className="animate-in text-center mt-10">
          <a
            href="https://wa.me/595992120303"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-body font-semibold text-sm px-6 py-3 rounded-full transition-all duration-300 hover:scale-105"
            style={{ backgroundColor: '#25D366', color: '#FFFFFF' }}
          >
            Escríbenos por WhatsApp
          </a>
        </div>
      </div>
    </main>
  )
}
