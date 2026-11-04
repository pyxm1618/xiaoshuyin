import Fastify from 'fastify';
import { configPlugin } from './plugins/config.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
    },
  });

  await app.register(configPlugin);

  app.get('/healthz', async () => {
    return { status: 'ok' };
  });

  return app;
}
