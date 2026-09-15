import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { BusinessRequestsAdminController } from './business-requests-admin.controller';
import { BusinessRequestsController } from './business-requests.controller';
import { SupabaseService } from '../supabase/supabase.service';
import { BusinessRequestsService } from './business-requests.service';

@Module({
  imports: [NotificationsModule],
  controllers: [BusinessRequestsController, BusinessRequestsAdminController],
  providers: [BusinessRequestsService, SupabaseService],
})
export class BusinessRequestsModule {}