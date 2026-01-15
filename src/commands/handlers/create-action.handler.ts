/**
 * Create Action Command Handler
 *
 * Handles the CreateAction command.
 * This is where the command meets the domain.
 *
 * Flow:
 * 1. Receive command with intent and metadata
 * 2. Validate (already done by DTO)
 * 3. Execute domain logic (create aggregate)
 * 4. Persist state + events
 * 5. Return result
 */

import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler } from '../bus/command-bus';
import {
  ICommandHandler,
  CommandResult,
  commandSuccess,
  commandFailure,
  createCommandError,
  CommandErrorCodes,
} from '../../shared/types/command.types';
import { CreateActionCommand, ActionCommandTypes } from '../action.commands';
import { ActionsRepo } from '../../repositories/actions.repo';
import { ActionAggregate } from '../../domain/aggregates/action.aggregate';
import { Action } from '../../db/types';

export interface CreateActionResult {
  actionId: string;
  version: number;
}

@Injectable()
@CommandHandler(ActionCommandTypes.CREATE_ACTION)
export class CreateActionHandler implements ICommandHandler<
  CreateActionCommand,
  CreateActionResult
> {
  private readonly logger = new Logger(CreateActionHandler.name);

  constructor(private readonly actionsRepo: ActionsRepo) {}

  async execute(
    command: CreateActionCommand,
  ): Promise<CommandResult<CreateActionResult>> {
    const { payload, metadata } = command;

    this.logger.debug({
      message: 'Handling CreateAction command',
      correlationId: metadata.correlationId,
      actorId: metadata.actor.id,
      actionName: payload.name,
    });

    const result = ActionAggregate.create(
      metadata.actor.id,
      payload.name,
      payload.type,
      payload.description ?? null,
      payload.metadata ?? null,
      {
        correlationId: metadata.correlationId,
        causationId: metadata.causationId,
        actor: metadata.actor,
        timestamp: metadata.timestamp.toISOString(),
      },
    );

    if (result.success === false) {
      this.logger.warn({
        message: 'Action creation failed - business rule violation',
        correlationId: metadata.correlationId,
        error: result.error,
      });

      return commandFailure(
        createCommandError(
          CommandErrorCodes.BUSINESS_RULE_VIOLATION,
          result.error.message,
          { rule: (result.error as { rule?: string }).rule },
        ),
      );
    }

    const aggregate = ActionAggregate.fromState({
      id: result.events[0].aggregateId,
      userId: metadata.actor.id,
      name: payload.name,
      type: payload.type,
      description: payload.description ?? null,
      metadata: payload.metadata ?? null,
      status: 'active',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    });

    await this.actionsRepo.save(aggregate, result.events);

    this.logger.log({
      message: 'Action created successfully',
      correlationId: metadata.correlationId,
      actionId: aggregate.id,
    });

    return commandSuccess({
      actionId: aggregate.id,
      version: aggregate.version,
    });
  }
}
