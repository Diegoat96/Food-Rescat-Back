import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { VerifyReservationDto } from './dto/verify-reservation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'List reservations of the authenticated client' })
  @ApiResponse({ status: 200, description: 'List of client reservations returned' })
  findMyReservations(@CurrentUser('id') clientId: string) {
    return this.reservationsService.findByClient(clientId);
  }

  @Post('verify')
  @Roles(UserRole.BUSINESS)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Verify a PENDING reservation of a branch owned by the authenticated business',
  })
  @ApiResponse({ status: 200, description: 'Reservation verified' })
  @ApiResponse({ status: 403, description: 'Reservation belongs to another business' })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  verify(
    @Body() dto: VerifyReservationDto,
    @CurrentUser('id') businessId: string,
  ) {
    return this.reservationsService.verify(dto.verificationCode, businessId);
  }

  @Patch(':id/complete')
  @Roles(UserRole.BUSINESS)
  @ApiOperation({ summary: 'Complete a PENDING reservation (mark package PICKED_UP)' })
  @ApiResponse({ status: 200, description: 'Reservation completed' })
  @ApiResponse({ status: 403, description: 'Reservation belongs to another business' })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') businessId: string,
  ) {
    return this.reservationsService.complete(id, businessId);
  }

  @Get('pending')
  @Roles(UserRole.BUSINESS)
  @ApiOperation({ summary: 'List PENDING reservations of the authenticated business' })
  @ApiResponse({ status: 200, description: 'List of pending reservations returned' })
  findPending(@CurrentUser('id') businessId: string) {
    return this.reservationsService.findPending(businessId);
  }
}