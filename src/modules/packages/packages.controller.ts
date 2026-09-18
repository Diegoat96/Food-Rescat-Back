import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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
import { SupabaseService } from '../supabase/supabase.service';
import {
  buildPackageMulterOptions,
  PACKAGE_IMAGES_DIR,
} from './files/package-multer.options';
import { packageImageFilename } from './files/package-file.helpers';

@ApiTags('Packages')
@Controller('packages')
export class PackagesController {
  constructor(
    private readonly packagesService: PackagesService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUSINESS)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        categoryId: { type: 'string', format: 'uuid' },
        branchId: { type: 'string', format: 'uuid' },
        quantity: { type: 'integer' },
        pickupDeadline: { type: 'string', format: 'date-time' },
        originalPrice: { type: 'number' },
        discountedPrice: { type: 'number' },
        estimatedWeightKg: { type: 'number' },
        image: { type: 'string', format: 'binary' },
      },
      required: [
        'name',
        'categoryId',
        'branchId',
        'pickupDeadline',
        'originalPrice',
        'discountedPrice',
        'estimatedWeightKg',
      ],
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'image', maxCount: 1 }], buildPackageMulterOptions()),
  )
  @ApiOperation({ summary: 'Create a package owned by the authenticated business' })
  @ApiResponse({ status: 201, description: 'Package created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid image type or missing fields' })
  @ApiResponse({ status: 403, description: 'Requires BUSINESS role or branch belongs to another business' })
  @ApiResponse({ status: 404, description: 'Branch or category not found' })
  async create(
    @Body() dto: CreatePackageDto,
    @UploadedFiles()
    files?: {
      image?: Express.Multer.File[];
    },
    @CurrentUser('id') businessId?: string,
  ) {
    const imageFile = files?.image?.[0];
    if (imageFile) {
      dto.imageUrl = await this.supabaseService.uploadFile(
        PACKAGE_IMAGES_DIR,
        packageImageFilename(imageFile),
        imageFile.buffer,
        imageFile.mimetype,
      );
    }
    return this.packagesService.create(dto, businessId!);
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

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a package owned by the authenticated business (soft delete)' })
  @ApiResponse({ status: 200, description: 'Package cancelled successfully' })
  @ApiResponse({ status: 403, description: 'Package belongs to another business' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  @ApiResponse({ status: 409, description: 'Package cannot be cancelled from its current status' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') businessId: string,
  ) {
    return this.packagesService.cancel(id, businessId);
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
