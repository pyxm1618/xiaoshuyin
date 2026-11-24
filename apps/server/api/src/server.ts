import { buildApp } from './app.js';

const rawPort = process.env['PORT'];
const port = rawPort && /^\d+$/.test(rawPort) ? parseInt(rawPort, 10) : 8787;
const host = process.env['HOST'] || '0.0.0.0';

// Bound the time a stop signal can wait for construction and resource cleanup.
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10_000;
let shutdownSignal: string | undefined;
let shutdownDeadline: ReturnType<typeof setTimeout> | undefined;
let app: Awaited<ReturnType<typeof buildApp>> | null = null;

async function closeForShutdown(constructedApp: NonNullable<typeof app>) {
  try {
    constructedApp.log.info({ signal: shutdownSignal }, 'shutting down server');
    await constructedApp.close();
  } catch (err) {
    constructedApp.log.error({ err }, 'error during server shutdown');
    clearTimeout(shutdownDeadline);
    process.exit(1);
  }
  clearTimeout(shutdownDeadline);
}

function requestShutdown(signal: string) {
  if (shutdownSignal) return;
  shutdownSignal = signal;
  shutdownDeadline = setTimeout(() => process.exit(1), GRACEFUL_SHUTDOWN_TIMEOUT_MS);
  if (app) void closeForShutdown(app);
}

process.on('SIGTERM', () => requestShutdown('SIGTERM'));
process.on('SIGINT', () => requestShutdown('SIGINT'));

try {
  app = await buildApp();
  if (shutdownSignal) await closeForShutdown(app);
  else await app.listen({ port, host });
} catch (err) {
  if (app) {
    app.log.error(err);
    if (!shutdownSignal) {
      const failedApp = app;
      app = null;
      try {
        await failedApp.close();
      } catch (closeError) {
        failedApp.log.error({ err: closeError }, 'error during startup failure cleanup');
      }
    }
  } else {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  clearTimeout(shutdownDeadline);
  process.exit(1);
}
