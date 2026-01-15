/**
 * Audit Module
 *
 * Provides audit logging services.
 * This module should be imported where audit functionality is needed.
 */

import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';

@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
