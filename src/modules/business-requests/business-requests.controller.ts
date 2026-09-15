import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { BusinessRequestsService } from './business-requests.service';
import { CreateBusinessRequestDto } from './dto/create-business-request.dto';
import { BusinessRequestResponseDto } from './dto/business-request-response.dto';
import {
  buildBusinessRequestMulterOptions,
  BUSINESS_LICENSES_DIR,
  BUSINESS_PHOTOS_DIR,
} from './files/business-request-multer.options';
import { businessRequestFilename } from './files/business-request-file.helpers';

@ApiTags('Business Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('business-requests')
export class BusinessRequestsController {
  constructor(
    private readonly businessRequestsService: BusinessRequestsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Post()
  @Roles(UserRole.CLIENT)
  @HttpCode(201)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        businessName: { type: 'string' },
        address: { type: 'string' },
        businessLicense: { type: 'string', format: 'binary' },
        photo: { type: 'string', format: 'binary' },
      },
      required: ['businessName', 'address', 'businessLicense'],
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'businessLicense', maxCount: 1 },
        { name: 'photo', maxCount: 1 },
      ],
      buildBusinessRequestMulterOptions(),
    ),
  )
  @ApiOperation({ summary: 'Submit a business registration request (CLIENT)' })
  @ApiResponse({ status: 201, description: 'Business request created', type: BusinessRequestResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid file type or missing businessLicense' })
  @ApiResponse({ status: 403, description: 'Requires CLIENT role' })
  @ApiResponse({ status: 409, description: 'A PENDING request already exists for this user' })
  async create(
    @Body() dto: CreateBusinessRequestDto,
    @UploadedFiles()
    files?: {
      businessLicense?: Express.Multer.File[];
      photo?: Express.Multer.File[];
    },
    @CurrentUser('id') userId?: string,
  ) {
    const licenseFile = files?.businessLicense?.[0];
    if (!licenseFile) {
      throw new BadRequestException('businessLicense file is required');
    }
    const photoFile = files?.photo?.[0];

    const businessLicenseUrl = await this.supabaseService.uploadFile(
      BUSINESS_LICENSES_DIR,
      businessRequestFilename(licenseFile),
      licenseFile.buffer,
      licenseFile.mimetype,
    );
    const photoUrl = photoFile
      ? await this.supabaseService.uploadFile(
          BUSINESS_PHOTOS_DIR,
          businessRequestFilename(photoFile),
          photoFile.buffer,
          photoFile.mimetype,
        )
      : null;

    return this.businessRequestsService.create(dto, userId!, {
      businessLicenseUrl,
      photoUrl,
    });
  }

  @Get('me')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Get your most recent business request (CLIENT)' })
  @ApiResponse({ status: 200, description: 'Latest business request returned', type: BusinessRequestResponseDto })
  @ApiResponse({ status: 403, description: 'Requires CLIENT role' })
  findMyLatest(@CurrentUser('id') userId: string) {
    return this.businessRequestsService.findLatestByUser(userId);
  }
}