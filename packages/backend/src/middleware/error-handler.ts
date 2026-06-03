import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string | undefined;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(
    `[ERROR] ${err.message}`,
    config.NODE_ENV === 'development' ? err.stack : '',
  );

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
      },
    });
    return;
  }

  const message = config.NODE_ENV === 'production'
    ? 'Internal server error'
    : (err.message || err.constructor?.name || 'Unknown error');

  res.status(500).json({
    error: { message, code: 'INTERNAL_ERROR' },
  });
}
