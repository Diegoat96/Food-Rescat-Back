import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { PackagesService } from '../packages/packages.service';
import { ListMyPackagesDto } from '../packages/dto/list-my-packages.dto';
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
  constructor(
    private readonly merchantsService: MerchantsService,
    private readonly packagesService: PackagesService,
  ) {}

  @Get('me/packages')
  @ApiOperation({
    summary:
      'List every package of the authenticated business (all statuses, any branch)',
  })
  @ApiResponse({ status: 200, description: 'List of packages returned' })
  @ApiResponse({ status: 403, description: 'Branch belongs to another business' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  findAllMyPackages(
    @Query() dto: ListMyPackagesDto,
    @CurrentUser('id') businessId: string,
  ) {
    return this.packagesService.findAllForBusiness(businessId, dto);
  }

  @Get('me/statistics/kpis')
  @ApiOperation({ summary: 'KPI dashboard for the authenticated merchant' })
  @ApiResponse({ status: 200, description: 'Merchant KPIs returned' })
  getKpis(@CurrentUser('id') merchantId: string) {
    return this.merchantsService.getKpis(merchantId);
  }
}