import { Module } from '@nestjs/common';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  controllers: [PackagesController],
  providers: [PackagesService, SupabaseService],
})
export class PackagesModule {}
