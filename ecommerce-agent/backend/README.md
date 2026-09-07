# backend — Agent API

Node.js + TypeScript + Fastify. Es la **única puerta** entre el agente IA y el ecommerce.

> **Estado actual (Fase 0 + núcleo de Fase 1):** esqueleto completo y funcionando en modo mock
> (sin BD). Pipeline de tools con permisos, validación, idempotencia, rate limit, memoria de
> entidades y auditoría verificados por tests y smoke test. Las 4 tools de lectura están activas;
> las de escritura llegan en Fase 2.

## Quickstart

```bash
cd E:/ecommerce-agent/backend
npm install

# Modo mock (sin BD, adapter con datos de ejemplo): arranca directo
npm run dev          # http://localhost:3001

# Modo Postgres (uso real):
#   1. docker compose up -d postgres   (desde la raíz del proyecto)
#   2. cp .env.example .env  y definir DATABASE_URL + AGENT_API_KEYS
#   3. npm run migrate
#   4. npm run dev
```

Scripts: `dev` (tsx watch) · `build` / `start` · `migrate` · `test` (vitest) · `typecheck`.

## Estructura

```
src/
├── server.ts               Entry: elige stores (memoria/postgres), adapter y registry
├── app.ts                  Fastify app: health, prefijo /agent/v1, error handler
├── config.ts               Env: PORT, AGENT_API_KEYS, DATABASE_URL, MOCK_MODE, RATE_LIMIT
├── errors.ts               AppError con código + hint (lo que el agente lee para autocorregirse)
├── db.ts                   Pool pg + runner de migraciones
├── rateLimit.ts            Ventana deslizante por sesión
├── types.ts                DTOs compartidos (audit, sesión, acciones pendientes, respuestas)
├── routes/agent.ts         Endpoints: tools, acciones pendientes, auditoría
├── agent/
│   ├── tool-registry.ts    Catálogo: name, description, permissionClass, schema zod, handler
│   ├── permissions.ts      Roles admin/operator/viewer vs clases R/W1/W2/W3
│   └── run-tool.ts         Pipeline: rate limit → idempotencia → validación → permisos →
│                           handler → memoria de sesión → auditoría (siempre)
├── ecommerce/
│   ├── adapter.ts          Interfaz EcommerceAdapter (reemplazar por los servicios reales)
│   ├── mock-adapter.ts     Datos deterministas para desarrollo/tests
│   └── period.ts           this_week, last_month, 2026-08, ... → rango [from, to)
├── tools/read-tools.ts     search_products, get_product, get_sales_report, get_inventory_report
└── stores/
    ├── types.ts            Contratos de los stores
    ├── memory.ts           Implementación en memoria (MOCK_MODE / tests)
    └── postgres.ts         Implementación sobre migrations/001_agent_tables.sql
```

## Contrato

```
POST /agent/v1/tools/:tool_name
Headers: Authorization: Bearer <AGENT_API_KEY>
Body:    { "params": {...}, "context": { "session_key": "tg_123", "request_id": "..." } }
200 → { "ok": true, "data": {...}, "meta"?: {...} }
4xx → { "ok": false, "error": { "code": "VALIDATION|NOT_FOUND|...", "message": "...", "hint": "..." } }
```

Otros endpoints: `POST /agent/v1/actions` (crear acción pendiente), `POST /actions/:id/confirm|cancel`
(confirmaciones con expiración; la ejecución real se conecta en Fase 2), `GET /actions/:id`,
`GET /agent/v1/audit?session_key=...&tool=...`, `GET /health`.

## Mecanismos ya implementados

| Mecanismo | Comportamiento |
|---|---|
| Idempotencia | `request_id` + tool + sesión = clave; un retry de n8n devuelve la respuesta cacheada sin re-ejecutar (`meta.idempotentReplay: true`) |
| Auditoría | Toda salida queda en `audit_log`: ok, error, rejected, idempotent_replay, confirmation_required |
| Permisos | Clase por tool + rol por sesión; se aplican en el backend, no en n8n |
| Rate limit | Por sesión_key, configurable (`RATE_LIMIT_PER_MINUTE`), auditable |
| Memoria de entidades | `search_products` persiste la lista numerada; "el segundo" se resuelve por id real |
| Hints de error | Los 4xx incluyen `hint` con la corrección sugerida para el LLM |
| Tolerancia n8n | Params string (`"5"`), booleanos `"true"`, opcionales vacíos (`""` → default del schema) |

## Integración con el ecommerce real

`src/ecommerce/adapter.ts` define la interfaz (`searchProducts`, `getProduct`, `getSalesReport`,
`getInventoryReport`). La integración consiste en implementar esa interfaz sobre los
servicios/modelos del ecommerce y cambiar una línea en `server.ts`; el resto del sistema
(pipeline, seguridad, auditoría) no cambia.

## Prueba rápida

```bash
curl -s http://localhost:3001/health

curl -s -X POST http://localhost:3001/agent/v1/tools/search_products \
  -H "Authorization: Bearer dev-key-change-me" -H "Content-Type: application/json" \
  -d '{"params":{"query":"magnesio"},"context":{"session_key":"tg_1","request_id":"r1"}}'

curl -s "http://localhost:3001/agent/v1/audit?session_key=tg_1" \
  -H "Authorization: Bearer dev-key-change-me"
```
