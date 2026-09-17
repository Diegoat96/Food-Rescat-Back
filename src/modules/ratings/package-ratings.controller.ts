import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';

// Public ratings for a package (a food post). Kept OUTSIDE PackagesController
// to avoid a module dependency on RatingsService and to keep it publicly accessible.
@ApiTags('Packages')
@Controller('packages')
export class PackageRatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get(':id/ratings')
  @ApiOperation({
    summary: 'Get ratings and average score for a package (public)',
  })
  @ApiResponse({ status: 200, description: 'Ratings with average' })
  findRatings(@Param('id', ParseUUIDPipe) id: string) {
    return this.ratingsService.findByPackage(id);
  }
}