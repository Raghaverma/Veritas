/**
 * Application Module
 *
 * The root module that wires together all application components.
 * This is the entry point for the NestJS dependency injection system.
 *
 * Architecture Overview:
 * - API Layer: Controllers that handle HTTP requests
 * - Command Layer: Command bus and handlers for write operations
 * - Domain Layer: Aggregates and business logic
 * - Event Layer: Event bus, outbox, and event handlers
 * - Read Models: Query-optimized data access
 * - Observability: Logging, tracing, and monitoring
 *
 * Data Flow:
 * HTTP Request → Auth → Command → Domain → Event → Queue → Worker → Audit → Query
 */

import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule } from '@nestjs/throttler';

import configuration from './config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { DrizzleModule } from './helpers/drizzle/drizzle.module';
import { CacheModule } from './helpers/cache/cache.module';
import { DrizzleHealthIndicator } from './helpers/drizzle/drizzle.health';
import { CacheService } from './helpers/cache/cache.service';

import { LoggerMiddleware } from './middlewares/logger.middleware';
import { AuthMiddleware } from './middlewares/auth.middleware';
import { FirebaseService } from './integrations/firebase/firebase.service';

import { ObservabilityModule } from './observability/observability.module';
import { CommandsModule } from './commands/commands.module';
import { EventBusModule } from './event-bus/event-bus.module';
import { WorkersModule } from './workers/workers.module';
import { AuditModule } from './audit/audit.module';
import { ReadModelsModule } from './read-models/read-models.module';
import { RepositoryModule } from './repositories/repository.module';

import { UsersModule } from './modules/users/users.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { ActionsModule } from './api/actions/actions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      ignoreEnvFile: true,
      cache: true,
    }),
    SentryModule.forRoot(),

    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 50,
        },
      ],
    }),

    BullModule.forRootAsync({
      inject: [CacheService],
      useFactory: (cacheService: CacheService) => ({
        connection: cacheService.client,
      }),
    }),

    TerminusModule.forRoot({ errorLogStyle: 'pretty' }),

    CacheModule,
    DrizzleModule,

    ObservabilityModule,
    CommandsModule,
    EventBusModule,
    WorkersModule,
    AuditModule,
    ReadModelsModule,
    RepositoryModule,

    UsersModule,
    PoliciesModule,
    ActionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    FirebaseService,
    DrizzleHealthIndicator,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(LoggerMiddleware)
      .exclude({
        path: '/health',
        method: RequestMethod.GET,
      })
      .forRoutes('*');

    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: '/health', method: RequestMethod.GET },
        { path: '/api/health', method: RequestMethod.GET },
        { path: '/doc', method: RequestMethod.GET },
        { path: '/doc/(.*)', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
