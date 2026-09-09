import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BusinessRequestsService } from './business-requests.service';
import { BusinessRequestResponseDto } from './dto/business-request-response.dto';
import { ListBusinessRequestsDto } from './dto/list-business-requests.dto';
import { RejectBusinessRequestDto } from './dto/reject-business-request.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/business-requests')
export class BusinessRequestsAdminController {
  constructor(
    private readonly businessRequestsService: BusinessRequestsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List and filter business requests (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Paginated business request list' })
  @ApiResponse({ status: 403, description: 'Requires ADMIN role' })
  list(@Query() query: ListBusinessRequestsDto) {
    return this.businessRequestsService.adminList(query);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a PENDING business request and promote the user to BUSINESS (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Request approved', type: BusinessRequestResponseDto })
  @ApiResponse({ status: 403, description: 'Requires ADMIN role' })
  @ApiResponse({ status: 404, description: 'Business request not found' })
  @ApiResponse({ status: 409, description: 'Request is not PENDING anymore' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.businessRequestsService.approve(id, adminId);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a PENDING business request with a reason (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Request rejected', type: BusinessRequestResponseDto })
  @ApiResponse({ status: 403, description: 'Requires ADMIN role' })
  @ApiResponse({ status: 404, description: 'Business request not found' })
  @ApiResponse({ status: 409, description: 'Request is not PENDING anymore' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectBusinessRequestDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.businessRequestsService.reject(id, adminId, dto);
  }
}