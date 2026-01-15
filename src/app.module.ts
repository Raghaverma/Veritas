import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import configuration from './config';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './helpers/drizzle/drizzle.module';
import { TerminusModule } from '@nestjs/terminus';
import { CacheModule } from './helpers/cache/cache.module';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import { AuthMiddleware } from './middlewares/auth.middleware';
import { FirebaseService } from './integrations/firebase/firebase.service';
import { DrizzleHealthIndicator } from './helpers/drizzle/drizzle.health';
import { UsersModule } from './modules/users/users.module';
import { BullModule } from '@nestjs/bullmq';
import { CacheService } from './helpers/cache/cache.service';
import { RepositoryModule } from './repositories/repository.module';
import { ThrottlerModule } from '@nestjs/throttler/';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      ignoreEnvFile: true, // this is used to add os level env variables
      cache: true, // increase the performance of ConfigService#get method accessing process.env.
    }),
    SentryModule.forRoot(),
    CacheModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000, // 1 minute
          limit: 50,
        },
      ],
    }),
    BullModule.forRootAsync({
      inject: [CacheService],
      useFactory: (cacheService: CacheService) => ({
        // Reuse the Redis client instance
        connection: cacheService.client,
      }),
    }),
    DrizzleModule, // this is a global module
    TerminusModule.forRoot({ errorLogStyle: 'pretty' }),
    UsersModule,
    RepositoryModule,
  ],
  controllers: [AppController],
  providers: [AppService, FirebaseService, DrizzleHealthIndicator],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): any {
    consumer
      .apply(LoggerMiddleware)
      .exclude({
        path: '/health',
        method: RequestMethod.GET,
      })
      .forRoutes('*');
    consumer
      .apply(AuthMiddleware)
      .exclude({
        path: '/health',
        method: RequestMethod.GET,
      })
      .forRoutes('*');
  }
}
