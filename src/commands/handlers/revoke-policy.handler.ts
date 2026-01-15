/**
 * Revoke Policy Command Handler
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
import { RevokePolicyCommand, PolicyCommandTypes } from '../policy.commands';
import { PoliciesRepo } from '../../repositories/policies.repo';

export interface RevokePolicyResult {
  policyId: string;
  version: number;
}

@Injectable()
@CommandHandler(PolicyCommandTypes.REVOKE_POLICY)
export class RevokePolicyHandler implements ICommandHandler<
  RevokePolicyCommand,
  RevokePolicyResult
> {
  private readonly logger = new Logger(RevokePolicyHandler.name);

  constructor(private readonly policiesRepo: PoliciesRepo) { }

  async execute(
    command: RevokePolicyCommand,
  ): Promise<CommandResult<RevokePolicyResult>> {
    const { payload, metadata } = command;

    this.logger.debug({
      message: 'Handling RevokePolicy command',
      correlationId: metadata.correlationId,
      policyId: payload.policyId,
    });

    const policy = await this.policiesRepo.findByIdOrFail(payload.policyId);

    const result = policy.revoke(
      payload.reason,
      payload.revokedBy,
      payload.expectedVersion,
      {
        correlationId: metadata.correlationId,
        causationId: metadata.causationId,
        actor: metadata.actor,
        timestamp: metadata.timestamp.toISOString(),
      },
    );

    if (result.success === false) {
      this.logger.warn({
        message: 'Policy revocation failed - business rule violation',
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

    await this.policiesRepo.update(
      policy,
      result.events,
    );

    this.logger.log({
      message: 'Policy revoked successfully',
      correlationId: metadata.correlationId,
      policyId: policy.id,
    });

    return commandSuccess({
      policyId: policy.id,
      version: policy.version,
    });
  }
}
