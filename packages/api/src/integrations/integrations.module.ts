import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { FigmaApiService } from './figma/figma-api.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsTestService } from './integrations-test.service';

/**
 * Integrations Module
 *
 * Provides services for external API integrations (Figma, Sentry, GitHub, Linear).
 * These services are thin NestJS wrappers around SDK integration services.
 *
 * Each service depends on TokenRefreshService for OAuth token resolution.
 */
@Module({
  imports: [AuthModule], // Provides TokenRefreshService
  controllers: [IntegrationsController],
  providers: [FigmaApiService, IntegrationsTestService],
  exports: [FigmaApiService, IntegrationsTestService],
})
export class IntegrationsModule {}
