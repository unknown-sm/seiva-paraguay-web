import { useState, useEffect } from 'react'
import { Truck, CreditCard, ShieldCheck, ChevronDown } from 'lucide-react'

const FALLBACKS: Record<string, string> = {
  envios: `<p>Realizamos envios a <strong>todo Paraguay</strong>.</p>
<ul>
  <li><strong>Asunción y Central:</strong> Delivery en 24-48h hábiles. Costo: Gs. 15.000</li>
  <li><strong>Interior:</strong> Encomienda por transportadora. Tiempo: 2-5 días hábiles según destino.</li>
  <li><strong>Envío gratis:</strong> Compras superiores a Gs. 150.000 en Asunción y Central.</li>
</ul>
<p>Coordinamos la entrega por WhatsApp para asegurar que recibas tu pedido sin demoras.</p>`,
  pagos: `<ul>
  <li><strong>Transferencia bancaria:</strong> Aceptamos transferencias de todos los bancos.</li>
  <li><strong>Pago QR:</strong> Escaneá y pagá desde cualquier app bancaria.</li>
  <li><strong>Efectivo contra entrega:</strong> Disponible en Asunción y Central.</li>
  <li><strong>Giros Tigo/Money:</strong> Rápido y sin costo adicional.</li>
</ul>
<p>Todos los pagos se coordinan por WhatsApp al <strong>0992 120 303</strong>.</p>`,
  garantia: `<ul>
  <li><strong>Productos sellados:</strong> Si el producto no fue abierto, aceptamos devolución dentro de 7 días.</li>
  <li><strong>Productos dañados:</strong> Si recibís un producto en mal estado, lo reemplazamos sin costo.</li>
  <li><strong>Calidad garantizada:</strong> Trabajamos con marcas premium. Todos nuestros productos tienen control de calidad.</li>
</ul>
<p>Tu satisfacción es nuestra prioridad. Cualquier inconveniente, escribinos por WhatsApp.</p>`,
}

const SECTIONS = [
  { id: 'envios', icon: Truck, title: 'Envíos', contentKey: 'global_envios' },
  { id: 'pagos', icon: CreditCard, title: 'Métodos de pago', contentKey: 'global_pagos' },
  { id: 'garantia', icon: ShieldCheck, title: 'Garantía y devoluciones', contentKey: 'global_garantia' },
]

export default function GlobalSections() {
  const [open, setOpen] = useState<string | null>(null)
  const [contents, setContents] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/contenido')
      .then(r => r.json())
      .then(data => {
        const map: Record<string, string> = {}
        for (const row of data) {
          if (row.key.startsWith('global_')) {
            map[row.key.replace('global_', '')] = row.value
          }
        }
        setContents(map)
      })
      .catch(() => setContents({}))
  }, [])

  const getContent = (id: string) => {
    return contents[id] || FALLBACKS[id] || ''
  }

  return (
    <div className="space-y-3">
      <h3 className="font-serif text-lg mb-4" style={{ color: 'var(--theme-forest, #1B4332)' }}>
        Información útil
      </h3>
      {SECTIONS.map(section => {
        const Icon = section.icon
        const isOpen = open === section.id
        return (
          <div
            key={section.id}
            className="rounded-xl overflow-hidden border transition-all"
            style={{
              borderColor: isOpen ? 'var(--theme-primary, #1B4332)' : 'var(--theme-border, #E8E0D5)',
              backgroundColor: 'var(--theme-surface, #FFF)',
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : section.id)}
              className="w-full flex items-center justify-between px-4 py-3 font-body text-sm font-semibold hover:opacity-80 transition-opacity"
              style={{ color: 'var(--theme-text, #3D2817)' }}
            >
              <span className="flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color: 'var(--theme-primary, #1B4332)' }} />
                {section.title}
              </span>
              <ChevronDown
                className="w-4 h-4 transition-transform duration-300"
                style={{
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  color: 'var(--theme-muted, #5C4033)',
                }}
              />
            </button>
            <div
              className="overflow-hidden transition-all duration-300"
              style={{ maxHeight: isOpen ? '500px' : '0px', opacity: isOpen ? 1 : 0 }}
            >
              <div
                className="px-4 pb-4 font-body text-xs leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mb-1 [&_p]:mb-2"
                style={{ color: 'var(--theme-muted, #5C4033)' }}
                dangerouslySetInnerHTML={{ __html: getContent(section.id) }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
