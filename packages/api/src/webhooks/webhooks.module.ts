import { Module } from '@nestjs/common';
import { WebhooksController } from '@/webhooks/webhooks.controller';
import { WebhooksService } from '@/webhooks/webhooks.service';
import { WorkflowsModule } from '@/workflows/workflows.module';
import { LinearModule } from '@/linear/linear.module';

@Module({
  imports: [WorkflowsModule, LinearModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}

