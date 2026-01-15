import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import { DrizzleService } from './drizzle.service';

@Injectable()
export class DrizzleHealthIndicator extends HealthIndicator {
  constructor(private readonly drizzle: DrizzleService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const resp = await this.drizzle.db.execute(sql`select 1`);
    const isHealthy = resp[0]['?column?'] === 1;
    const result = this.getStatus(key, isHealthy);

    if (isHealthy) {
      return result;
    }

    throw new HealthCheckError('DB Check failed', result);
  }
}
