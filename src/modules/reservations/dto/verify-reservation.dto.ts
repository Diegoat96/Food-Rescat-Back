import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyReservationDto {
  @ApiProperty({ example: 'RC-99A2' })
  @IsString()
  verificationCode!: string;
}