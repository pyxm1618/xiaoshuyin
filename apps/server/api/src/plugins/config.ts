import type { FastifyPluginAsync } from 'fastify';

export const configPlugin: FastifyPluginAsync = async (fastify) => {
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
