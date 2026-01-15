/**
 * Logger Middleware
 *
 * Logs incoming HTTP requests with structured data.
 * Includes correlation ID for request tracing.
 */

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers['x-correlation-id'] as string) ?? uuidv7();
    const startTime = Date.now();

    req.headers['x-correlation-id'] = correlationId;

    this.logger.log({
      message: 'Incoming request',
      correlationId,
      method: req.method,
      path: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      this.logger.log({
        message: 'Request completed',
        correlationId,
        method: req.method,
        path: req.url,
        statusCode: res.statusCode,
        durationMs: duration,
      });
    });

    next();
  }
}
