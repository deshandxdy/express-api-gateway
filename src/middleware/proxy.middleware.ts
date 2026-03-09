import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';

/**
 * Headers that should never be forwarded to upstream services.
 * The gateway re-injects the x-user-* context headers it controls.
 */
const STRIP_REQUEST_HEADERS = ['cookie'];

/**
 * Matches a request path against an Express-style route pattern.
 * Supports wildcards like "/api/v1/users/*" or "/api/v1/users*"
 */
export function pathMatches(requestPath: string, pattern: string): boolean {
  // Convert Express pattern to regex
  // /api/v1/users/* → /api/v1/users/.*
  // /api/v1/users/*/profile → /api/v1/users/.*/profile
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
    .replace(/\*/g, '.*'); // Convert * to .*

  const regex = new RegExp(`^${regexPattern}$`);
  const matches = regex.test(requestPath);

  if (matches) {
    console.debug(
      `[Path Match] ✓ "${requestPath}" matches pattern "${pattern}"`,
    );
  }

  return matches;
}

/**
 * Creates an Express middleware that proxies the request to the
 * upstream target service.
 *
 * @param targetUrl - The upstream base URL
 */
export function createRouteProxy(targetUrl: string) {

  if (!targetUrl) {
    throw new Error(
      '[Gateway] Upstream target URL is not defined.',
    );
  }

  const options: Options = {
    target: targetUrl,
    changeOrigin: true,

    on: {
      proxyReq: (proxyReq, req) => {
        const expressReq = req as Request;

        // Strip sensitive headers before forwarding
        STRIP_REQUEST_HEADERS.forEach((header) => {
          proxyReq.removeHeader(header);
        });

        // Tag the request so upstream knows it came through the gateway
        proxyReq.setHeader('x-gateway', 'ymr-api-gateway');
        proxyReq.setHeader('x-forwarded-host', expressReq.hostname ?? '');

        // Forward x-user-* headers set by authMiddleware (private routes only)
        const userHeaders = [
          'x-user-id',
          'x-user-email',
          'x-user-username',
          'x-user-groups',
        ];
        userHeaders.forEach((h) => {
          const val = expressReq.headers[h];
          if (val) proxyReq.setHeader(h, val);
        });

        // ── Re-write the body ──────────────────────────────────────────────
        // express.json() consumes the raw stream and stores the parsed result
        // in req.body. By the time http-proxy-middleware runs, the stream is
        // already empty, so POST/PUT/PATCH bodies would be lost upstream.
        // We re-serialise req.body and write it directly to the proxy request.
        if (expressReq.body && Object.keys(expressReq.body).length > 0) {
          const bodyData = JSON.stringify(expressReq.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      },

      error: (err, _req, res) => {
        const errorMsg =
          err instanceof Error ? err.message : 'Unknown error';
        console.error(
          `[Proxy] Upstream service error | Message: ${errorMsg}`,
          err instanceof Error ? err.stack : '',
        );
        (res as Response).status(502).json({
          statusCode: 502,
          error: 'Bad Gateway',
          message:
            'Upstream service is unavailable. ' +
            'Please try again later.',
        });
      },
    },
  };

  return createProxyMiddleware(options);
}

/**
 * Dynamic catch-all middleware that handles any request.
 *
 * Logic:
 *  1. Check if the request path matches any public route pattern
 *  2. If yes → proxy directly without JWT validation
 *  3. If no → validate JWT first, then proxy
 *  4. All requests are proxied to BACKEND_SERVICE_URL
 */
export function dynamicRouteHandler(
  publicRoutePatterns: string[],
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction) => {
    const isPublic = publicRoutePatterns.some((pattern) =>
      pathMatches(req.path, pattern),
    );

    const backendUrl = process.env.BACKEND_SERVICE_URL;
    if (!backendUrl) {
      console.error(
        '[Proxy] BACKEND_SERVICE_URL environment variable is not set',
      );
      res.status(502).json({
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'BACKEND_SERVICE_URL environment variable is not set.',
      });
      return;
    }

    const proxy = createRouteProxy(backendUrl);

    if (isPublic) {
      // Public route: proxy directly without JWT validation
      console.log(
        `[Gateway] ✅ PUBLIC   ${req.method.padEnd(6)} ${req.path}`,
      );
      console.debug(
        `[Proxy] Routing to backend | Path: ${req.path} | URL: ${backendUrl}`,
      );
      proxy(req, res, next);
    } else {
      // Private route: validate JWT first
      console.log(
        `[Gateway] 🔒 PRIVATE  ${req.method.padEnd(6)} ${req.path}`,
      );
      console.debug(
        `[Proxy] Private route requires JWT validation | Path: ${req.path}`,
      );
      // Use authMiddleware to validate JWT
      const { authMiddleware: auth } = await import('./auth.middleware');
      await auth(req, res, () => {
        // On successful auth, proxy the request
        console.debug(
          `[Proxy] JWT validated, proxying to backend | Path: ${req.path} | User: ${req.user?.sub}`,
        );
        proxy(req, res, next);
      });
    }
  };
}

/**
 * Middleware that rejects any request whose path is NOT registered
 * in the route registry with a clear, actionable error message.
 */
export function unregisteredRouteHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  res.status(404).json({
    statusCode: 404,
    error: 'Route Not Registered',
    message:
      `The route "${req.method} ${req.path}" is not registered in the API Gateway. ` +
      `To expose this endpoint, add it to "src/config/routes.ts" in ymr-api-gateway ` +
      `and specify whether it is public or requires authentication.`,
  });
}
