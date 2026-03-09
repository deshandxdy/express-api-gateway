import morgan from 'morgan';
import { RequestHandler, Request, Response, NextFunction } from 'express';

/**
 * HTTP request logger.
 * - development : colourised `dev` format (concise, readable) + debug logging
 * - production  : `combined` Apache format (structured, log-shipper friendly)
 */
export function createLoggerMiddleware(): RequestHandler {
  const format =
    process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
  const httpLogger = morgan(format);

  // Add custom debug logging in development
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'production') {
      const authHeader = req.headers.authorization ? 'present' : 'missing';
      const contentType = req.get('content-type') || 'none';
      const bodySize = req.body ? JSON.stringify(req.body).length : 0;
      console.debug(
        `[Request] ${req.method} ${req.path} | Auth: ${authHeader} | Content-Type: ${contentType} | Body size: ${bodySize} bytes`,
      );
    }
    httpLogger(req, res, next);
  };
}
