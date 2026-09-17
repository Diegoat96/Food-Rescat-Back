import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePackageDto {
  @ApiProperty({ example: 'Artisan bread x10' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Baguettes, croissants and sourdough' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 50.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  originalPrice!: number;

  @ApiProperty({ example: 25.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  discountedPrice!: number;

  @ApiProperty({ example: 2.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  estimatedWeightKg!: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity?: number;

  @ApiProperty({ example: '2026-08-28T20:00:00.000Z' })
  @IsDateString()
  pickupDeadline!: string;

  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsUUID()
  branchId!: string;

  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({
    example: 'https://xxx.supabase.co/storage/v1/object/public/foodrescat/package-images/uuid.jpg',
    description: 'Public URL of the package image (set by the server after upload)',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
