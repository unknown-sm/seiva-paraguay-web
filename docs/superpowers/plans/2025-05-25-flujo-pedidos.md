# Flujo de Pedidos Ecommerce — Implementation Plan

> **For agentic workers:** Use executing-plans inline. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Implementar flujo completo de pedidos desde el frontend React al backend Express, con gestión de estados en el backpanel admin.

**Architecture:** 
- Backend: nueva tabla `pedidos` con estados (pendiente, confirmado, enviado, entregado, cancelado). Endpoints público para crear pedido desde frontend, endpoints protegidos para admin gestionar.
- Frontend: nuevo servicio API + formulario de checkout en carrito. Envía pedido vía POST y luego redirige a WhatsApp.
- Admin: nueva pestaña "Pedidos" con tabla, filtros por estado, cambio de estado, descuento automático de stock al confirmar.

**Tech Stack:** Node.js Express + node:sqlite (backend), React + TypeScript (frontend), Vanilla JS (admin panel).

---

## File Map

### Backend
- `E:\Pagina_seiva\seiva-static\backend\server.js` — agregar tabla pedidos, endpoints, descuento de stock

### Frontend
- `E:\Pagina_seiva\seivvaweb\app\src\services\api.ts` — agregar `createPedido()`
- `E:\Pagina_seiva\seivvaweb\app\src\context\CartContext.tsx` — agregar `submitOrder()`
- `E:\Pagina_seiva\seivvaweb\app\src\pages\CartPage.tsx` — agregar formulario de checkout
- `E:\Pagina_seiva\seivvaweb\app\src\components\CartDrawer.tsx` — actualizar botón checkout si aplica

### Admin Panel
- `E:\Pagina_seiva\seiva-static\admin\index.html` — agregar tab "Pedidos"
- `E:\Pagina_seiva\seiva-static\admin\js\admin.js` — agregar toda la lógica de pedidos
- `E:\Pagina_seiva\seiva-static\admin\css\admin.css` — agregar estilos para badges de estado

---

## Task 1: Backend — Crear tabla pedidos y endpoints

**Files:**
- Modify: `E:\Pagina_seiva\seiva-static\backend\server.js`

- [ ] **Step 1.1: Agregar tabla pedidos en el init de la DB**

Agregar después de la tabla `ventas` (línea 51 aprox):

```sql
CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL DEFAULT (datetime('now')),
    cliente TEXT NOT NULL DEFAULT '',
    whatsapp TEXT NOT NULL DEFAULT '',
    direccion TEXT DEFAULT '',
    productos TEXT NOT NULL DEFAULT '[]',
    total INTEGER NOT NULL DEFAULT 0,
    metodo_pago TEXT DEFAULT 'whatsapp',
    estado TEXT DEFAULT 'pendiente',
    notas TEXT DEFAULT '',
    creado TEXT DEFAULT (datetime('now'))
);
```

- [ ] **Step 1.2: Agregar endpoint POST /api/pedidos (público, sin auth)**

```javascript
app.post("/api/pedidos", (req, res) => {
    const { cliente, whatsapp, direccion, productos, total, metodo_pago, notas } = req.body;
    if (!cliente || !whatsapp || !productos || !productos.length) {
        return res.status(400).json({ error: "Cliente, whatsapp y productos requeridos" });
    }
    const result = db.prepare(
        "INSERT INTO pedidos (cliente, whatsapp, direccion, productos, total, metodo_pago, notas) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
        cliente, whatsapp, direccion || "", JSON.stringify(productos), total || 0, metodo_pago || "whatsapp", notas || ""
    );
    res.json({ id: result.lastInsertRowid, estado: "pendiente" });
});
```

- [ ] **Step 1.3: Agregar endpoints GET, PATCH, DELETE para pedidos (con auth)**

