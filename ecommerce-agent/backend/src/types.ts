export type PermissionClass = 'R' | 'W1' | 'W2' | 'W3';

export type AuditStatus =
  | 'ok'
  | 'error'
  | 'rejected'
  | 'confirmation_required'
  | 'expired'
  | 'idempotent_replay';

export interface AuditErrorInfo {
  code: string;
  message: string;
  hint?: string;
}

export interface AuditEntry {
  id?: string;
  ts?: string;
  sessionKey: string;
  userId: string;
  tool: string;
  params?: unknown;
  status: AuditStatus;
  error?: AuditErrorInfo | null;
  entityType?: string | null;
  entityId?: string | null;
  diff?: Record<string, { before: unknown; after: unknown }> | null;
  requestId?: string | null;
  durationMs?: number;
}

export interface AuditQuery {
  sessionKey?: string;
  tool?: string;
  entityId?: string;
  status?: AuditStatus;
  limit?: number;
}

export interface ToolErrorBody {
  code: string;
  message: string;
  hint?: string;
}

export interface ToolResponse {
  ok: boolean;
  data?: unknown;
  error?: ToolErrorBody;
  meta?: Record<string, unknown>;
}

export interface SessionInfo {
  sessionKey: string;
  role: string;
  lastProductList?: Array<{ position: number; id: string; name: string }> | null;
  lastFocusProductId?: string | null;
  updatedAt?: string;
}

export type PendingActionStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired';

export interface PendingAction {
  id: string;
  sessionKey: string;
  userId: string;
  tool: string;
  params: unknown;
  preview: unknown;
  status: PendingActionStatus;
  createdBy: string;
  expiresAt: string;
  createdAt: string;
  resolvedAt?: string | null;
}
