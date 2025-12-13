/**
 * Linear Module - Linear integration services for API
 */

import { Module, forwardRef } from '@nestjs/common';
import { LinearSyncApiService } from './linear-sync-api.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  providers: [LinearSyncApiService],
  exports: [LinearSyncApiService],
})
export class LinearModule {}
