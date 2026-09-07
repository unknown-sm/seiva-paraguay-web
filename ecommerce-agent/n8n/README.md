# n8n — workflows

Workflows self-hosted en Docker (`docker compose up -d n8n` desde la raíz → http://localhost:5678).
n8n es **solo orquestador**: toda la lógica de negocio vive en el backend.

## Workflows

| Archivo | Estado | Trigger | Función |
|---|---|---|---|
| `workflows/telegram-inbox.json` | **listo para importar (Fase 1)** | Webhook de Telegram | Allowlist chat_id → AI Agent (tools HTTP al backend) → respuesta TG. Memoria: Postgres Chat Memory con `session_key = tg_<chat_id>` |
| `telegram-callbacks.json` | Fase 2 | Callback de botones inline | `POST /agent/v1/actions/:id/confirm\|cancel` → responder |
| `bulk-jobs.json` | Fase 5 | Webhook/cron desde backend | Procesa lotes con modelo barato, checkpoints, resumen final por TG |
| `daily-alerts.json` | Fase 6 | Cron | Stock bajo / SEO score bajo / resumen diario |

## Configuración de `telegram-inbox.json` (después de importar)

1. **Importar:** n8n → Workflows → Import from File → `telegram-inbox.json` (o copiarlo a `/workflows` del contenedor).
2. **Telegram Trigger y Responder Telegram:** asignar credenciales de Telegram (bot token de @BotFather).
3. **Allowlist:** reemplazar el `123456789` de ejemplo por tu `chat.id` (se lo podés pedir a @userinfobot).
4. **AI Agent:** asignar credencial del modelo (OpenAI / Anthropic / etc.).
5. **Postgres Chat Memory:** asignar credencial Postgres apuntando al `postgres` del compose (host `postgres`, db `ecommerce_agent`, usuario `agent`). La tabla `n8n_chat_histories` se crea sola.
6. **Las 4 tools HTTP:** reemplazar `Bearer PONER_AGENT_API_KEY` por la API key del backend (la misma que `AGENT_API_KEYS` en su `.env`). Si n8n corre en Docker y el backend en el host, la URL `http://host.docker.internal:3001` ya sirve; ajustar si cambia el puerto.
7. Exponer n8n con HTTPS público (`WEBHOOK_URL` del compose: dominio propio o ngrok) para que Telegram llegue al webhook, y activar el workflow.

El system message del agente ya incluye las reglas del proyecto: no inventar datos, resolver
"el segundo" contra la última búsqueda, leer los `hint` de error antes de responder, y aclarar
que las acciones de escritura aún no están habilitadas (Fase 1 = solo lectura).

## Convenciones

- Cada tool del agente = un **HTTP Request Tool** que llama `POST <backend>/agent/v1/tools/<tool>`.
- El primer nodo tras el webhook valida la allowlist de `chat_id`; si no está, descarta silenciosamente.
- `request_id = $execution.id`: los reintentos dentro de la misma ejecución son idempotentes en el backend.
- Reintentos automáticos solo para errores de red/5xx; errores 4xx pasan al agente (que lee el `hint`).
- Exportar los workflows como JSON en `workflows/` para tener versionado.
