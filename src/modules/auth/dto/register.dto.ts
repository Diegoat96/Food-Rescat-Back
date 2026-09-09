import { IsString, IsEmail, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// NOTE: the role is intentionally NOT accepted here. Public registration only
// creates CLIENT accounts; BUSINESS/ADMIN must be created by an authenticated
// ADMIN. Accepting a role from the public would allow privilege escalation.
export class RegisterDto {
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
}