import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateUserDto {
  @ApiPropertyOptional({ description: 'User display name' })
  @IsString()
  @IsOptional()
  name?: string;
}
