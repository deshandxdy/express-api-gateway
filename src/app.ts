import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createLoggerMiddleware } from './middleware/logger.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import {
  createRouteProxy,
  unregisteredRouteHandler,
} from './middleware/proxy.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { routes } from './config/routes';

/**
 * Build and configure the Express application.
 *
 * Route registration order matters:
 *  1. Global middleware (helmet, cors, logger)
 *  2. Each registered route  → optional auth guard → proxy
 *  3. Catch-all for unregistered routes (must come after all route registrations)
 *  4. Global error handler (must be last)
 */
export function createApp(): Application {
  const app = express();

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

  // ─── Route registration ───────────────────────────────────────────────────
  for (const route of routes) {
    const proxy = createRouteProxy(route);
    const pathPattern = route.path;

    if (route.public) {
      /**
       * Public route: skip JWT verification, proxy directly.
       *
       * We intentionally do NOT call next() after the proxy — the proxy
       * itself ends the response lifecycle.
       */
      app.all(pathPattern, proxy);

      console.log(
        `[Gateway] ✅ PUBLIC   ${pathPattern.padEnd(40)} → ${process.env[route.target]}`,
      );
    } else {
      /**
       * Private route: auth middleware first, then proxy.
       *
       * authMiddleware calls next() only on success, so the proxy only
       * fires when the JWT is valid.
       */
      app.all(
        pathPattern,
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async (req, res, next) => {
          await authMiddleware(req, res, next);
        },
        proxy,
      );

      console.log(
        `[Gateway] 🔒 PRIVATE  ${pathPattern.padEnd(40)} → ${process.env[route.target]}`,
      );
    }
  }

  // ─── Catch-all: route not registered ─────────────────────────────────────
  /**
   * Any path that did not match a registered route arrives here.
   * Returns a 404 with a precise message directing the developer to
   * register the route in src/config/routes.ts.
   */
  app.use(unregisteredRouteHandler);

  // ─── Global error handler (must be last) ─────────────────────────────────
  app.use(errorMiddleware);

  return app;
}
