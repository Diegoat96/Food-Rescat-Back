import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectBusinessRequestDto {
  @ApiProperty({ example: 'La póliza de licencia no es legible. Adjunta una copia clara.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}