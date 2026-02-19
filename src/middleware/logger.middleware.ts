import morgan from 'morgan';
import { RequestHandler } from 'express';

/**
 * HTTP request logger.
 * - development : colourised `dev` format (concise, readable)
 * - production  : `combined` Apache format (structured, log-shipper friendly)
 */
export function createLoggerMiddleware(): RequestHandler {
  const format =
    process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
  return morgan(format);
}
