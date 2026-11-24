import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { join } from 'path';

import { config } from './config/env.js';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { errorHandler } from './middlewares/errorHandler.js';
import v1Router from './routes/v1/index.js';

export function createApp() {
  const app = express();

  // Security headers & CORS
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    })
  );

  // Request parsing & identification
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestIdMiddleware);

  // OpenAPI / Swagger Documentation
  try {
    const swaggerDocPath = join(process.cwd(), 'src', 'docs', 'swagger.json');
    const fallbackPath = join(process.cwd(), 'dist', 'docs', 'swagger.json');
    let swaggerDocument;
    try {
      swaggerDocument = JSON.parse(readFileSync(swaggerDocPath, 'utf8'));
    } catch {
      swaggerDocument = JSON.parse(readFileSync(fallbackPath, 'utf8'));
    }
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  } catch (err) {
    // Fallback if running in minimal test environment
  }

  // API Version 1 Routes
  app.use(config.apiPrefix, v1Router);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export default createApp;
