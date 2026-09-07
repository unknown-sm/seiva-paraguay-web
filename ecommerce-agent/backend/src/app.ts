import Fastify, { type FastifyInstance } from 'fastify';
import { AppError } from './errors.js';
import { agentRoutes, type AgentRouteDeps } from './routes/agent.js';

export interface AppDeps extends AgentRouteDeps {
  mode: 'mock' | 'postgres';
  logLevel: string;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: { level: deps.logLevel } });

  app.get('/health', async () => ({
    ok: true,
    service: 'ecommerce-agent-api',
    mode: deps.mode,
    tools: deps.registry.names(),
  }));

  app.register(
    async (instance) => {
      await agentRoutes(instance, deps);
    },
    { prefix: '/agent/v1' }
  );

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({
        ok: false,
        error: { code: err.code, message: err.message, ...(err.hint ? { hint: err.hint } : {}) },
      });
    }
    const fastifyErr = err as { validation?: unknown; statusCode?: number };
    if (fastifyErr.validation || fastifyErr.statusCode === 400) {
      const message = err instanceof Error ? err.message : 'Request inválido';
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION', message } });
    }
    req.log.error(err);
    return reply.code(500).send({ ok: false, error: { code: 'INTERNAL', message: 'Error interno' } });
  });

  return app;
}
