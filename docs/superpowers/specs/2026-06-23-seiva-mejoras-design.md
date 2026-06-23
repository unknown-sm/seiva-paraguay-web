# Seiva Paraguay — Mejoras (Junio 2026)

## M1: Prioridad de Marcas

**Backend:**
- Tabla `marcas` (id, nombre UNIQUE, prioridad INT DEFAULT 0, activo INT DEFAULT 1, logo TEXT)
- Migración: normalizar `productos.marca` → inserts en `marcas`
- `GET /api/productos` orden: `COALESCE(m.prioridad, 0) ASC` (menor = primero)
- Endpoints: `GET /api/marcas`, `PUT /api/marcas/:id`, `GET /api/marcas/normalizar`
- Campo `productos.marca` sigue como texto, JOIN con `marcas` para prioridad

**Admin:**
- Pestaña "Marcas" con tabla: Nombre, #Productos, Prioridad (input), Activo
- Botón rápido "Bajar prioridad" → set prioridad=100

**Frontend:**
- Orden de productos en `/api/productos` ya respeta prioridad, sin cambios en React

## M2: Fix Bug Descuentos

**Frontend:**
- `CartPage.tsx:98`: `product.precio * quantity` → usar `getDiscountedPrice(product, quantity) * quantity`
- Verificar `CheckoutPage.tsx`

## M3: Descuentos por Marca

**Backend:**
- Tabla `descuentos_marca` (id, marca_id FK, tipo_descuento TEXT, valor INT, min_cantidad INT, max_cantidad INT NULL, exclusiones JSON, inclusiones JSON, fecha_inicio, fecha_fin, etiqueta TEXT, audiencia TEXT DEFAULT 'todos')
- `GET /api/descuentos-marca`, `POST /api/descuentos-marca`, `PUT /api/descuentos-marca/:id`, `DELETE /api/descuentos-marca/:id`
- `parseProducto()`: consulta descuentos de marca → mezcla con `price_tiers` → mejor descuento gana (marca vs producto)
- Fix admin descuento modal: guardar `tipo_descuento`, `audiencia`, `fecha_inicio`, `fecha_fin`, `etiqueta` (ya existen en DB)

**Admin:**
- Tab Descuentos: sección "Descuentos por Marca" con CRUD
- Modal: seleccionar marca, tipo (%, monto fijo), tiers de cantidad, exclusiones (autocomplete productos), inclusiones (autocomplete productos)

## M4: Homepage WhatsApp → Carrito

**Frontend:**
- `Categories.tsx`: reemplazar `<a href={generateWhatsAppLink}>` por `<button onClick={addItem}>` (mismo patrón que FeaturedGrid)
- Mantener WhatsApp en: Navbar, MobileTabBar, Checkout final

## M5: WhatsApp Mejorado + Carrito Abandonado

**Frontend:**
- `generateWhatsAppLink()`: incluir URL del producto + nombre + precio
- Checkout: mensaje con resumen completo
- CartPage: prompt "¿Tu WhatsApp para avisarte si olvidás algo?" (antes de checkout)
- Guardar carrito en localStorage con timestamp para detección de abandono

**Backend:**
- Tabla `carritos_abandonados` (id, productos JSON, whatsapp TEXT, creado TEXT, notificado INT DEFAULT 0)
- `POST /api/carritos` (público), `GET /api/carritos` (admin)
- Endpoint webhook `POST /api/whatsapp-webhook` para recibir mensajes (WhatsApp Business API)
- Cron/timer: cada hora revisa carritos >1h sin checkout, envía WhatsApp via API

**Admin:**
- Pestaña "Carritos" con tabla: WhatsApp, Productos, Hora, Notificado
- Botón "Recordar por WhatsApp" manual
