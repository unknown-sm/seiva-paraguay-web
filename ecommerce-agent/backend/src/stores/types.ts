import type { AuditEntry, AuditQuery, PendingAction, SessionInfo, ToolResponse } from '../types.js';

export interface AuditStore {
  append(entry: AuditEntry): Promise<void>;
  query(q: AuditQuery): Promise<AuditEntry[]>;
}

export interface IdempotencyStore {
  getResponse(key: string): Promise<ToolResponse | undefined>;
  saveResponse(key: string, response: ToolResponse): Promise<void>;
}

export interface PendingActionStore {
  create(action: PendingAction): Promise<void>;
  get(id: string): Promise<PendingAction | undefined>;
  setStatus(id: string, status: PendingAction['status']): Promise<PendingAction | undefined>;
}

export interface SessionStore {
  get(sessionKey: string): Promise<SessionInfo | undefined>;
  save(session: SessionInfo): Promise<void>;
}

export interface Stores {
  audit: AuditStore;
  idempotency: IdempotencyStore;
  pendingActions: PendingActionStore;
  sessions: SessionStore;
}
