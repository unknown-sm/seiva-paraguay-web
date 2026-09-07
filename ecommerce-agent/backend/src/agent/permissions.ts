import { AppError } from '../errors.js';
import type { PermissionClass } from '../types.js';

const RANK: Record<PermissionClass, number> = { R: 0, W1: 1, W2: 2, W3: 3 };

const MAX_CLASS_BY_ROLE: Record<string, PermissionClass> = {
  admin: 'W3',
  operator: 'W1',
  viewer: 'R',
};

/**
 * Autorización por clase de tool. Se aplica en el backend SIEMPRE, aunque
 * n8n también filtre: la última línea de defensa es esta función.
 */
export function assertPermission(role: string, cls: PermissionClass): void {
  const max = MAX_CLASS_BY_ROLE[role] ?? 'R';
  if (RANK[cls] > RANK[max]) {
    throw new AppError('FORBIDDEN', `El rol '${role}' no puede ejecutar tools de clase ${cls} (máximo permitido: ${max})`, {
      hint: 'Esta acción requiere un rol con más permisos.',
    });
  }
}
