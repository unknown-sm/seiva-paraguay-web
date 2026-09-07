import type { ZodType, ZodTypeDef } from 'zod';
import { AppError } from '../errors.js';
import type { PermissionClass, SessionInfo } from '../types.js';
import type { EcommerceAdapter } from '../ecommerce/adapter.js';
import type { Stores } from '../stores/types.js';

export interface ToolContext {
  sessionKey: string;
  userId: string;
  requestId: string;
  role: string;
  adapter: EcommerceAdapter;
  stores: Stores;
}

export interface ToolHandlerResult {
  data: unknown;
  entityType?: string;
  entityId?: string;
  diff?: Record<string, { before: unknown; after: unknown }>;
  /** Actualización de la memoria de entidades de la sesión (last_product_list, etc.). */
  sessionUpdate?: Partial<Pick<SessionInfo, 'lastProductList' | 'lastFocusProductId'>>;
}

export interface ToolDefinition<P = any> {
  name: string;
  description: string;
  permissionClass: PermissionClass;
  // Input=unknown para tolerar schemas con defaults/coerción (input ≠ output).
  paramSchema: ZodType<P, ZodTypeDef, unknown>;
  handler: (params: P, ctx: ToolContext) => Promise<ToolHandlerResult>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<any>>();

  register(defs: Array<ToolDefinition<any>>): void {
    for (const def of defs) this.tools.set(def.name, def);
  }

  get(name: string): ToolDefinition<any> {
    const def = this.tools.get(name);
    if (!def) {
      throw new AppError('TOOL_NOT_FOUND', `Tool desconocida: '${name}'`, {
        hint: `Tools disponibles: ${this.names().join(', ')}`,
      });
    }
    return def;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  names(): string[] {
    return [...this.tools.keys()];
  }
}
