import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Favorites')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
@ApiBearerAuth()
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post(':branchId')
  @ApiOperation({ summary: 'Add a branch to favorites' })
  @ApiResponse({ status: 201, description: 'Favorite added' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  @ApiResponse({ status: 409, description: 'Branch already favorited' })
  add(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser('id') customerId: string,
  ) {
    return this.favoritesService.add(customerId, branchId);
  }

  @Delete(':branchId')
  @ApiOperation({ summary: 'Remove a branch from favorites' })
  @ApiResponse({ status: 200, description: 'Favorite removed' })
  remove(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser('id') customerId: string,
  ) {
    return this.favoritesService.remove(customerId, branchId);
  }

  @Get()
  @ApiOperation({ summary: 'List all favorite branches for the customer' })
  @ApiResponse({ status: 200, description: 'List of favorites' })
  findAll(@CurrentUser('id') customerId: string) {
    return this.favoritesService.findAllByCustomer(customerId);
  }
}
