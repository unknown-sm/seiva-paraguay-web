# SEIVA — Workflows n8n

## Workflow del bot de inventario (activo)

| Campo | Valor |
|---|---|
| **Nombre** | Seiva - Agente Inventario v2 (sin tools) |
| **ID** | `cLctBPDSRXliimrV` |
| **URL UI** | https://n8n.seiva.com.py/workflow/cLctBPDSRXliimrV |
| **Webhook** | `https://n8n.seiva.com.py/webhook/seiva-agent-v2/webhook` |
| **Telegram bot** | @Listasuplementos_bot |

### Arquitectura (8 nodos, lineal)

```
Telegram Trigger
  → Cargar inventario      (HTTP Request GET /api/productos/all)
  → Preparar entrada       (Code: arma chatId + mensaje + inventario)
  → Agente Inventario      (mimo via OpenRouter, devuelve SOLO JSON)
  → Parsear accion         (Code: extrae accion/id/valor/datos)
  → Ejecutar accion        (Code: hace el HTTP real al backend)
  → Responder              (Telegram)
```

**El agente NO ejecuta nada.** Solo interpreta y devuelve JSON. El nodo
`Ejecutar accion` hace la llamada HTTP real y solo confirma si salió bien.

### Formato que devuelve el agente

```json
{
  "accion": "ajustar_stock|publicar|despublicar|editar|crear|aclarar|consultar",
  "id": 188,
  "valor": 5,
  "datos": {},
  "respuesta": "texto para el usuario"
}
```

### Puntos críticos (no romper)

1. **`responseFormat: 'json_object'`** en el modelo OpenRouter.
   Es lo que OBLIGA a mimo a devolver JSON. Sin esto responde en prosa
   y el bot miente (dice "listo" sin ejecutar nada).
2. **Sin memoria.** El nodo de memoria hacía que el modelo se pusiera a
   charlar en vez de devolver JSON. Se eliminó a propósito.
3. **Sin herramientas (tools).** `toolHttpRequest` no tiene método `execute`
   en n8n 2.36.8 (solo `supplyData`), y `toolCode` no propaga el resultado
   al agente. Por eso el diseño usa HTTP Request + Code.
4. **Activar SIEMPRE desde la UI**, nunca por API. El activate por API
   no registra el secret del webhook → Telegram recibe `403 Provided secret
   is not valid`.

### Endpoints del backend que usa

- `GET   https://seiva.com.py/api/productos/all`
- `PUT   https://seiva.com.py/api/productos/:id`
- `PATCH https://seiva.com.py/api/productos/:id/toggle`
- `POST  https://seiva.com.py/api/productos`

Autenticación: header `Authorization: Bearer <JWT>`
(credencial n8n `httpHeaderAuth` = "SEIVA Backend API").

## Entorno n8n

| Campo | Valor |
|---|---|
| Versión | 2.36.8 (Self Hosted) |
| Host | https://n8n.seiva.com.py |
| VPS | 85.239.246.177 (Contabo) |
| Container | `whatsappcrmv2-n8nwithpostgres-tccpju-n8n-1` |
| DB | Postgres (`POSTGRES_DB=n8n`) |
| Timezone | `America/Asuncion` |

### Variables de entorno importantes (Dokploy)

```
N8N_HOST=n8n.seiva.com.py
WEBHOOK_URL=https://n8n.seiva.com.py/
N8N_PROTOCOL=https          ← si está en http, n8n rechaza los webhooks
GENERIC_TIMEZONE=America/Asuncion
```

## Workflow ACTUAL: Seiva - Inventario v4 (Cerebro)

| Campo | Valor |
|---|---|
| **Nombre** | Seiva - Inventario v4 (Cerebro) |
| **ID** | `S0dMJVZa4P6RNy1X` |
| **Webhook** | `https://n8n.seiva.com.py/webhook/seiva-agent-v4/webhook` |
| **Nodos** | `Telegram Trigger → Cerebro → Responder` (3 nodos) |

Arquitectura: un único nodo **Code** (el "Cerebro"). El LLM (mimo-v2.5 vía
OpenRouter, `response_format: json_object`) **solo interpreta** lenguaje natural
y devuelve JSON; el Cerebro **ejecuta determinista** y confirma SIEMPRE con el
resultado real del backend. Los flujos con confirmación usan la tabla
`bot_sessions` (endpoints `/api/bot-session/:chatId`).

Comandos soportados: `stock 188 5` / "poné el colostro en 5" / "sumá 3 al 190" /
"restá 2 a la creatina", `publicá 188`, `ocultá 188`, `crear … precio … stock …`
(texto, link con `/api/scrape-product`, o foto), `eliminá 188` (con CONFIRMAR),
`lista`, `buscar X`, `qué hay sin stock`, `ayuda`, y charla libre.

Endpoints del backend que usa: `/api/productos/all`, `/api/productos` (POST/PUT/DELETE),
`/api/productos/stock-batch`, `/api/productos/:id/toggle`, `/api/scrape-product`,
`/api/bot-session/:chatId`.

Fuente: `scripts/brain-source.js` (placeholder `__TOKEN__`/`__OR_KEY__`/`__TG_TOKEN__`,
los inyecta `scripts/build_v4.js`). Build+deploy: `node scripts/build_v4.js --deploy`.

## Archivos

- `seiva-agente-inventario-v4.json` — export del workflow v4 (actual)
- `seiva-agente-inventario-v3.json` — versión determinista simple (previa)
- `seiva-agente-inventario-v2.json` — export del workflow v2 (agente, obsoleto)
- `seiva-agente-inventario-v1-BACKUP.json` — versión anterior (con tools, rota)
- `inventario-workflows.json` — listado de los 13 workflows de la cuenta
- `scripts/` — scripts Node que construyen/parchean el workflow por API
  - `brain-source.js` — lógica del Cerebro v4
  - `build_v4.js` — arma y despliega v4 (idempotente)

## Comandos útiles

Exportar el workflow actualizado:
```bash
node scripts/export_workflow.js
```

Ver el estado de un producto (verificar que el bot sí impactó):
```bash
curl -s -H "Authorization: Bearer $(cat jwt.txt)" \
  https://seiva.com.py/api/productos/all | python -c \
  "import sys,json; [print(p['id'], p['nombre'], p['stock']) for p in json.load(sys.stdin) if p['id']==188]"
```

Consultar el webhook de Telegram:
```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

## Lecciones / pitfalls de n8n 2.36.8

- `toolHttpRequest` → error `has a supplyData method but no execute method`.
  No usar herramientas de ese tipo con el agente.
- `toolCode` → el `return` no vuelve al agente (devuelve vacío). No sirve
  para que el agente vea resultados.
- `typeVersion 2` en `toolHttpRequest` **no existe** (solo 1 y 1.1).
- Activar por API rompe el secret del webhook. Usar la UI.
- `N8N_PROTOCOL=http` → webhooks rechazados con `secret is not valid`.
- Switch v3.2: puede no tomar `parameters.rules` y devolver salida vacía.
  Se reemplazó por un nodo Code (más simple y confiable).
