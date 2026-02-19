import { Request, Response, NextFunction } from 'express';

export interface GatewayError extends Error {
  statusCode?: number;
}

/**
 * Global Express error handler.
 * Must be registered LAST (after all routes) to catch forwarded errors.
 */
export function errorMiddleware(
  err: GatewayError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;

  console.error(`[Gateway Error] ${err.message}`, err.stack);

  res.status(statusCode).json({
    statusCode,
    error: statusCode === 500 ? 'Internal Gateway Error' : err.name,
    message: err.message || 'An unexpected error occurred in the API Gateway.',
  });
}
