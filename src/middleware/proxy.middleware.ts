import { Request, Response, NextFunction } from 'express';
import { IncomingMessage } from 'http';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { RouteConfig } from '../config/routes';

/**
 * Headers that should never be forwarded to upstream services.
 * The gateway re-injects the x-user-* context headers it controls.
 */
const STRIP_REQUEST_HEADERS = ['cookie'];

/**
 * Creates an Express middleware that proxies the request to the
 * upstream target defined in the route config.
 *
 * @param route - The matched route config entry
 */
export function createRouteProxy(route: RouteConfig) {
  const targetUrl = process.env[route.target];

  if (!targetUrl) {
    throw new Error(
      `[Gateway] Upstream target env var "${route.target}" is not defined. ` +
      `Check your .env file and ensure "${route.target}" is set.`,
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

      error: (_err, _req, res) => {
        (res as Response).status(502).json({
          statusCode: 502,
          error: 'Bad Gateway',
          message:
            `Upstream service "${route.target}" is unavailable. ` +
            'Please try again later.',
        });
      },
    },
  };

  return createProxyMiddleware(options);
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
