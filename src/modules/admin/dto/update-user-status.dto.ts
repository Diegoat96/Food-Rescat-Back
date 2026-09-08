import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserStatusDto {
  @ApiProperty({ example: false, description: 'Set false to suspend the user' })
  @IsBoolean()
  isActive!: boolean;
}