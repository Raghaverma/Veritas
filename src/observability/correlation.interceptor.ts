/**
 * Correlation Interceptor
 *
 * NestJS interceptor that sets up the request context with correlation ID.
 * This ensures that all operations within a request share the same correlation ID.
 *
 * Why use an interceptor?
 * - Runs early in the request lifecycle
 * - Has access to execution context
 * - Can wrap the entire request/response cycle
 * - Cleaner than middleware for this use case
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { RequestContext, IRequestContext, Actor } from '../shared/context/request-context';
import { v7 as uuidv7 } from 'uuid';

const CORRELATION_ID_HEADER = 'x-correlation-id';
const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request & { user?: { id: string; email: string; accountId?: string } }>();
    const response = ctx.getResponse<Response>();

    const correlationId =
      (request.headers[CORRELATION_ID_HEADER] as string) ?? uuidv7();
    const requestId = uuidv7();

    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    response.setHeader(REQUEST_ID_HEADER, requestId);

    const actor: Actor = request.user
      ? {
          id: request.user.id,
          email: request.user.email,
          accountId: request.user.accountId,
        }
      : {
          id: 'anonymous',
          email: 'anonymous@unknown',
        };

    const requestContext: IRequestContext = {
      correlationId,
      causationId: requestId,
      actor,
      requestedAt: new Date(),
      clientIp: this.getClientIp(request),
      userAgent: request.headers['user-agent'],
    };

    return new Observable((subscriber) => {
      RequestContext.run(requestContext, () => {
        next
          .handle()
          .pipe(
            tap({
              next: (value) => subscriber.next(value),
              error: (error) => subscriber.error(error),
              complete: () => subscriber.complete(),
            }),
          )
          .subscribe();
      });
    });
  }

  /**
   * Extract client IP from request, handling proxies.
   */
  private getClientIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0].trim();
    }
    return request.ip ?? request.socket.remoteAddress ?? 'unknown';
  }
}
