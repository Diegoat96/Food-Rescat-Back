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
import { AdminService } from './admin.service';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List, filter and paginate users (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  listUsers(@Query() query: ListUsersDto) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Suspend or reactivate a user (ADMIN)' })
  @ApiResponse({ status: 200, description: 'User status updated' })
  @ApiResponse({ status: 403, description: 'Cannot suspend self or another ADMIN' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.updateUserStatus(id, adminId, dto);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Global platform statistics (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Platform statistics returned' })
  getStatistics() {
    return this.adminService.getStatistics();
  }
}