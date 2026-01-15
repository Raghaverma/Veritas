/**
 * Commands Module
 *
 * Registers the command bus and all command handlers.
 * This module should be imported by the AppModule.
 *
 * How handler registration works:
 * 1. Module imports handler classes
 * 2. On module init, handlers are registered with the CommandHandlerRegistry
 * 3. CommandBus uses the registry to dispatch commands to handlers
 */

import { Module, OnModuleInit, Type } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import {
  CommandBus,
  CommandHandlerRegistry,
  COMMAND_HANDLER_METADATA,
} from './bus/command-bus';
import { ICommandHandler, ICommand } from '../shared/types/command.types';

@Module({
  imports: [DiscoveryModule],
  providers: [CommandBus, CommandHandlerRegistry],
  exports: [CommandBus, CommandHandlerRegistry],
})
export class CommandsModule implements OnModuleInit {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly registry: CommandHandlerRegistry,
  ) {}

  /**
   * On module initialization, discover and register all command handlers.
   * Handlers are identified by the @CommandHandler decorator.
   */
  onModuleInit() {
    const providers = this.discoveryService.getProviders();

    providers
      .filter((wrapper) => wrapper.metatype)
      .forEach((wrapper) => {
        const commandType = Reflect.getMetadata(
          COMMAND_HANDLER_METADATA,
          wrapper.metatype,
        );

        if (commandType) {
          this.registry.register(
            commandType,
            wrapper.metatype as Type<ICommandHandler<ICommand, unknown>>,
          );
        }
      });
  }
}
