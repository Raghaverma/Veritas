/**
 * Resume Policy Command Handler
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
import { ResumePolicyCommand, PolicyCommandTypes } from '../policy.commands';
import { PoliciesRepo } from '../../repositories/policies.repo';

export interface ResumePolicyResult {
  policyId: string;
  version: number;
}

@Injectable()
@CommandHandler(PolicyCommandTypes.RESUME_POLICY)
export class ResumePolicyHandler implements ICommandHandler<
  ResumePolicyCommand,
  ResumePolicyResult
> {
  private readonly logger = new Logger(ResumePolicyHandler.name);

  constructor(private readonly policiesRepo: PoliciesRepo) {}

  async execute(
    command: ResumePolicyCommand,
  ): Promise<CommandResult<ResumePolicyResult>> {
    const { payload, metadata } = command;

    this.logger.debug({
      message: 'Handling ResumePolicy command',
      correlationId: metadata.correlationId,
      policyId: payload.policyId,
    });

    const policy = await this.policiesRepo.findByIdOrFail(payload.policyId);

    const result = policy.resume(payload.expectedVersion, {
      correlationId: metadata.correlationId,
      causationId: metadata.causationId,
      actor: metadata.actor,
      timestamp: metadata.timestamp.toISOString(),
    });

    if (result.success === false) {
      this.logger.warn({
        message: 'Policy resume failed - business rule violation',
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
      message: 'Policy resumed successfully',
      correlationId: metadata.correlationId,
      policyId: policy.id,
    });

    return commandSuccess({
      policyId: policy.id,
      version: policy.version,
    });
  }
}
