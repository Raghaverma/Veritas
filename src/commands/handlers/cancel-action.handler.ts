/**
 * Cancel Action Command Handler
 *
 * Handles the CancelAction command.
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
  CancelActionCommand,
  ActionCommandTypes,
} from '../action.commands';
import { ActionsRepo } from '../../repositories/actions.repo';

export interface CancelActionResult {
  actionId: string;
  version: number;
  cancelledAt: string;
}

@Injectable()
@CommandHandler(ActionCommandTypes.CANCEL_ACTION)
export class CancelActionHandler
  implements ICommandHandler<CancelActionCommand, CancelActionResult>
{
  private readonly logger = new Logger(CancelActionHandler.name);

  constructor(private readonly actionsRepo: ActionsRepo) {}

  async execute(command: CancelActionCommand): Promise<CommandResult<CancelActionResult>> {
    const { payload, metadata } = command;

    this.logger.debug({
      message: 'Handling CancelAction command',
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

    const result = aggregate.cancel(
      payload.reason,
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

    await this.actionsRepo.update(aggregate, result.events, payload.expectedVersion);

    this.logger.log({
      message: 'Action cancelled successfully',
      correlationId: metadata.correlationId,
      actionId: payload.actionId,
      reason: payload.reason,
    });

    return commandSuccess({
      actionId: aggregate.id,
      version: aggregate.version,
      cancelledAt: new Date().toISOString(),
    });
  }
}
