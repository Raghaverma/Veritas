/**
 * Activate Policy Command Handler
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
import { ActivatePolicyCommand, PolicyCommandTypes } from '../policy.commands';
import { PoliciesRepo } from '../../repositories/policies.repo';

export interface ActivatePolicyResult {
  policyId: string;
  version: number;
}

@Injectable()
@CommandHandler(PolicyCommandTypes.ACTIVATE_POLICY)
export class ActivatePolicyHandler implements ICommandHandler<
  ActivatePolicyCommand,
  ActivatePolicyResult
> {
  private readonly logger = new Logger(ActivatePolicyHandler.name);

  constructor(private readonly policiesRepo: PoliciesRepo) {}

  async execute(
    command: ActivatePolicyCommand,
  ): Promise<CommandResult<ActivatePolicyResult>> {
    const { payload, metadata } = command;

    this.logger.debug({
      message: 'Handling ActivatePolicy command',
      correlationId: metadata.correlationId,
      policyId: payload.policyId,
    });

    const policy = await this.policiesRepo.findByIdOrFail(payload.policyId);

    const result = policy.activate(payload.expectedVersion, {
      correlationId: metadata.correlationId,
      causationId: metadata.causationId,
      actor: metadata.actor,
      timestamp: metadata.timestamp.toISOString(),
    });

    if (result.success === false) {
      this.logger.warn({
        message: 'Policy activation failed - business rule violation',
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

    await this.policiesRepo.update(policy, result.events);

    this.logger.log({
      message: 'Policy activated successfully',
      correlationId: metadata.correlationId,
      policyId: policy.id,
    });

    return commandSuccess({
      policyId: policy.id,
      version: policy.version,
    });
  }
}
