/**
 * Actions Controller
 *
 * REST API for managing actions.
 * This is the input boundary - it:
 * 1. Receives HTTP requests
 * 2. Validates input (via DTOs)
 * 3. Creates commands and dispatches to command bus
 * 4. Uses read models for queries
 * 5. Returns appropriate HTTP responses
 *
 * Key principle: Controllers contain NO business logic.
 * They only translate between HTTP and the application layer.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  HttpException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CommandBus, CommandFactory } from '../../commands';
import { ActionCommandTypes } from '../../commands/action.commands';
import { ActionReadModel } from '../../read-models/action.read-model';
import { AuditService } from '../../audit/audit.service';
import { GetAuthenticatedUser, AuthenticatedUser } from '../../middlewares/auth.middleware';
import { RequestContext } from '../../shared/context/request-context';
import { CommandErrorCodes } from '../../shared/types/command.types';
import {
  CreateActionDto,
  UpdateActionDto,
  CompleteActionDto,
  CancelActionDto,
  ListActionsQueryDto,
  ActionResponseDto,
  ActionListResponseDto,
  CreateActionResponseDto,
  UpdateActionResponseDto,
  CompleteActionResponseDto,
  CancelActionResponseDto,
  ActionStatsResponseDto,
} from './dto/action.dto';

@ApiTags('Actions')
@ApiBearerAuth()
@Controller('actions')
export class ActionsController {
  private readonly logger = new Logger(ActionsController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly actionReadModel: ActionReadModel,
    private readonly auditService: AuditService,
  ) {}

  // ============================================================================
  // COMMAND ENDPOINTS (Write Operations)
  // ============================================================================

  /**
   * Create a new action.
   *
   * Flow:
   * HTTP POST -> Validate DTO -> Create Command -> Execute -> Return Result
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new action' })
  @ApiResponse({ status: 201, type: CreateActionResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 422, description: 'Business rule violation' })
  async createAction(
    @Body() dto: CreateActionDto,
    @GetAuthenticatedUser() user: AuthenticatedUser,
  ): Promise<CreateActionResponseDto> {
    const command = CommandFactory.create(ActionCommandTypes.CREATE_ACTION, {
      name: dto.name,
      type: dto.type,
      description: dto.description,
      metadata: dto.metadata,
    });

    const result = await this.commandBus.execute<{ actionId: string; version: number }>(command);

    if (result.success === false) {
      throw this.mapErrorToException(result.error);
    }

    return {
      actionId: result.data.actionId,
      version: result.data.version,
    };
  }

  /**
   * Update an existing action.
   */
  @Put(':actionId')
  @ApiOperation({ summary: 'Update an action' })
  @ApiResponse({ status: 200, type: UpdateActionResponseDto })
  @ApiResponse({ status: 404, description: 'Action not found' })
  @ApiResponse({ status: 409, description: 'Optimistic lock conflict' })
  @ApiResponse({ status: 422, description: 'Business rule violation' })
  async updateAction(
    @Param('actionId') actionId: string,
    @Body() dto: UpdateActionDto,
    @GetAuthenticatedUser() user: AuthenticatedUser,
  ): Promise<UpdateActionResponseDto> {
    const command = CommandFactory.create(ActionCommandTypes.UPDATE_ACTION, {
      actionId,
      name: dto.name,
      description: dto.description,
      metadata: dto.metadata,
      expectedVersion: dto.expectedVersion,
    });

    const result = await this.commandBus.execute<{ actionId: string; version: number }>(command);

    if (result.success === false) {
      throw this.mapErrorToException(result.error);
    }

    await this.actionReadModel.invalidateCache(actionId);

    return {
      actionId: result.data.actionId,
      version: result.data.version,
    };
  }

  /**
   * Complete an action.
   */
  @Post(':actionId/complete')
  @ApiOperation({ summary: 'Complete an action' })
  @ApiResponse({ status: 200, type: CompleteActionResponseDto })
  @ApiResponse({ status: 404, description: 'Action not found' })
  @ApiResponse({ status: 409, description: 'Optimistic lock conflict' })
  @ApiResponse({ status: 422, description: 'Business rule violation' })
  async completeAction(
    @Param('actionId') actionId: string,
    @Body() dto: CompleteActionDto,
    @GetAuthenticatedUser() user: AuthenticatedUser,
  ): Promise<CompleteActionResponseDto> {
    const command = CommandFactory.create(ActionCommandTypes.COMPLETE_ACTION, {
      actionId,
      result: dto.result,
      expectedVersion: dto.expectedVersion,
    });

    const result = await this.commandBus.execute<{
      actionId: string;
      version: number;
      completedAt: string;
    }>(command);

    if (result.success === false) {
      throw this.mapErrorToException(result.error);
    }

    await this.actionReadModel.invalidateCache(actionId);

    return {
      actionId: result.data.actionId,
      version: result.data.version,
      completedAt: result.data.completedAt,
    };
  }

  /**
   * Cancel an action.
   */
  @Post(':actionId/cancel')
  @ApiOperation({ summary: 'Cancel an action' })
  @ApiResponse({ status: 200, type: CancelActionResponseDto })
  @ApiResponse({ status: 404, description: 'Action not found' })
  @ApiResponse({ status: 409, description: 'Optimistic lock conflict' })
  @ApiResponse({ status: 422, description: 'Business rule violation' })
  async cancelAction(
    @Param('actionId') actionId: string,
    @Body() dto: CancelActionDto,
    @GetAuthenticatedUser() user: AuthenticatedUser,
  ): Promise<CancelActionResponseDto> {
    const command = CommandFactory.create(ActionCommandTypes.CANCEL_ACTION, {
      actionId,
      reason: dto.reason,
      expectedVersion: dto.expectedVersion,
    });

    const result = await this.commandBus.execute<{
      actionId: string;
      version: number;
      cancelledAt: string;
    }>(command);

    if (result.success === false) {
      throw this.mapErrorToException(result.error);
    }

    await this.actionReadModel.invalidateCache(actionId);

    return {
      actionId: result.data.actionId,
      version: result.data.version,
      cancelledAt: result.data.cancelledAt,
    };
  }

  // ============================================================================
  // QUERY ENDPOINTS (Read Operations)
  // ============================================================================

  /**
   * List actions with filtering and pagination.
   */
  @Get()
  @ApiOperation({ summary: 'List actions' })
  @ApiResponse({ status: 200, type: ActionListResponseDto })
  async listActions(
    @Query() query: ListActionsQueryDto,
    @GetAuthenticatedUser() user: AuthenticatedUser,
  ): Promise<ActionListResponseDto> {
    const result = await this.actionReadModel.listActions({
      userId: user.id,
      status: query.status,
      type: query.type,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      items: result.items.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        description: null,
        status: item.status,
        metadata: null,
        version: 0,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.createdAt.toISOString(),
        completedAt: null,
        user: {
          id: item.userId,
          email: '',
          name: item.userName,
        },
      })),
      total: result.total,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    };
  }

  /**
   * Get a single action by ID.
   */
  @Get(':actionId')
  @ApiOperation({ summary: 'Get action by ID' })
  @ApiResponse({ status: 200, type: ActionResponseDto })
  @ApiResponse({ status: 404, description: 'Action not found' })
  async getAction(
    @Param('actionId') actionId: string,
  ): Promise<ActionResponseDto> {
    const action = await this.actionReadModel.getActionById(actionId);

    if (!action) {
      throw new HttpException('Action not found', HttpStatus.NOT_FOUND);
    }

    return {
      id: action.id,
      name: action.name,
      type: action.type,
      description: action.description,
      status: action.status,
      metadata: action.metadata,
      version: action.version,
      createdAt: action.createdAt.toISOString(),
      updatedAt: action.updatedAt.toISOString(),
      completedAt: action.completedAt?.toISOString() ?? null,
      user: action.user,
    };
  }

  /**
   * Get action statistics.
   */
  @Get('stats/summary')
  @ApiOperation({ summary: 'Get action statistics' })
  @ApiResponse({ status: 200, type: ActionStatsResponseDto })
  async getStats(
    @GetAuthenticatedUser() user: AuthenticatedUser,
  ): Promise<ActionStatsResponseDto> {
    return this.actionReadModel.getActionStats(user.id);
  }

  /**
   * Get audit trail for an action.
   */
  @Get(':actionId/audit')
  @ApiOperation({ summary: 'Get action audit trail' })
  async getAuditTrail(@Param('actionId') actionId: string) {
    return this.auditService.getEntityAuditTrail('Action', actionId);
  }

  /**
   * Get event history for an action.
   */
  @Get(':actionId/history')
  @ApiOperation({ summary: 'Get action event history' })
  async getHistory(@Param('actionId') actionId: string) {
    return this.actionReadModel.getActionHistory(actionId);
  }

  // ============================================================================
  // ERROR MAPPING
  // ============================================================================

  /**
   * Map command errors to HTTP exceptions.
   */
  private mapErrorToException(error: { code: string; message: string }): HttpException {
    switch (error.code) {
      case CommandErrorCodes.NOT_FOUND:
        return new HttpException(error.message, HttpStatus.NOT_FOUND);
      case CommandErrorCodes.VALIDATION_FAILED:
        return new HttpException(error.message, HttpStatus.BAD_REQUEST);
      case CommandErrorCodes.OPTIMISTIC_LOCK_FAILED:
      case CommandErrorCodes.CONFLICT:
        return new HttpException(error.message, HttpStatus.CONFLICT);
      case CommandErrorCodes.UNAUTHORIZED:
        return new HttpException(error.message, HttpStatus.UNAUTHORIZED);
      case CommandErrorCodes.FORBIDDEN:
        return new HttpException(error.message, HttpStatus.FORBIDDEN);
      case CommandErrorCodes.BUSINESS_RULE_VIOLATION:
        return new HttpException(error.message, HttpStatus.UNPROCESSABLE_ENTITY);
      default:
        return new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
