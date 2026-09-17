import { Module } from '@nestjs/common';
import { RatingsController } from './ratings.controller';
import { BranchRatingsController } from './branch-ratings.controller';
import { PackageRatingsController } from './package-ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  controllers: [RatingsController, BranchRatingsController, PackageRatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}