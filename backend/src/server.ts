import http from 'http';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { prisma } from './prisma.js';
import { logger } from './utils/logger.js';

const app = createApp();
const server = http.createServer(app);

server.listen(config.port, config.host, () => {
  logger.info(`MediCore API server running at http://${config.host}:${config.port}${config.apiPrefix}`);
  logger.info(`API Documentation available at http://${config.host}:${config.port}/docs`);
});

// Graceful Shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down MediCore backend server gracefully...`);

  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await prisma.$disconnect();
      logger.info('Database connections closed cleanly.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during database disconnect', err);
      process.exit(1);
    }
  });

  // Force termination if cleanup takes longer than 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
