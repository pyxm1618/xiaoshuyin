import { buildApp } from './app.js';

const rawPort = process.env['PORT'];
const port = rawPort && /^\d+$/.test(rawPort) ? parseInt(rawPort, 10) : 8787;
const host = process.env['HOST'] || '0.0.0.0';

let isShuttingDown = false;
let app: Awaited<ReturnType<typeof buildApp>> | null = null;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  if (app) {
    app.log.info({ signal }, 'shutting down server');
    try {
      await app.close();
    } catch (err) {
      app.log.error({ err }, 'error during server shutdown');
      process.exit(1);
    }
  }
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

try {
  app = await buildApp();
  await app.listen({ port, host });
} catch (err) {
  if (app) {
    app.log.error(err);
    try {
      await app.close();
    } catch {
      // ignore secondary errors during failure cleanup
    }
  } else {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  process.exit(1);
}
