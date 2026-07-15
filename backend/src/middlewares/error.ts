import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';
import { isProd } from '../config/env';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route ${req.method} ${req.path} not found.`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as Request & { id?: string }).id ?? req.headers['x-request-id'];

  let apiError: ApiError;
  if (err instanceof ApiError) {
    apiError = err;
  } else if (err instanceof ZodError) {
    apiError = ApiError.validation(
      err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
    );
  } else if (err instanceof mongoose.Error.ValidationError) {
    apiError = ApiError.validation(
      Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }))
    );
  } else if (err instanceof mongoose.Error.CastError) {
    apiError = ApiError.badRequest(`Invalid value for ${err.path}.`);
  } else if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    apiError = ApiError.conflict('A record with the same unique value already exists.');
  } else {
    logger.error({ err, requestId }, 'Unhandled error');
    apiError = ApiError.internal();
  }

  if (apiError.statusCode >= 500) {
    logger.error({ err, requestId, path: req.path }, apiError.message);
  }

  res.status(apiError.statusCode).json({
    success: false,
    message: apiError.message,
    code: apiError.code,
    errors: apiError.errors,
    requestId,
    // Never expose stack traces in production.
    ...(isProd ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
}
