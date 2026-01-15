/**
 * Action DTOs
 *
 * Data Transfer Objects for the Actions API.
 * These define the shape of request/response payloads.
 *
 * Why separate from domain types?
 * - DTOs are for API contract
 * - Domain types are for business logic
 * - Allows evolution of API without changing domain
 * - Clear validation rules for API input
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ActionTypeEnum {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SUSPEND = 'suspend',
  ACTIVATE = 'activate',
  CUSTOM = 'custom',
}

// ============================================================================
// REQUEST DTOs
// ============================================================================

export class CreateActionDto {
  @ApiProperty({ description: 'Name of the action', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: ActionTypeEnum, description: 'Type of action' })
  @IsEnum(ActionTypeEnum)
  type: ActionTypeEnum;

  @ApiPropertyOptional({ description: 'Description of the action' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateActionDto {
  @ApiPropertyOptional({ description: 'Updated name', maxLength: 200 })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Updated description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Updated metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty({ description: 'Expected version for optimistic concurrency' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  expectedVersion: number;
}

export class CompleteActionDto {
  @ApiPropertyOptional({
    description: 'Result data from completing the action',
  })
  @IsObject()
  @IsOptional()
  result?: Record<string, unknown>;

  @ApiProperty({ description: 'Expected version for optimistic concurrency' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  expectedVersion: number;
}

export class CancelActionDto {
  @ApiProperty({ description: 'Reason for cancellation' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ description: 'Expected version for optimistic concurrency' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  expectedVersion: number;
}

// ============================================================================
// QUERY DTOs
// ============================================================================

export class ListActionsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsString()
  @IsOptional()
  status?: 'active' | 'inactive' | 'suspended';

  @ApiPropertyOptional({ description: 'Filter by type' })
  @IsEnum(ActionTypeEnum)
  @IsOptional()
  type?: ActionTypeEnum;

  @ApiPropertyOptional({ description: 'Search in name/description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Page limit', default: 20 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Page offset', default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

export class ActionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() type: string;
  @ApiPropertyOptional() description: string | null;
  @ApiProperty() status: string;
  @ApiPropertyOptional() metadata: Record<string, unknown> | null;
  @ApiProperty() version: number;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
  @ApiPropertyOptional() completedAt: string | null;
  @ApiProperty() user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export class ActionListResponseDto {
  @ApiProperty({ type: [ActionResponseDto] })
  items: ActionResponseDto[];

  @ApiProperty() total: number;
  @ApiProperty() limit: number;
  @ApiProperty() offset: number;
}

export class CreateActionResponseDto {
  @ApiProperty() actionId: string;
  @ApiProperty() version: number;
}

export class UpdateActionResponseDto {
  @ApiProperty() actionId: string;
  @ApiProperty() version: number;
}

export class CompleteActionResponseDto {
  @ApiProperty() actionId: string;
  @ApiProperty() version: number;
  @ApiProperty() completedAt: string;
}

export class CancelActionResponseDto {
  @ApiProperty() actionId: string;
  @ApiProperty() version: number;
  @ApiProperty() cancelledAt: string;
}

export class ActionStatsResponseDto {
  @ApiProperty() total: number;
  @ApiProperty() active: number;
  @ApiProperty() completed: number;
  @ApiProperty() cancelled: number;
  @ApiProperty() byType: Record<string, number>;
}
