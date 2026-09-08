import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { QueryPackagesDto } from './dto/query-packages.dto';
import { ReservePackageDto } from './dto/reserve-package.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Packages')
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a package owned by the authenticated business' })
  @ApiResponse({ status: 201, description: 'Package created successfully' })
  @ApiResponse({ status: 403, description: 'Requires BUSINESS role or branch belongs to another business' })
  @ApiResponse({ status: 404, description: 'Branch or category not found' })
  create(
    @Body() dto: CreatePackageDto,
    @CurrentUser('id') businessId: string,
  ) {
    return this.packagesService.create(dto, businessId);
  }

  @Get()
  @ApiOperation({ summary: 'List packages with filters and pagination (public)' })
  @ApiResponse({ status: 200, description: 'List of packages returned' })
  findAll(@Query() query: QueryPackagesDto) {
    return this.packagesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one package (public)' })
  @ApiResponse({ status: 200, description: 'Package returned' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.packagesService.findOne(id);
  }

  @Post(':id/reserve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reserve a package atomically (CLIENT)' })
  @ApiResponse({ status: 201, description: 'Reservation created' })
  @ApiResponse({ status: 409, description: 'Package is no longer available' })
  reserve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReservePackageDto,
    @CurrentUser('id') clientId: string,
  ) {
    return this.packagesService.reserve(id, clientId, dto.paymentMethod);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a package owned by the authenticated business' })
  @ApiResponse({ status: 200, description: 'Package updated successfully' })
  @ApiResponse({ status: 403, description: 'Package or branch belongs to another business' })
  @ApiResponse({ status: 404, description: 'Package, branch or category not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePackageDto,
    @CurrentUser('id') businessId: string,
  ) {
    return this.packagesService.update(id, dto, businessId);
  }
}
