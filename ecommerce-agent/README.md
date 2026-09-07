# ecommerce-agent

Sistema de administración de ecommerce mediante **Agente IA (Telegram + n8n + backend Node.js)**.

El administrador habla en lenguaje natural por Telegram; el agente interpreta la instrucción, decide qué herramientas usar, ejecuta acciones contra el ecommerce con permisos, confirmaciones y auditoría completa.

## Documentación

- [docs/arquitectura-agente-ecommerce.md](docs/arquitectura-agente-ecommerce.md) — documento técnico de arquitectura completo (v1.0): decisiones, seguridad, tools, memoria, fases, costos y riesgos.
- [backend/README.md](backend/README.md) — Agent API: quickstart, estructura y contrato.
- [n8n/README.md](n8n/README.md) — workflows y configuración de Telegram.

## Estado actual (Fase 0 + núcleo de Fase 1)

**Hecho y verificado** (tests 11/11, smoke test HTTP):

- Agent API completa en `backend/`: auth por API key, permisos por clase (R/W1/W2/W3) y rol,
  validación zod con hints para el LLM, idempotencia por `request_id`, rate limit por sesión,
  memoria de entidades (`last_product_list` para "el segundo"), acciones pendientes con
  expiración (confirm/cancel auditados) y `audit_log` con estados ok/error/rejected.
- 4 tools de lectura: `search_products`, `get_product`, `get_sales_report`, `get_inventory_report`.
- Migraciones SQL de las tablas del agente + stores Postgres y en memoria (MOCK_MODE).
- `docker-compose.yml` con Postgres y n8n.
- Workflow n8n `telegram-inbox.json` listo para importar (allowlist, AI Agent, memoria, 4 tools).

**Pendiente para cerrar Fase 1:** crear el bot en @BotFather, importar y configurar el workflow
en n8n (credenciales + API key + chat_id), y reemplazar `MockEcommerceAdapter` por la
implementación real sobre los servicios del ecommerce (`src/ecommerce/adapter.ts` define la
interfaz).

## Estructura del proyecto

```
ecommerce-agent/
├── docs/                  Documentación de arquitectura y decisiones
├── backend/               Agent API en Node.js (Fastify) — única puerta al ecommerce
│   └── src/agent/         Tool registry, permisos, validación, auditoría, jobs
└── n8n/                   Workflows exportados de n8n
    └── workflows/         telegram-inbox, callbacks, bulk-jobs, daily-alerts
```

## Componentes

| Componente | Rol |
|---|---|
| Telegram | Canal del admin (texto, fotos, botones inline de confirmación) |
| n8n (self-hosted) | Webhooks, AI Agent node, memoria de chat, orquestación |
| Agent API (Node.js) | Endpoints `/agent/v1/*`: permisos por clase (R/W1/W2/W3), validación, idempotencia, auditoría con diff, bulk jobs |
| Postgres | Datos del ecommerce + `audit_log`, `pending_actions`, `agent_sessions`, `bulk_jobs`, `inventory_movements` |
| Object storage (R2/S3) | Imágenes de productos |
| Servicio Playwright (Docker) | Scraping de páginas con JS dinámico |

## Plan de fases

0. Base: Agent API esqueleto (auth, tool registry, auditoría, idempotencia, allowlist Telegram)
1. **MVP**: agente con solo lectura — `search_products`, `get_product`, `get_sales_report`, `get_inventory_report`
2. Escritura W1/W2 con confirmaciones y diffs (update, precio, stock, crear borrador)
3. Imágenes (storage, ingest por Telegram, galerías)
4. Scraping e importación con borrador y preview
5. SEO (score determinista + generación)
6. Inventario avanzado (movimientos, alertas)
7. Reportes avanzados
8. Memoria avanzada + hardening + roles múltiples

Regla: no se avanza de fase sin una semana de uso real de la anterior.

## Reglas duras del sistema

1. El agente **nunca** accede directo a la base de datos — solo a la Agent API.
2. La auditoría la escribe el **backend**, no n8n.
3. Acciones críticas (W3) siempre con **confirmación por botones inline** que expira en 15 min.
4. Tareas masivas = **jobs en cola**, nunca loops del agente.
5. Contenido scrapeado = **dato, nunca instrucción**.
