/**
 * Command Bus
 *
 * The command bus is the central router for all commands in the system.
 * It receives commands and dispatches them to their registered handlers.
 *
 * Why use a command bus?
 * - Decouples controllers from business logic
 * - Single point for cross-cutting concerns (logging, validation, metrics)
 * - Makes it easy to add middleware (auth checks, rate limiting)
 * - Enables testing handlers in isolation
 *
 * How it works:
 * 1. Handlers register themselves with the bus during startup
 * 2. Controllers create commands and send them to the bus
 * 3. Bus finds the appropriate handler and invokes it
 * 4. Handler returns a result (success or failure)
 */

import { Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  ICommand,
  ICommandHandler,
  CommandResult,
  CommandMetadata,
  commandFailure,
  createCommandError,
  CommandErrorCodes,
} from '../../shared/types/command.types';
import { RequestContext } from '../../shared/context/request-context';

/**
 * Token used to identify command handlers in the DI container.
 */
export const COMMAND_HANDLER_METADATA = 'COMMAND_HANDLER_METADATA';

/**
 * Decorator to mark a class as a command handler.
 * The commandType must match the command's type property.
 */
export function CommandHandler(commandType: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(COMMAND_HANDLER_METADATA, commandType, target);
  };
}

/**
 * Registry for command handlers.
 * Maps command types to their handler classes.
 */
@Injectable()
export class CommandHandlerRegistry {
  private handlers = new Map<
    string,
    Type<ICommandHandler<ICommand, unknown>>
  >();
  private readonly logger = new Logger(CommandHandlerRegistry.name);

  /**
   * Register a handler for a command type.
   * Called during application bootstrap.
   */
  register(
    commandType: string,
    handler: Type<ICommandHandler<ICommand, unknown>>,
  ): void {
    if (this.handlers.has(commandType)) {
      this.logger.warn(
        `Handler for command type '${commandType}' is being overwritten`,
      );
    }
    this.handlers.set(commandType, handler);
    this.logger.log(`Registered handler for command type: ${commandType}`);
  }

  /**
   * Get the handler class for a command type.
   */
  getHandler(
    commandType: string,
  ): Type<ICommandHandler<ICommand, unknown>> | undefined {
    return this.handlers.get(commandType);
  }

  /**
   * Check if a handler exists for a command type.
   */
  hasHandler(commandType: string): boolean {
    return this.handlers.has(commandType);
  }

  /**
   * Get all registered command types.
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * The main command bus service.
 * Use this to dispatch commands from controllers and other services.
 */
@Injectable()
export class CommandBus {
  private readonly logger = new Logger(CommandBus.name);

  constructor(
    private readonly registry: CommandHandlerRegistry,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Execute a command and return the result.
   *
   * @param command The command to execute
   * @returns The result of command execution
   */
  async execute<TResult>(command: ICommand): Promise<CommandResult<TResult>> {
    const startTime = Date.now();
    const { type, metadata } = command;

    this.logger.log({
      message: 'Executing command',
      commandType: type,
      correlationId: metadata.correlationId,
      actor: metadata.actor.id,
    });

    try {
      const handlerClass = this.registry.getHandler(type);

      if (!handlerClass) {
        this.logger.error({
          message: 'No handler registered for command type',
          commandType: type,
        });
        return commandFailure(
          createCommandError(
            CommandErrorCodes.INTERNAL_ERROR,
            `No handler registered for command type: ${type}`,
          ),
        );
      }

      const handler = this.moduleRef.get(handlerClass, { strict: false });
      const result = await handler.execute(command);

      const duration = Date.now() - startTime;
      this.logger.log({
        message: 'Command executed',
        commandType: type,
        correlationId: metadata.correlationId,
        success: result.success,
        durationMs: duration,
      });

      return result as CommandResult<TResult>;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        message: 'Command execution failed with exception',
        commandType: type,
        correlationId: metadata.correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        durationMs: duration,
      });

      return commandFailure(
        createCommandError(
          CommandErrorCodes.INTERNAL_ERROR,
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        ),
      );
    }
  }
}

/**
 * Factory for creating commands with proper metadata.
 * Use this to create commands with all required context.
 */
export class CommandFactory {
  /**
   * Create a command with metadata from the current request context.
   */
  static create<TPayload>(type: string, payload: TPayload): ICommand<TPayload> {
    const context = RequestContext.currentOrFail();

    const metadata: CommandMetadata = {
      correlationId: context.correlationId,
      causationId: context.causationId,
      actor: context.actor,
      timestamp: new Date(),
    };

    return {
      type,
      payload,
      metadata,
    };
  }

  /**
   * Create a command with explicit metadata (for testing or background jobs).
   */
  static createWithMetadata<TPayload>(
    type: string,
    payload: TPayload,
    metadata: CommandMetadata,
  ): ICommand<TPayload> {
    return {
      type,
      payload,
      metadata,
    };
  }
}
