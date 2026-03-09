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
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const errorType = err.name || 'Unknown Error';

  console.error(
    `[Error] ${errorType} | Status: ${statusCode} | ${req.method} ${req.path}`,
  );
  console.error(
    `[Error] Message: ${err.message}`,
  );
  console.debug(
    `[Error] Stack:`,
    err.stack || 'No stack trace available',
  );
  console.debug(
    `[Error] Request Details | IP: ${req.ip} | User-Agent: ${req.get('user-agent') || 'unknown'} | User: ${req.user?.sub || 'unauthenticated'}`,
  );

  res.status(statusCode).json({
    statusCode,
    error: statusCode === 500 ? 'Internal Gateway Error' : err.name,
    message: err.message || 'An unexpected error occurred in the API Gateway.',
  });
}
