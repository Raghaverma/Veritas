/**
 * Create Policy Command Handler
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
import { CreatePolicyCommand, PolicyCommandTypes } from '../policy.commands';
import { PoliciesRepo } from '../../repositories/policies.repo';
import { PolicyAggregate } from '../../domain/aggregates/policy.aggregate';

export interface CreatePolicyResult {
  policyId: string;
  version: number;
}

@Injectable()
@CommandHandler(PolicyCommandTypes.CREATE_POLICY)
export class CreatePolicyHandler implements ICommandHandler<
  CreatePolicyCommand,
  CreatePolicyResult
> {
  private readonly logger = new Logger(CreatePolicyHandler.name);

  constructor(private readonly policiesRepo: PoliciesRepo) {}

  async execute(
    command: CreatePolicyCommand,
  ): Promise<CommandResult<CreatePolicyResult>> {
    const { payload, metadata } = command;

    this.logger.debug({
      message: 'Handling CreatePolicy command',
      correlationId: metadata.correlationId,
      actorId: metadata.actor.id,
      policyName: payload.name,
    });

    const result = PolicyAggregate.create(
      metadata.actor.id,
      payload.name,
      payload.description ?? null,
      payload.rules,
      {
        correlationId: metadata.correlationId,
        causationId: metadata.causationId,
        actor: metadata.actor,
        timestamp: metadata.timestamp.toISOString(),
      },
    );

    if (result.success === false) {
      this.logger.warn({
        message: 'Policy creation failed - business rule violation',
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

    const aggregate = PolicyAggregate.fromState({
      id: result.events[0].aggregateId,
      userId: metadata.actor.id,
      name: payload.name,
      description: payload.description ?? null,
      rules: payload.rules,
      status: 'draft',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      activatedAt: null,
      suspendedAt: null,
      suspensionReason: null,
      revokedAt: null,
      revocationReason: null,
      revokedBy: null,
    });

    await this.policiesRepo.save(aggregate, result.events);

    this.logger.log({
      message: 'Policy created successfully',
      correlationId: metadata.correlationId,
      policyId: aggregate.id,
    });

    return commandSuccess({
      policyId: aggregate.id,
      version: aggregate.version,
    });
  }
}
