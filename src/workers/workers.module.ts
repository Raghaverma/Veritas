/**
 * Workers Module
 *
 * Registers BullMQ processors and event handlers.
 *
 * How handler registration works:
 * 1. Module imports handler classes
 * 2. On module init, handlers are discovered via @EventHandler decorator
 * 3. Handlers are registered with the EventHandlerRegistry
 * 4. DomainEventsProcessor uses the registry to dispatch events
 */

import { Module, OnModuleInit, Type } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import {
  DomainEventsProcessor,
  EventHandlerRegistry,
  EVENT_HANDLER_METADATA,
} from './domain-events.processor';
import { DOMAIN_EVENTS_QUEUE } from '../event-bus/outbox-processor.service';
import { IEventHandler, IDomainEvent } from '../shared/types/event.types';

@Module({
  imports: [
    DiscoveryModule,
    BullModule.registerQueue({
      name: DOMAIN_EVENTS_QUEUE,
    }),
  ],
  providers: [
    DomainEventsProcessor,
    EventHandlerRegistry,
  ],
  exports: [EventHandlerRegistry],
})
export class WorkersModule implements OnModuleInit {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly registry: EventHandlerRegistry,
  ) {}

  /**
   * On module initialization, discover and register all event handlers.
   */
  onModuleInit() {
    const providers = this.discoveryService.getProviders();

    providers
      .filter((wrapper) => wrapper.metatype)
      .forEach((wrapper) => {
        const eventTypes = Reflect.getMetadata(
          EVENT_HANDLER_METADATA,
          wrapper.metatype,
        );

        if (eventTypes && Array.isArray(eventTypes)) {
          for (const eventType of eventTypes) {
            this.registry.register(
              eventType,
              wrapper.metatype as Type<IEventHandler<IDomainEvent>>,
            );
          }
        }
      });
  }
}
