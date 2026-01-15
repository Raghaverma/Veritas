/**
 * Actions Module
 *
 * Feature module for action management.
 * Wires together all components needed for the actions feature.
 *
 * Components:
 * - Controller: HTTP API
 * - Command Handlers: Business logic execution
 * - Repository: Data access
 * - Read Model: Query optimization
 * - Event Handlers: Side effects
 */

import { Module } from '@nestjs/common';
import { ActionsController } from './actions.controller';
import { ActionsRepo } from '../../repositories/actions.repo';
import { CreateActionHandler } from '../../commands/handlers/create-action.handler';
import { UpdateActionHandler } from '../../commands/handlers/update-action.handler';
import { CompleteActionHandler } from '../../commands/handlers/complete-action.handler';
import { CancelActionHandler } from '../../commands/handlers/cancel-action.handler';
import { ActionAuditHandler } from '../../workers/handlers/action-audit.handler';
import { CommandsModule } from '../../commands/commands.module';
import { EventBusModule } from '../../event-bus/event-bus.module';
import { AuditModule } from '../../audit/audit.module';
import { ReadModelsModule } from '../../read-models/read-models.module';

@Module({
  imports: [
    CommandsModule,
    EventBusModule,
    AuditModule,
    ReadModelsModule,
  ],
  controllers: [ActionsController],
  providers: [
    ActionsRepo,
    CreateActionHandler,
    UpdateActionHandler,
    CompleteActionHandler,
    CancelActionHandler,
    ActionAuditHandler,
  ],
  exports: [ActionsRepo],
})
export class ActionsModule {}
