/**
 * Repository Module
 *
 * Global module providing data access repositories.
 */

import { Global, Module } from '@nestjs/common';
import { UsersRepo } from './users.repo';
import { ActionsRepo } from './actions.repo';
import { PoliciesRepo } from './policies.repo';
import { EventBusModule } from '../event-bus/event-bus.module';

@Global()
@Module({
  imports: [EventBusModule],
  providers: [UsersRepo, ActionsRepo, PoliciesRepo],
  exports: [UsersRepo, ActionsRepo, PoliciesRepo],
})
export class RepositoryModule { }
