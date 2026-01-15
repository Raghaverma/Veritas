/**
 * Complete Action Command Handler
 *
 * Handles the CompleteAction command.
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
import { CompleteActionCommand, ActionCommandTypes } from '../action.commands';
import { ActionsRepo } from '../../repositories/actions.repo';

export interface CompleteActionResult {
  actionId: string;
  version: number;
  completedAt: string;
}

@Injectable()
@CommandHandler(ActionCommandTypes.COMPLETE_ACTION)
export class CompleteActionHandler implements ICommandHandler<
  CompleteActionCommand,
  CompleteActionResult
> {
  private readonly logger = new Logger(CompleteActionHandler.name);

  constructor(private readonly actionsRepo: ActionsRepo) {}

  async execute(
    command: CompleteActionCommand,
  ): Promise<CommandResult<CompleteActionResult>> {
    const { payload, metadata } = command;

    this.logger.debug({
      message: 'Handling CompleteAction command',
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

    const result = aggregate.complete(payload.result, payload.expectedVersion, {
      correlationId: metadata.correlationId,
      causationId: metadata.causationId,
      actor: metadata.actor,
      timestamp: metadata.timestamp.toISOString(),
    });

    if (result.success === false) {
      const err = result.error as {
        code: string;
        message: string;
        rule?: string;
        details?: Record<string, unknown>;
      };
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

    await this.actionsRepo.update(aggregate, result.events);

    this.logger.log({
      message: 'Action completed successfully',
      correlationId: metadata.correlationId,
      actionId: payload.actionId,
    });

    return commandSuccess({
      actionId: aggregate.id,
      version: aggregate.version,
      completedAt:
        aggregate.completedAt?.toISOString() ?? new Date().toISOString(),
    });
  }
}
