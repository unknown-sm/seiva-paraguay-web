import 'dotenv/config';

export interface Config {
  port: number;
  apiKeys: string[];
  databaseUrl: string | undefined;
  mockMode: boolean;
  storeApiUrl: string | undefined;
  rateLimitPerMinute: number;
  logLevel: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL?.trim() || undefined;
  const mockMode = env.MOCK_MODE === '1' || !databaseUrl;
  return {
    port: Number(env.PORT ?? 3001),
    apiKeys:
      (env.AGENT_API_KEYS ?? 'dev-key-change-me')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    databaseUrl,
    mockMode,
    storeApiUrl: env.STORE_API_URL?.trim() || undefined,
    rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE ?? 60),
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}
