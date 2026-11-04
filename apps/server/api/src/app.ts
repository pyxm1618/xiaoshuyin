import Fastify from 'fastify';
import pg from 'pg';
import { configPlugin } from './plugins/config.js';
import { registerAuthPlugin } from './plugins/auth.js';
import { errorHandler } from './plugins/error-handler.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerMeRoutes } from './routes/me.js';
import { registerFamilyRoutes } from './routes/families.js';
import { FakeWechatProvider } from './auth/wechat-provider.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'warn',
    },
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Config
  await app.register(configPlugin);

  // Database pool
  const pool = new pg.Pool({
    connectionString: process.env['DATABASE_URL'],
    max: 10,
  });

  const sessionSecret = process.env['SESSION_SECRET'] ?? 'dev-secret-key-for-testing';
  const wechatProvider = new FakeWechatProvider();

  // Auth plugin
  registerAuthPlugin(app, pool, sessionSecret);

  // Health check (no auth)
  app.get('/healthz', async () => {
    return { status: 'ok' };
  });

  // Routes
  registerAuthRoutes(app, pool, wechatProvider, sessionSecret);
  registerMeRoutes(app, pool);
  registerFamilyRoutes(app, pool);

  return app;
}
