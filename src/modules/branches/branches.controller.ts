import {
  Body,
  Controller,
  Delete,
  Get,
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
import { Branch } from '@prisma/client';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Branches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUSINESS)
@ApiBearerAuth()
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a branch owned by the authenticated business',
  })
  @ApiResponse({ status: 201, description: 'Branch created successfully' })
  @ApiResponse({ status: 403, description: 'Requires BUSINESS role' })
  create(
    @Body() dto: CreateBranchDto,
    @CurrentUser('id') businessId: string,
  ): Promise<Branch> {
    return this.branchesService.create(dto, businessId);
  }

  @Get()
  @ApiOperation({ summary: 'List branches of the authenticated business' })
  @ApiResponse({ status: 200, description: 'List of branches returned' })
  findAll(@CurrentUser('id') businessId: string): Promise<Branch[]> {
    return this.branchesService.findAll(businessId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one branch of the authenticated business' })
  @ApiResponse({ status: 200, description: 'Branch returned' })
  @ApiResponse({ status: 403, description: 'Branch belongs to another business' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') businessId: string,
  ): Promise<Branch> {
    return this.branchesService.findOne(id, businessId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update one branch of the authenticated business' })
  @ApiResponse({ status: 200, description: 'Branch updated successfully' })
  @ApiResponse({ status: 403, description: 'Branch belongs to another business' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser('id') businessId: string,
  ): Promise<Branch> {
    return this.branchesService.update(id, dto, businessId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one branch of the authenticated business' })
  @ApiResponse({ status: 200, description: 'Branch deleted successfully' })
  @ApiResponse({ status: 403, description: 'Branch belongs to another business' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') businessId: string,
  ): Promise<Branch> {
    return this.branchesService.remove(id, businessId);
  }
}