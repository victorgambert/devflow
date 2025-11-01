/**
 * Workflows Service - Temporal Integration
 */

import { Injectable } from '@nestjs/common';
import { Connection, Client } from '@temporalio/client';
import { createLogger } from '@devflow/common';
import { StartWorkflowDto } from './dto';

@Injectable()
export class WorkflowsService {
  private logger = createLogger('WorkflowsService');
  private client: Client | null = null;

  async onModuleInit() {
    try {
      const connection = await Connection.connect({
        address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      });

      this.client = new Client({
        connection,
        namespace: process.env.TEMPORAL_NAMESPACE || 'default',
      });

      this.logger.info('Connected to Temporal');
    } catch (error) {
      this.logger.error('Failed to connect to Temporal', error as Error);
    }
  }

  async start(dto: StartWorkflowDto) {
    this.logger.info('Starting workflow', dto);

    if (!this.client) {
      throw new Error('Temporal client not initialized');
    }

    const workflowId = `devflow-${dto.taskId}-${Date.now()}`;

    const handle = await this.client.workflow.start('devflowWorkflow', {
      taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'devflow',
      workflowId,
      args: [
        {
          taskId: dto.taskId,
          projectId: dto.projectId,
          userId: dto.userId || 'system',
        },
      ],
    });

    return {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
    };
  }

  async getStatus(workflowId: string) {
    this.logger.info('Getting workflow status', { workflowId });

    if (!this.client) {
      throw new Error('Temporal client not initialized');
    }

    const handle = this.client.workflow.getHandle(workflowId);
    const description = await handle.describe();

    return {
      workflowId,
      status: description.status.name,
      startTime: description.startTime,
      closeTime: description.closeTime,
    };
  }

  async cancel(workflowId: string) {
    this.logger.info('Cancelling workflow', { workflowId });

    if (!this.client) {
      throw new Error('Temporal client not initialized');
    }

    const handle = this.client.workflow.getHandle(workflowId);
    await handle.cancel();

    return { workflowId, status: 'cancelled' };
  }
}

