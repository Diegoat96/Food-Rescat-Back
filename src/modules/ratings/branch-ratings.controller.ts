import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';

// Public ratings for a branch. Kept OUTSIDE BranchesController (BUSINESS-only)
// so it is intentionally anonymous without relying on empty @UseGuards().
@ApiTags('Branches')
@Controller('branches')
export class BranchRatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get(':id/ratings')
  @ApiOperation({
    summary: 'Get ratings and average score for a branch (public)',
  })
  @ApiResponse({ status: 200, description: 'Ratings with average' })
  findRatings(@Param('id', ParseUUIDPipe) id: string) {
    return this.ratingsService.findByBranch(id);
  }
}