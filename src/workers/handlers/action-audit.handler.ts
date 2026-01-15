/**
 * Action Audit Handler
 *
 * Listens to action events and creates audit log entries.
 * This handler demonstrates the event-to-audit-log flow.
 *
 * Why separate audit from the main flow?
 * - Decouples audit from business logic
 * - Audit can fail without affecting the main operation
 * - Can be processed asynchronously for better performance
 * - Audit logic can evolve independently
 */

import { Injectable, Logger } from '@nestjs/common';
import { IEventHandler, IDomainEvent } from '../../shared/types/event.types';
import { EventHandler } from '../domain-events.processor';
import { AuditService } from '../../audit/audit.service';
import { ActionEventTypes } from '../../domain/events/action.events';
import { RequestContext } from '../../shared/context/request-context';

@Injectable()
@EventHandler([
  ActionEventTypes.ACTION_CREATED,
  ActionEventTypes.ACTION_UPDATED,
  ActionEventTypes.ACTION_COMPLETED,
  ActionEventTypes.ACTION_CANCELLED,
])
export class ActionAuditHandler implements IEventHandler<IDomainEvent> {
  readonly handlerName = 'ActionAuditHandler';
  private readonly logger = new Logger(ActionAuditHandler.name);

  constructor(private readonly auditService: AuditService) {}

  async handle(event: IDomainEvent): Promise<void> {
    const context = RequestContext.current();
    const { eventType, aggregateType, aggregateId, payload, metadata } = event;

    this.logger.debug({
      message: 'Creating audit log for action event',
      eventType,
      aggregateId,
      correlationId: metadata.correlationId,
    });

    const action = this.mapEventTypeToAction(eventType);

    const { beforeSnapshot, afterSnapshot, changes } = this.extractSnapshots(
      eventType,
      payload as Record<string, unknown>,
    );

    await this.auditService.createAuditLog({
      correlationId: metadata.correlationId,
      entityType: aggregateType,
      entityId: aggregateId,
      action,
      actorId: metadata.actor.id,
      actorEmail: metadata.actor.email,
      actorIp: context?.clientIp ?? undefined,
      actorUserAgent: context?.userAgent ?? undefined,
      beforeSnapshot,
      afterSnapshot,
      changes,
      metadata: {
        eventType,
        eventVersion: metadata.version,
        timestamp: metadata.timestamp,
      },
    });

    this.logger.debug({
      message: 'Audit log created for action event',
      eventType,
      aggregateId,
    });
  }

  /**
   * Map event type to audit action.
   */
  private mapEventTypeToAction(eventType: string): string {
    switch (eventType) {
      case ActionEventTypes.ACTION_CREATED:
        return 'create';
      case ActionEventTypes.ACTION_UPDATED:
        return 'update';
      case ActionEventTypes.ACTION_COMPLETED:
        return 'complete';
      case ActionEventTypes.ACTION_CANCELLED:
        return 'cancel';
      default:
        return 'unknown';
    }
  }

  /**
   * Extract before/after snapshots from event payload.
   */
  private extractSnapshots(
    eventType: string,
    payload: Record<string, unknown>,
  ): {
    beforeSnapshot: Record<string, unknown> | null;
    afterSnapshot: Record<string, unknown> | null;
    changes: Record<string, { from: unknown; to: unknown }> | undefined;
  } {
    switch (eventType) {
      case ActionEventTypes.ACTION_CREATED:
        return {
          beforeSnapshot: null,
          afterSnapshot: payload as Record<string, unknown>,
          changes: undefined,
        };

      case ActionEventTypes.ACTION_UPDATED:
        return {
          beforeSnapshot: null,
          afterSnapshot: null,
          changes: payload.changes as Record<string, { from: unknown; to: unknown }> | undefined,
        };

      case ActionEventTypes.ACTION_COMPLETED:
        return {
          beforeSnapshot: null,
          afterSnapshot: {
            actionId: payload.actionId,
            status: 'inactive',
            completedAt: payload.completedAt,
            result: payload.result,
          },
          changes: {
            status: { from: 'active', to: 'inactive' },
          },
        };

      case ActionEventTypes.ACTION_CANCELLED:
        return {
          beforeSnapshot: null,
          afterSnapshot: {
            actionId: payload.actionId,
            status: 'inactive',
            cancelledAt: payload.cancelledAt,
            reason: payload.reason,
          },
          changes: {
            status: { from: 'active', to: 'inactive' },
          },
        };

      default:
        return {
          beforeSnapshot: null,
          afterSnapshot: payload as Record<string, unknown>,
          changes: undefined,
        };
    }
  }
}
