/**
 * Update Action Command Handler
 *
 * Handles the UpdateAction command.
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
import {
  UpdateActionCommand,
  ActionCommandTypes,
} from '../action.commands';
import { ActionsRepo } from '../../repositories/actions.repo';
import { EntityNotFoundError } from '../../shared/errors/domain.errors';

export interface UpdateActionResult {
  actionId: string;
  version: number;
}

@Injectable()
@CommandHandler(ActionCommandTypes.UPDATE_ACTION)
export class UpdateActionHandler
  implements ICommandHandler<UpdateActionCommand, UpdateActionResult>
{
  private readonly logger = new Logger(UpdateActionHandler.name);

  constructor(private readonly actionsRepo: ActionsRepo) {}

  async execute(command: UpdateActionCommand): Promise<CommandResult<UpdateActionResult>> {
    const { payload, metadata } = command;

    this.logger.debug({
      message: 'Handling UpdateAction command',
      correlationId: metadata.correlationId,
      actionId: payload.actionId,
    });

    const aggregate = await this.actionsRepo.findById(payload.actionId);

    if (!aggregate) {
      return commandFailure(
        createCommandError(
          CommandErrorCodes.NOT_FOUND,
          `Action with ID '${payload.actionId}' not found`,
        ),
      );
    }

    const result = aggregate.update(
      {
        name: payload.name,
        description: payload.description,
        metadata: payload.metadata,
      },
      payload.expectedVersion,
      {
        correlationId: metadata.correlationId,
        causationId: metadata.causationId,
        actor: metadata.actor,
        timestamp: metadata.timestamp.toISOString(),
      },
    );

    if (result.success === false) {
      const err = result.error as { code: string; message: string; rule?: string; details?: Record<string, unknown> };
      const errorCode =
        err.code === 'BUSINESS_RULE_VIOLATION' &&
        err.rule === 'action.version.mismatch'
          ? CommandErrorCodes.OPTIMISTIC_LOCK_FAILED
          : CommandErrorCodes.BUSINESS_RULE_VIOLATION;

      return commandFailure(
        createCommandError(errorCode, err.message, {
          rule: err.rule,
          details: err.details,
        }),
      );
    }

    if (result.events.length > 0) {
      await this.actionsRepo.update(aggregate, result.events, payload.expectedVersion);
    }

    this.logger.log({
      message: 'Action updated successfully',
      correlationId: metadata.correlationId,
      actionId: payload.actionId,
      newVersion: aggregate.version,
    });

    return commandSuccess({
      actionId: aggregate.id,
      version: aggregate.version,
    });
  }
}
