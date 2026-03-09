import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createLoggerMiddleware } from './middleware/logger.middleware';
import {
  dynamicRouteHandler,
} from './middleware/proxy.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { publicRoutes } from './config/routes';

/**
 * Build and configure the Express application.
 *
 * Route resolution order:
 *  1. Global middleware (helmet, cors, logger)
 *  2. Dynamic catch-all handler → checks if public/private → proxies
 *  3. Global error handler (must be last)
 */
export function createApp(): Application {
  const app = express();

  console.log('[App] Initializing API Gateway...');

  // ─── Global middleware ────────────────────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      allowedHeaders: ['Authorization', 'Content-Type', 'x-user-id'],
      credentials: true,
    }),
  );
  app.use(createLoggerMiddleware());

  // Parse JSON bodies so error handlers can inspect body if needed
  app.use(express.json());

  // ─── Dynamic route handler ─────────────────────────────────────────────────
  /**
   * Catch-all middleware that handles any request path.
   *
   * Checks if the path matches a public route:
   *  - If yes → proxy without JWT validation
   *  - If no → validate JWT, then proxy
   */
  const publicRoutePatterns = publicRoutes.map((r) => r.path);

  console.log(
    `[App] Configured ${publicRoutePatterns.length} public routes:`,
  );
  publicRoutePatterns.forEach((pattern) => {
    console.log(`      → ${pattern}`);
  });

  app.use(dynamicRouteHandler(publicRoutePatterns));

  // ─── Global error handler (must be last) ─────────────────────────────────
  app.use(errorMiddleware);

  console.log('[App] Gateway initialized successfully');

  return app;
}
