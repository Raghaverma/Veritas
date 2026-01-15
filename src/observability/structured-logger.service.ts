/**
 * Structured Logger Service
 *
 * Provides structured logging with automatic correlation ID injection.
 * All log entries include context from the current request.
 *
 * Why structured logging?
 * - Enables log aggregation and searching (ELK, Datadog, etc.)
 * - Consistent format across all services
 * - Automatic context enrichment
 * - Better debugging with correlation IDs
 */

import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { RequestContext } from '../shared/context/request-context';

export interface LogContext {
  correlationId?: string;
  actorId?: string;
  [key: string]: unknown;
}

export interface StructuredLog {
  timestamp: string;
  level: string;
  message: string;
  correlationId?: string;
  actorId?: string;
  service?: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLoggerService implements LoggerService {
  private context?: string;
  private readonly serviceName = 'veritas';

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string, context?: string | Record<string, unknown>): void {
    this.writeLog('info', message, context);
  }

  error(
    message: string,
    trace?: string | Error,
    context?: string | Record<string, unknown>,
  ): void {
    const errorData = this.extractErrorData(trace);
    this.writeLog('error', message, context, errorData);
  }

  warn(message: string, context?: string | Record<string, unknown>): void {
    this.writeLog('warn', message, context);
  }

  debug(message: string, context?: string | Record<string, unknown>): void {
    this.writeLog('debug', message, context);
  }

  verbose(message: string, context?: string | Record<string, unknown>): void {
    this.writeLog('verbose', message, context);
  }

  /**
   * Write a structured log entry.
   */
  private writeLog(
    level: string,
    message: string,
    contextOrData?: string | Record<string, unknown>,
    errorData?: { name: string; message: string; stack?: string },
  ): void {
    const requestContext = RequestContext.current();

    const logEntry: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      context: typeof contextOrData === 'string' ? contextOrData : this.context,
    };

    if (requestContext) {
      logEntry.correlationId = requestContext.correlationId;
      logEntry.actorId = requestContext.actor.id;
    }

    if (typeof contextOrData === 'object') {
      logEntry.data = contextOrData;
    }

    if (errorData) {
      logEntry.error = errorData;
    }

    const output = JSON.stringify(logEntry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
      case 'verbose':
        if (process.env.NODE_ENV !== 'production') {
          console.log(output);
        }
        break;
      default:
        console.log(output);
    }
  }

  /**
   * Extract error data from various error formats.
   */
  private extractErrorData(
    trace?: string | Error,
  ): { name: string; message: string; stack?: string } | undefined {
    if (!trace) {
      return undefined;
    }

    if (trace instanceof Error) {
      return {
        name: trace.name,
        message: trace.message,
        stack: trace.stack,
      };
    }

    return {
      name: 'Error',
      message: trace,
      stack: trace,
    };
  }
}

/**
 * Factory function for creating a logger with a specific context.
 */
export function createLogger(context: string): StructuredLoggerService {
  const logger = new StructuredLoggerService();
  logger.setContext(context);
  return logger;
}
