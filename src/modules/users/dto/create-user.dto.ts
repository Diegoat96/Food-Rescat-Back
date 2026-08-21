import { IsString, IsEmail, IsOptional, IsEnum, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums/user-role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'Juan Perez' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ example: '+502 1234 5678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.CLIENT })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
