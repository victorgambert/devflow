/**
 * Workflows Service - Temporal Integration
 */

import { Injectable } from '@nestjs/common';
import { Connection, Client } from '@temporalio/client';
import { createLogger, loadConfig, WorkflowConfig, DEFAULT_WORKFLOW_CONFIG } from '@devflow/common';
import { StartWorkflowDto } from '@/workflows/dto';

@Injectable()
export class WorkflowsService {
  private logger = createLogger('WorkflowsService');
  private client: Client | null = null;
  private workflowConfig: WorkflowConfig;

  async onModuleInit() {
    try {
      // Load config once at service initialization
      // Merge loaded statuses with DEFAULT_WORKFLOW_CONFIG for statusOrder and workflow behavior
      const fullConfig = loadConfig();
      this.workflowConfig = {
        linear: {
          statuses: fullConfig.linear.statuses,
          statusOrder: DEFAULT_WORKFLOW_CONFIG.linear.statusOrder,
          workflow: DEFAULT_WORKFLOW_CONFIG.linear.workflow,
          features: DEFAULT_WORKFLOW_CONFIG.linear.features,
        },
      };
      this.logger.info('Workflow config loaded');

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

    // Determine workflow type (default to full devflow workflow)
    const workflowType = dto.workflowType || 'devflowWorkflow';
    const workflowId = `${workflowType}-${dto.taskId}-${Date.now()}`;

    const handle = await this.client.workflow.start(workflowType, {
      taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'devflow',
      workflowId,
      args: [
        {
          taskId: dto.taskId,
          projectId: dto.projectId,
          userId: dto.userId || 'system',
          config: this.workflowConfig, // Pass workflow config
        },
      ],
    });

    return {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
    };
  }

  /**
   * Start a spec generation workflow
   */
  async startSpecGeneration(taskId: string, projectId: string, userId?: string) {
    this.logger.info('Starting spec generation workflow', { taskId, projectId });

    return this.start({
      taskId,
      projectId,
      userId,
      workflowType: 'specGenerationWorkflow',
    });
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

