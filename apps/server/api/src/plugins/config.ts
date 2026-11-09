import type { FastifyPluginAsync } from 'fastify';
import { loadRuntimeConfig, type RuntimeMode } from '../runtime-env.js';

export interface ConfigPluginOptions {
  env?: NodeJS.ProcessEnv;
}

export const configPlugin: FastifyPluginAsync<ConfigPluginOptions> = async (fastify, opts) => {
  // Fail fast at startup: the runtime contract (session secret, evidence
  // pepper, WeChat credentials) is required and has no fallback value.
  const runtime = loadRuntimeConfig(opts.env ?? process.env);

  fastify.decorate('config', {
    env: runtime.mode,
    consentChannel: runtime.consentChannel,
    evidencePepper: runtime.evidencePepper,
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      env: RuntimeMode;
      consentChannel: 'MINIPROGRAM' | 'TEST';
      evidencePepper: string;
    };
  }
}