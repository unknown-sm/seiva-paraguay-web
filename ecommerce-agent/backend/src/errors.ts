export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'TOOL_NOT_FOUND'
  | 'CONFIRMATION_REQUIRED'
  | 'INVALID_STATE'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'INTERNAL';

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOOL_NOT_FOUND: 404,
  CONFIRMATION_REQUIRED: 409,
  INVALID_STATE: 409,
  RATE_LIMITED: 429,
  TIMEOUT: 504,
  INTERNAL: 500,
};

export function statusForCode(code: string): number {
  return statusByCode[code as ErrorCode] ?? 500;
}

export interface AppErrorOptions {
  hint?: string;
  details?: unknown;
}

/**
 * Error con código estable + hint de recuperación. El `hint` es lo que el
 * agente LLM lee para auto-corregirse (ej: "usá search_products para
 * obtener el product_id") en lugar de adivinar.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly hint?: string;
  readonly details?: unknown;
  readonly statusCode: number;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.hint = options.hint;
    this.details = options.details;
    this.statusCode = statusByCode[code];
  }
}