```javascript
app.get("/api/pedidos", auth, (req, res) => {
    const estado = req.query.estado;
    let sql = "SELECT * FROM pedidos";
    let params = [];
    if (estado) { sql += " WHERE estado = ?"; params.push(estado); }
    sql += " ORDER BY fecha DESC";
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(r => ({ ...r, productos: JSON.parse(r.productos || "[]") })));
});

app.get("/api/pedidos/:id", auth, (req, res) => {
    const row = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "No encontrado" });
    res.json({ ...row, productos: JSON.parse(row.productos || "[]") });
});

app.patch("/api/pedidos/:id/estado", auth, (req, res) => {
    const { estado } = req.body;
    const estadosValidos = ["pendiente", "confirmado", "enviado", "entregado", "cancelado"];
    if (!estadosValidos.includes(estado)) return res.status(400).json({ error: "Estado invalido" });

    const pedido = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(req.params.id);
    if (!pedido) return res.status(404).json({ error: "No encontrado" });

    // Descuento de stock al confirmar
    if (estado === "confirmado" && pedido.estado !== "confirmado") {
        const productos = JSON.parse(pedido.productos || "[]");
        for (const p of productos) {
            if (p.id && p.cantidad) {
                db.prepare("UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?").run(p.cantidad, p.id, p.cantidad);
            }
        }
    }
    // Restaurar stock si se cancela (y antes estaba confirmado)
    if (estado === "cancelado" && pedido.estado === "confirmado") {
        const productos = JSON.parse(pedido.productos || "[]");
        for (const p of productos) {
            if (p.id && p.cantidad) {
                db.prepare("UPDATE productos SET stock = stock + ? WHERE id = ?").run(p.cantidad, p.id);
            }
        }
    }

    db.prepare("UPDATE pedidos SET estado = ? WHERE id = ?").run(estado, req.params.id);
    res.json({ ok: true, estado });
});

app.delete("/api/pedidos/:id", auth, (req, res) => {
    db.prepare("DELETE FROM pedidos WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
});
```

- [ ] **Step 1.4: Agregar endpoint para alertas de stock bajo**

```javascript
app.get("/api/stock-alertas", auth, (req, res) => {
    const limite = parseInt(req.query.limite) || 10;
    const rows = db.prepare("SELECT id, nombre, stock FROM productos WHERE stock <= ? AND activo = 1 ORDER BY stock ASC").all(limite);
    res.json(rows);
});
```

---

## Task 2: Frontend — Agregar API service para pedidos

**Files:**
- Modify: `E:\Pagina_seiva\seivvaweb\app\src\services\api.ts`

- [ ] **Step 2.1: Agregar interfaz y función createPedido**

Agregar al final del archivo:

```typescript
export interface PedidoPayload {
  cliente: string;
  whatsapp: string;
  direccion: string;
  productos: { id: number; nombre: string; precio: number; cantidad: number }[];
  total: number;
  metodo_pago: string;
  notas?: string;
}

export async function createPedido(payload: PedidoPayload): Promise<{ id: number; estado: string }> {
  const res = await fetch(`${API_BASE}/pedidos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create pedido');
  return res.json();
}
```

---

## Task 3: Frontend — Agregar formulario de checkout en CartPage

**Files:**
- Modify: `E:\Pagina_seiva\seivvaweb\app\src\pages\CartPage.tsx`

- [ ] **Step 3.1: Importar createPedido y agregar estado del formulario**

Cambiar imports:
```typescript
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, Send } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { formatPrice, createPedido } from '../services/api'
```

Dentro del componente, agregar estado:
```typescript
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [cliente, setCliente] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [direccion, setDireccion] = useState('')
  const [metodoPago, setMetodoPago] = useState('whatsapp')
  const [notas, setNotas] = useState('')
  const [sending, setSending] = useState(false)
  const [pedidoId, setPedidoId] = useState<number | null>(null)
