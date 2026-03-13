import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../config/logger';
import { ApiResponse } from '../schemas/types';

// Validate request body against a Zod schema
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      res.status(400).json({ success: false, error: errors.join(', ') } as ApiResponse);
      return;
    }
    req.body = result.data;
    next();
  };
}

// Global error handler
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error({ message: err.message, stack: err.stack, path: req.path });

  if (err instanceof ZodError) {
    res.status(400).json({ success: false, error: 'Validation error', data: err.errors } as ApiResponse);
    return;
  }

  res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse);
}

// 404 handler
export function notFound(req: Request, res: Response): void {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` } as ApiResponse);
}