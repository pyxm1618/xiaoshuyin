import Fastify from 'fastify';
import pg from 'pg';
import { configPlugin } from './plugins/config.js';
import { registerAuthPlugin } from './plugins/auth.js';
import { errorHandler } from './plugins/error-handler.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerMeRoutes } from './routes/me.js';
import { registerFamilyRoutes } from './routes/families.js';
import { registerMemberRoutes } from './routes/members.js';
import { registerComplianceRoutes } from './routes/compliance.js';
import { registerConsentRoutes } from './routes/consents.js';
import { registerCaseRoutes } from './routes/cases.js';
import { registerIdentityBindingRoutes } from './routes/identity-bindings.js';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import {
  createWechatProvider,
  loadRuntimeConfig,
  type RuntimeConfig,
} from './runtime-env.js';
import type { WechatAuthProvider } from './auth/wechat-provider.js';
import {
  UnavailableInvitationPort,
  type InvitationResolutionPort,
} from './identity-binding/invitation-port.js';

export interface BuildAppOptions {
  env?: NodeJS.ProcessEnv;
  /** Test-only sink used to assert log privacy (F11). */
  loggerStream?: NodeJS.WritableStream;
  /** Test-only sink to capture real registered route schemas (contract drift). */
  onRoute?: (route: any) => void;
  /**
   * Identity-binding injection points. Production uses the fail-closed
   * UnavailableInvitationPort until the Slice 4 runtime adapter is merged
   * (T121); tests inject the contract-level fixture.
   */
  identityBinding?: {
    invitationPort?: InvitationResolutionPort;
    wechatProvider?: WechatAuthProvider;
  };
}

/**
 * Request serializer for logs (F11).
 *
 * Fastify's default serializer emits `remoteAddress` / `remotePort` at
 * `LOG_LEVEL=info`. Raw client IP and User-Agent must never reach logs, so the
 * serializer keeps only non-sensitive routing fields.
 */
export function requestLogSerializer(req: any) {
  return {
    method: req?.method,
    url: req?.url,
    host: req?.headers?.host,
    requestId: req?.id,
  };
}

function buildLoggerOptions(
  env: NodeJS.ProcessEnv,
  stream?: NodeJS.WritableStream
) {
  return {
    level: env['LOG_LEVEL'] ?? 'warn',
    serializers: { req: requestLogSerializer },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["user-agent"]',
      ],
      remove: true,
    },
    ...(stream ? { stream } : {}),
  };
}

export async function buildApp(options: BuildAppOptions = {}) {
  const env = options.env ?? process.env;

  // Fail-fast runtime contract (F1). Throws before any route is registered.
  const runtime: RuntimeConfig = loadRuntimeConfig(env);

  const app = Fastify({ logger: buildLoggerOptions(env, options.loggerStream) });

  // Test-only: capture real route schemas before any route is registered.
  if (options.onRoute) app.addHook('onRoute', options.onRoute);

  // Zod schemas are the single source for route contracts; validation
  // failures are mapped to the frozen 422 VALIDATION_ERROR by errorHandler.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Error handler
  app.setErrorHandler(errorHandler);

  // Config (re-validates the same runtime contract and exposes the channel)
  await app.register(configPlugin, { env });

  // Database pool
  const pool = new pg.Pool({
    connectionString: env['DATABASE_URL'],
    max: 10,
  });

  // Production never selects the fake provider (see createWechatProvider).
  const wechatProvider =
    options.identityBinding?.wechatProvider ?? createWechatProvider(runtime);

  // Auth plugin
  registerAuthPlugin(app, pool, runtime.sessionSecret);

  // Health check (no auth)
  app.get('/healthz', async () => {
    return { status: 'ok' };
  });

  // Routes
  registerAuthRoutes(app, pool, wechatProvider, runtime.sessionSecret);
  registerMeRoutes(app, pool);
  registerFamilyRoutes(app, pool);
  registerMemberRoutes(app, pool);
  registerComplianceRoutes(app, pool);
  registerConsentRoutes(app, pool);
  registerCaseRoutes(app, pool);

  // Slice 006: exactly six identity-binding capability routes.
  registerIdentityBindingRoutes(app, {
    pool,
    invitationPort:
      options.identityBinding?.invitationPort ?? new UnavailableInvitationPort(),
    wechatProvider,
    identityBindingSecret: runtime.identityBindingSecret,
    contextTtlSeconds: runtime.identityBindingContextTtlSeconds,
    attemptTtlSeconds: runtime.identityBindingAttemptTtlSeconds,
    sessionSecret: runtime.sessionSecret,
  });

  return app;
}
