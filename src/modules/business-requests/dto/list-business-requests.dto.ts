import { ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessRequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class ListBusinessRequestsDto {
  @ApiPropertyOptional({ enum: BusinessRequestStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(BusinessRequestStatus)
  status?: BusinessRequestStatus;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}