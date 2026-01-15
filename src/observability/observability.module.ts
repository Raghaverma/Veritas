/**
 * Observability Module
 *
 * Provides logging, tracing, and monitoring infrastructure.
 */

import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CorrelationInterceptor } from './correlation.interceptor';
import { StructuredLoggerService } from './structured-logger.service';

@Global()
@Module({
  providers: [
    StructuredLoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationInterceptor,
    },
  ],
  exports: [StructuredLoggerService],
})
export class ObservabilityModule {}
