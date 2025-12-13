import { Module, forwardRef } from '@nestjs/common';
import { TasksController } from '@/tasks/tasks.controller';
import { TasksService } from '@/tasks/tasks.service';
import { WorkflowsModule } from '@/workflows/workflows.module';
import { LinearModule } from '@/linear/linear.module';

@Module({
  imports: [forwardRef(() => WorkflowsModule), LinearModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}

