import http from 'http';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/db';
import { createApp } from './app';
import { initSockets } from './sockets';

async function main() {
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);
  initSockets(server);

  server.listen(env.PORT, () => {
    logger.info(`${env.APP_NAME} API listening on ${env.BACKEND_URL} (env: ${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
