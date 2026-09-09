import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateBusinessRequestDto {
  @ApiProperty({ example: 'Panadería Doña Mela' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  businessName!: string;

  @ApiProperty({ example: '3a Avenida 1-45, Zona 1, Guatemala' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address!: string;
}