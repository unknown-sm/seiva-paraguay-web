import type { Pool } from 'pg';
import type { AuditEntry, AuditQuery, PendingAction, SessionInfo, ToolResponse } from '../types.js';
import type { AuditStore, IdempotencyStore, PendingActionStore, SessionStore, Stores } from './types.js';

/** Stores sobre las tablas del agente en Postgres (migrations/001_agent_tables.sql). */
export function createPostgresStores(pool: Pool): Stores {
  const audit: AuditStore = {
    async append(e) {
      await pool.query(
        `INSERT INTO audit_log
           (session_key, user_id, tool, params, status, error, entity_type, entity_id, diff, request_id, duration_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          e.sessionKey,
          e.userId,
          e.tool,
          JSON.stringify(e.params ?? null),
          e.status,
          e.error ? JSON.stringify(e.error) : null,
          e.entityType ?? null,
          e.entityId ?? null,
          e.diff ? JSON.stringify(e.diff) : null,
          e.requestId ?? null,
          e.durationMs ?? null,
        ]
      );
    },
    async query(q) {
      const limit = q.limit ?? 50;
      const result = await pool.query(
        `SELECT * FROM audit_log
         WHERE ($1::text IS NULL OR session_key = $1)
           AND ($2::text IS NULL OR tool = $2)
           AND ($3::text IS NULL OR entity_id = $3)
           AND ($4::text IS NULL OR status = $4)
         ORDER BY ts DESC
         LIMIT $5`,
        [q.sessionKey ?? null, q.tool ?? null, q.entityId ?? null, q.status ?? null, limit]
      );
      return result.rows.map(rowToAuditEntry);
    },
  };

  const idem: IdempotencyStore = {
    async getResponse(key) {
      const r = await pool.query('SELECT response FROM idempotency_keys WHERE key = $1', [key]);
      return (r.rows[0]?.response as ToolResponse) ?? undefined;
    },
    async saveResponse(key, response) {
      await pool.query(
        'INSERT INTO idempotency_keys (key, response) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
        [key, JSON.stringify(response)]
      );
    },
  };

  const actions: PendingActionStore = {
    async create(a) {
      await pool.query(
        `INSERT INTO pending_actions
           (id, session_key, user_id, tool, params, preview, status, created_by, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8)`,
        [
          a.id,
          a.sessionKey,
          a.userId,
          a.tool,
          JSON.stringify(a.params),
          JSON.stringify(a.preview),
          a.createdBy,
          a.expiresAt,
        ]
      );
    },
    async get(id) {
      const r = await pool.query('SELECT * FROM pending_actions WHERE id = $1', [id]);
      return r.rows[0] ? rowToPendingAction(r.rows[0]) : undefined;
    },
    async setStatus(id, status) {
      const r = await pool.query(
        `UPDATE pending_actions
         SET status = $2, resolved_at = CASE WHEN $2 = 'pending' THEN NULL ELSE now() END
         WHERE id = $1
         RETURNING *`,
        [id, status]
      );
      return r.rows[0] ? rowToPendingAction(r.rows[0]) : undefined;
    },
  };

  const sessionStore: SessionStore = {
    async get(sessionKey) {
      const r = await pool.query('SELECT * FROM agent_sessions WHERE session_key = $1', [sessionKey]);
      return r.rows[0]
        ? {
            sessionKey: r.rows[0].session_key,
            role: r.rows[0].role,
            lastProductList: r.rows[0].last_product_list,
            lastFocusProductId: r.rows[0].last_focus_product_id,
            updatedAt: r.rows[0].updated_at?.toISOString(),
          }
        : undefined;
    },
    async save(s) {
      await pool.query(
        `INSERT INTO agent_sessions (session_key, role, last_product_list, last_focus_product_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (session_key) DO UPDATE
           SET role = EXCLUDED.role,
               last_product_list = EXCLUDED.last_product_list,
               last_focus_product_id = EXCLUDED.last_focus_product_id,
               updated_at = now()`,
        [
          s.sessionKey,
          s.role,
          s.lastProductList ? JSON.stringify(s.lastProductList) : null,
          s.lastFocusProductId ?? null,
        ]
      );
    },
  };

  return { audit, idempotency: idem, pendingActions: actions, sessions: sessionStore };
}

function rowToAuditEntry(row: Record<string, unknown>): AuditEntry {
  return {
    id: String(row.id),
    ts: row.ts instanceof Date ? row.ts.toISOString() : String(row.ts),
    sessionKey: String(row.session_key),
    userId: String(row.user_id),
    tool: String(row.tool),
    params: row.params ?? undefined,
    status: row.status as AuditEntry['status'],
    error: (row.error as AuditEntry['error']) ?? null,
    entityType: (row.entity_type as string | null) ?? null,
    entityId: (row.entity_id as string | null) ?? null,
    diff: (row.diff as AuditEntry['diff']) ?? null,
    requestId: (row.request_id as string | null) ?? null,
    durationMs: (row.duration_ms as number | null) ?? undefined,
  };
}

function rowToPendingAction(row: Record<string, unknown>): PendingAction {
  return {
    id: String(row.id),
    sessionKey: String(row.session_key),
    userId: String(row.user_id),
    tool: String(row.tool),
    params: row.params ?? null,
    preview: row.preview ?? null,
    status: row.status as PendingAction['status'],
    createdBy: String(row.created_by),
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    resolvedAt: row.resolved_at instanceof Date ? row.resolved_at.toISOString() : null,
  };
}
