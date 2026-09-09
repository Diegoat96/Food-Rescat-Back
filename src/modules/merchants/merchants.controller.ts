import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Merchants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUSINESS)
@ApiBearerAuth()
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get('me/statistics/kpis')
  @ApiOperation({ summary: 'KPI dashboard for the authenticated merchant' })
  @ApiResponse({ status: 200, description: 'Merchant KPIs returned' })
  getKpis(@CurrentUser('id') merchantId: string) {
    return this.merchantsService.getKpis(merchantId);
  }
}