```

- [ ] **Step 3.2: Crear función handleSubmitPedido**

```typescript
  const handleSubmitPedido = async () => {
    if (!cliente.trim() || !whatsapp.trim()) return
    setSending(true)
    try {
      const productos = items.map(i => ({
        id: i.product.id,
        nombre: i.product.nombre,
        precio: i.product.precio,
        cantidad: i.quantity
      }))
      const result = await createPedido({
        cliente,
        whatsapp,
        direccion,
        productos,
        total: totalPrice,
        metodo_pago: metodoPago,
        notas
      })
      setPedidoId(result.id)
      // Luego abrir WhatsApp con el pedido
      const lines = items.map(i => `• ${i.product.nombre} x${i.quantity} = ${formatPrice(i.product.precio * i.quantity)}`)
      const msg = encodeURIComponent(
        `Hola Seiva! Acabo de hacer el pedido #${result.id}:\n\n${lines.join('\n')}\n\n*Total: ${formatPrice(totalPrice)}*\n\nNombre: ${cliente}\nDirección: ${direccion || 'A coordinar'}`
      )
      window.open(`https://wa.me/595992120303?text=${msg}`, '_blank')
      clearCart()
    } catch (e) {
      alert('Error al enviar el pedido. Intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }
```

- [ ] **Step 3.3: Reemplazar el botón de WhatsApp por flujo de checkout**

Reemplazar el `<a>` de WhatsApp (líneas 150-165) por:

```tsx
            {!checkoutOpen ? (
              <button
                onClick={() => setCheckoutOpen(true)}
                className="w-full flex items-center justify-center gap-3 font-body font-semibold text-sm sm:text-base px-4 py-3 sm:px-6 sm:py-4 rounded-full transition-all duration-300 hover:scale-105"
                style={{
                  backgroundColor: 'var(--theme-primary, #1B4332)',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 24px rgba(27,67,50,0.25)',
                }}
              >
                <Send className="w-5 h-5" />
                Finalizar Pedido
              </button>
            ) : pedidoId ? (
              <div className="text-center p-4 rounded-xl" style={{ backgroundColor: '#d1fae5' }}>
                <p className="font-body font-bold" style={{ color: '#065f46' }}>Pedido #{pedidoId} enviado!</p>
                <p className="font-body text-sm mt-1" style={{ color: '#047857' }}>Te abrimos WhatsApp para confirmar.</p>
                <Link to="/tienda" className="inline-block mt-3 font-body font-medium text-sm" style={{ color: '#047857' }}>
                  Volver a la tienda
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Tu nombre *"
                  value={cliente}
                  onChange={e => setCliente(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl font-body text-sm border"
                  style={{ borderColor: 'var(--theme-border, #E8E0D5)', backgroundColor: '#fff' }}
                  required
                />
                <input
                  type="tel"
                  placeholder="WhatsApp (ej: 0992120303) *"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl font-body text-sm border"
                  style={{ borderColor: 'var(--theme-border, #E8E0D5)', backgroundColor: '#fff' }}
                  required
                />
                <input
                  type="text"
                  placeholder="Dirección de envío"
                  value={direccion}
                  onChange={e => setDireccion(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl font-body text-sm border"
                  style={{ borderColor: 'var(--theme-border, #E8E0D5)', backgroundColor: '#fff' }}
                />
                <select
                  value={metodoPago}
                  onChange={e => setMetodoPago(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl font-body text-sm border"
                  style={{ borderColor: 'var(--theme-border, #E8E0D5)', backgroundColor: '#fff' }}
                >
                  <option value="whatsapp">WhatsApp (pago a coordinar)</option>
                  <option value="efectivo">Efectivo al recibir</option>
                  <option value="transferencia">Transferencia bancaria</option>
                </select>
                <textarea
                  placeholder="Notas adicionales (opcional)"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl font-body text-sm border resize-none"
                  style={{ borderColor: 'var(--theme-border, #E8E0D5)', backgroundColor: '#fff' }}
                />
                <button
                  onClick={handleSubmitPedido}
                  disabled={sending || !cliente.trim() || !whatsapp.trim()}
                  className="w-full flex items-center justify-center gap-3 font-body font-semibold text-sm sm:text-base px-4 py-3 sm:px-6 sm:py-4 rounded-full transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: '#25D366',
                    color: '#FFFFFF',
                    boxShadow: '0 4px 24px rgba(37,211,102,0.35)',
                  }}
                >
                  {sending ? 'Enviando...' : 'Confirmar y enviar por WhatsApp'}
                </button>
                <button
                  onClick={() => setCheckoutOpen(false)}
                  className="w-full text-center font-body text-sm"
                  style={{ color: 'var(--theme-muted, #5C4033)' }}
                >
                  Cancelar
                </button>
              </div>
            )}
```

---

## Task 4: Admin Panel — Agregar pestaña Pedidos

**Files:**
- Modify: `E:\Pagina_seiva\seiva-static\admin\index.html`
- Modify: `E:\Pagina_seiva\seiva-static\admin\js\admin.js`
- Modify: `E:\Pagina_seiva\seiva-static\admin\css\admin.css`

- [ ] **Step 4.1: Agregar tab "Pedidos" en el nav del admin (index.html)**

Después de la línea del tab-dashboard:
```html
<button class="admin-tab" data-tab="tab-pedidos">🛍️ Pedidos</button>
```

Agregar el contenido del tab después del tab-dashboard:
```html
      <!-- TAB: Pedidos -->
      <div id="tab-pedidos" class="tab-content">
        <div class="section-actions">
          <select id="pedidos-filtro" class="search-input" style="width:auto">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="confirmado">Confirmado</option>
            <option value="enviado">Enviado</option>
            <option value="entregado">Entregado</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <span style="color:var(--muted);font-size:0.85rem">Filtrar por estado</span>
        </div>
        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr><th>ID</th><th>Fecha</th><th>Cliente</th><th>WhatsApp</th><th>Productos</th><th>Total</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody id="pedidos-tbody"></tbody>
          </table>
        </div>
      </div>
```

- [ ] **Step 4.2: Agregar lógica de pedidos en admin.js**

Agregar en `switchTab`:
```javascript
  if (tabId === "tab-pedidos") loadPedidos();
```

Agregar las funciones al final del archivo (antes del init):
```javascript
// ---------- PEDIDOS ----------
function loadPedidos() {
  var filtro = document.getElementById("pedidos-filtro").value;
  var url = "/pedidos" + (filtro ? "?estado=" + filtro : "");
  api(url).then(function(data) {
    document.getElementById("pedidos-tbody").innerHTML = data.map(function(p) {
      var prods = p.productos.map(function(pr) { return pr.cantidad + "x " + pr.nombre; }).join(", ");
      var badgeClass = "badge-" + p.estado;
      return '<tr>' +
        '<td>#' + p.id + '</td>' +
        '<td>' + formatDate(p.fecha) + '</td>' +
        '<td>' + (p.cliente || "—") + '</td>' +
        '<td>' + (p.whatsapp || "—") + '</td>' +
        '<td>' + prods + '</td>' +
        '<td><strong>' + formatGs(p.total) + '</strong></td>' +
        '<td><span class="badge ' + badgeClass + '">' + p.estado + '</span></td>' +
        '<td>' +
          '<select onchange="cambiarEstadoPedido(' + p.id + ', this.value)" class="estado-select">' +
            '<option value="pendiente"' + (p.estado === 'pendiente' ? ' selected' : '') + '>Pendiente</option>' +
            '<option value="confirmado"' + (p.estado === 'confirmado' ? ' selected' : '') + '>Confirmado</option>' +
            '<option value="enviado"' + (p.estado === 'enviado' ? ' selected' : '') + '>Enviado</option>' +
            '<option value="entregado"' + (p.estado === 'entregado' ? ' selected' : '') + '>Entregado</option>' +
            '<option value="cancelado"' + (p.estado === 'cancelado' ? ' selected' : '') + '>Cancelado</option>' +
          '</select>' +
          '<button class="btn-icon" onclick="eliminarPedido(' + p.id + ')" title="Eliminar">🗑</button>' +
        '</td>' +
      '</tr>';
    }).join("");
  });
}

function cambiarEstadoPedido(id, estado) {
  api("/pedidos/" + id + "/estado", { method: "PATCH", body: JSON.stringify({ estado: estado }) }).then(function() {
    toast("Estado actualizado a " + estado);
    loadPedidos();
  });
}

function eliminarPedido(id) {
  if (!confirm("Eliminar este pedido?")) return;
  api("/pedidos/" + id, { method: "DELETE" }).then(function() {
    loadPedidos();
    toast("Pedido eliminado");
  });
}
```

En el init DOMContentLoaded, agregar:
```javascript
  var pedidosFiltro = document.getElementById("pedidos-filtro");
  if (pedidosFiltro) {
    pedidosFiltro.addEventListener("change", loadPedidos);
  }
```

- [ ] **Step 4.3: Agregar estilos CSS para badges de estado**

Agregar al final de `admin.css`:
```css
.badge { display:inline-block; padding:2px 10px; border-radius:12px; font-size:0.75rem; font-weight:600; text-transform:uppercase; }
.badge-pendiente { background:#fef3c7; color:#92400e; }
.badge-confirmado { background:#d1fae5; color:#065f46; }
.badge-enviado { background:#dbeafe; color:#1e40af; }
.badge-entregado { background:#d1fae5; color:#065f46; }
.badge-cancelado { background:#fee2e2; color:#991b1b; }
.estado-select { font-size:0.8rem; padding:4px 8px; border-radius:6px; border:1px solid var(--border); margin-right:4px; }
```

---

## Task 5: Admin Panel — Agregar alertas de stock bajo al Dashboard

**Files:**
- Modify: `E:\Pagina_seiva\seiva-static\admin\js\admin.js`
- Modify: `E:\Pagina_seiva\seiva-static\admin\index.html`

- [ ] **Step 5.1: Agregar sección de alertas en el dashboard HTML**

En `tab-dashboard`, agregar después de `dashboard-grid`:
```html
          <div class="dashboard-card" style="margin-top:24px">
            <h4>Alertas de Stock Bajo</h4>
            <div id="stock-alertas"></div>
          </div>
```

- [ ] **Step 5.2: Agregar carga de alertas en loadDashboard**

```javascript
  api("/stock-alertas?limite=10").then(function(alertas) {
    var el = document.getElementById("stock-alertas");
    if (!alertas.length) {
      el.innerHTML = '<p style="color:var(--muted);font-size:0.85rem">No hay alertas de stock.</p>';
      return;
    }
    el.innerHTML = '<table><thead><tr><th>Producto</th><th>Stock</th></tr></thead><tbody>' +
      alertas.map(function(a) {
        return '<tr><td>' + a.nombre + '</td><td style="color:#E63946;font-weight:600">' + a.stock + '</td></tr>';
      }).join("") + '</tbody></table>';
  });
```

---

## Task 6: Build y verificación

- [ ] **Step 6.1: Reconstruir frontend React**

Run: `cmd /c "cd /d E:\Pagina_seiva\seivvaweb\app && npm run build"`
Expected: build exit 0

- [ ] **Step 6.2: Verificar backend levanta**

Run: `node E:\Pagina_seiva\seiva-static\backend\server.js` (testear brevemente)

---

## Spec Coverage Check

| Requerimiento | Task |
|---|---|
| Tabla pedidos en DB | Task 1.1 |
| Endpoint POST /api/pedidos (público) | Task 1.2 |
| Endpoints GET/PATCH/DELETE pedidos (auth) | Task 1.3 |
| Descuento de stock al confirmar | Task 1.3 (PATCH) |
| Restaurar stock al cancelar | Task 1.3 (PATCH) |
| Alertas stock bajo endpoint | Task 1.4 |
| Frontend: createPedido API | Task 2 |
| Frontend: checkout form en CartPage | Task 3 |
| Admin: tab Pedidos | Task 4 |
| Admin: cambio de estado | Task 4.2 |
| Admin: alertas stock en dashboard | Task 5 |

---

## Post-Implementation Suggestions (from Superpowers)

After completing this plan, consider:
1. **Cupones/Descuentos**: add `cupones` table with code, percentage, expiry, max_uses
2. **Clientes DB**: separate `clientes` table linked to pedidos for CRM
3. **Email notifications**: Nodemailer for order confirmations
4. **Export Excel**: `xlsx` library for exporting pedidos/ventas
5. **Reviews**: allow clients to review products after delivery
6. **Wishlist/Favoritos**: localStorage or DB table for saved products
7. **Multi-image products**: support array of images per product
8. **Shipping zones**: calculate shipping cost by city/department
