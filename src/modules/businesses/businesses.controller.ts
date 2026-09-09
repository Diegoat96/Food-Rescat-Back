import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Businesses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUSINESS)
@ApiBearerAuth()
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get('me/stats/today')
  @ApiOperation({ summary: 'Today aggregated stats for the authenticated business' })
  @ApiResponse({ status: 200, description: 'Today stats returned' })
  getTodayStats(@CurrentUser('id') businessId: string) {
    return this.businessesService.getTodayStats(businessId);
  }
}