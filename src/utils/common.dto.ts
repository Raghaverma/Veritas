import { IsEnum, IsNumber, IsOptional, Max } from 'class-validator';
import { OrderByEnum } from './constants';

export class PaginationDto {
  @IsNumber()
  @IsOptional()
  skip: number = 0;

  @IsNumber()
  @IsOptional()
  @Max(50)
  limit: number = 10;

  @IsEnum(OrderByEnum)
  @IsOptional()
  orderBy: OrderByEnum = OrderByEnum.DESC;
}
