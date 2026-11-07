import type { FastifyPluginAsync } from 'fastify';
import { requireEvidencePepper } from '../evidence-pepper.js';

export const configPlugin: FastifyPluginAsync = async (fastify) => {
  // Fail fast at startup: the evidence pepper is a required deployment secret
  // and MUST NOT fall back to a hard-coded value.
  requireEvidencePepper();

  fastify.decorate('config', {
    env: process.env['NODE_ENV'] ?? 'development',
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      env: string;
    };
  }
}
