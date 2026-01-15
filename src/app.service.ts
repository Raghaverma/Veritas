import { Injectable } from '@nestjs/common';
import { logger } from './utils/logger';
import { HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { DrizzleHealthIndicator } from './helpers/drizzle/drizzle.health';

@Injectable()
export class AppService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly dbCheck: DrizzleHealthIndicator,
  ) {}

  healthCheck() {
    logger.log('Health check started...');
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // if heap reaches 150 mb, it shows unhealthy
      () => this.dbCheck.isHealthy('db_check'),
    ]);
  }
}
