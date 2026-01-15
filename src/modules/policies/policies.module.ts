/**
 * Policies Module
 *
 * Provides all Policy-related components:
 * - Command handlers
 * - Event handlers (workers)
 * - API controllers (when created)
 */

import { Module } from '@nestjs/common';
import { CreatePolicyHandler } from '../../commands/handlers/create-policy.handler';
import { ActivatePolicyHandler } from '../../commands/handlers/activate-policy.handler';
import { SuspendPolicyHandler } from '../../commands/handlers/suspend-policy.handler';
import { ResumePolicyHandler } from '../../commands/handlers/resume-policy.handler';
import { RevokePolicyHandler } from '../../commands/handlers/revoke-policy.handler';
import { PolicyAuditHandler } from '../../workers/handlers/policy-audit.handler';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [
    CreatePolicyHandler,
    ActivatePolicyHandler,
    SuspendPolicyHandler,
    ResumePolicyHandler,
    RevokePolicyHandler,
    PolicyAuditHandler,
  ],
  exports: [],
})
export class PoliciesModule {}
