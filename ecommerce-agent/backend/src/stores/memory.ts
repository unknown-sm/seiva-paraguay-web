import type { AuditEntry, AuditQuery, PendingAction, SessionInfo, ToolResponse } from '../types.js';
import type { AuditStore, IdempotencyStore, PendingActionStore, SessionStore, Stores } from './types.js';

/** Stores en memoria: para desarrollo sin BD (MOCK_MODE) y para tests. */
export function createMemoryStores(): Stores {
  const auditEntries: AuditEntry[] = [];
  const idempotency = new Map<string, ToolResponse>();
  const pendingActions = new Map<string, PendingAction>();
  const sessions = new Map<string, SessionInfo>();

  const audit: AuditStore = {
    async append(entry) {
      auditEntries.push({ ...entry, ts: entry.ts ?? new Date().toISOString() });
    },
    async query(q: AuditQuery) {
      const limit = q.limit ?? 50;
      return auditEntries
        .filter(
          (e) =>
            (!q.sessionKey || e.sessionKey === q.sessionKey) &&
            (!q.tool || e.tool === q.tool) &&
            (!q.entityId || e.entityId === q.entityId) &&
            (!q.status || e.status === q.status)
        )
        .slice(-limit)
        .reverse();
    },
  };

  const idem: IdempotencyStore = {
    async getResponse(key) {
      return idempotency.get(key);
    },
    async saveResponse(key, response) {
      if (!idempotency.has(key)) idempotency.set(key, response);
    },
  };

  const actions: PendingActionStore = {
    async create(action) {
      pendingActions.set(action.id, action);
    },
    async get(id) {
      return pendingActions.get(id);
    },
    async setStatus(id, status) {
      const action = pendingActions.get(id);
      if (!action) return undefined;
      const updated: PendingAction = {
        ...action,
        status,
        resolvedAt: status === 'pending' ? null : new Date().toISOString(),
      };
      pendingActions.set(id, updated);
      return updated;
    },
  };

  const sessionStore: SessionStore = {
    async get(sessionKey) {
      return sessions.get(sessionKey);
    },
    async save(session) {
      sessions.set(session.sessionKey, { ...session, updatedAt: new Date().toISOString() });
    },
  };

  return { audit, idempotency: idem, pendingActions: actions, sessions: sessionStore };
}
