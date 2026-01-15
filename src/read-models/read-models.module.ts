/**
 * Read Models Module
 *
 * Provides read-optimized query services.
 * These are separated from write operations for CQRS-lite pattern.
 */

import { Module } from '@nestjs/common';
import { ActionReadModel } from './action.read-model';
import { CacheModule } from '../helpers/cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [ActionReadModel],
  exports: [ActionReadModel],
})
export class ReadModelsModule {}
