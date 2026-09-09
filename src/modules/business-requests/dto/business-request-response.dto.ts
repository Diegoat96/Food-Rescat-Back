import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessRequestStatus } from '@prisma/client';

export class BusinessRequestResponseDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ example: 'Panadería Doña Mela' })
  businessName!: string;

  @ApiProperty({ example: '3a Avenida 1-45, Zona 1, Guatemala' })
  address!: string;

  @ApiProperty({ example: '/api/static/business-licenses/9e8a2d6b-1.pdf' })
  businessLicenseUrl!: string;

  @ApiPropertyOptional({ example: '/api/static/business-photos/3c1f9a2d-4.jpg' })
  photoUrl!: string | null;

  @ApiProperty({ enum: BusinessRequestStatus })
  status!: BusinessRequestStatus;

  @ApiPropertyOptional()
  reviewedBy!: string | null;

  @ApiPropertyOptional({ example: '2026-09-05T10:00:00.000Z' })
  reviewedAt!: Date | null;

  @ApiPropertyOptional({ example: 'La póliza no es legible' })
  reason!: string | null;

  @ApiProperty({ example: '2026-09-05T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-05T10:00:00.000Z' })
  updatedAt!: Date;
}