/**
 * Event Bus Module
 *
 * Provides event persistence and publishing infrastructure.
 * This module implements the transactional outbox pattern for reliable event delivery.
 *
 * Key components:
 * - EventStoreService: Persists events to database with outbox entries
 * - OutboxProcessorService: Polls outbox and publishes to BullMQ
 *
 * How to use:
 * 1. Import EventBusModule in your app module
 * 2. Inject EventStoreService where you need to persist events
 * 3. The outbox processor automatically handles publishing
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventStoreService } from './event-store.service';
import {
  OutboxProcessorService,
  DOMAIN_EVENTS_QUEUE,
} from './outbox-processor.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: DOMAIN_EVENTS_QUEUE,
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
  ],
  providers: [EventStoreService, OutboxProcessorService],
  exports: [EventStoreService, OutboxProcessorService],
})
export class EventBusModule {}
