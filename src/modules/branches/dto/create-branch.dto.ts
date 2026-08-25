import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// businessId is never accepted from the request body (the global ValidationPipe
// forbids non-whitelisted properties); it is derived from the JWT via @CurrentUser.
export class CreateBranchDto {
  @ApiProperty({ example: 'Downtown Branch' })
  @IsString()
  name!: string;

  @ApiProperty({ example: '123 Main Street' })
  @IsString()
  address!: string;

  @ApiPropertyOptional({ example: '+502 5555 5555' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Mon-Sat 08:00-18:00' })
  @IsOptional()
  @IsString()
  openingHours?: string;
}
