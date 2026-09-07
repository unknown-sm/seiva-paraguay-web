/**
 * Rate limiter por sesión: ventana deslizante en memoria.
 * Suficiente para un admin único; al escalar, mover a Redis.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly maxPerMinute: number) {}

  /** true si el uso está permitido, false si superó el límite. */
  check(key: string, now = Date.now()): boolean {
    const windowStart = now - 60_000;
    const previous = this.hits.get(key) ?? [];
    const inWindow = previous.filter((ts) => ts >= windowStart);
    if (inWindow.length >= this.maxPerMinute) {
      this.hits.set(key, inWindow);
      return false;
    }
    inWindow.push(now);
    this.hits.set(key, inWindow);
    return true;
  }
}
