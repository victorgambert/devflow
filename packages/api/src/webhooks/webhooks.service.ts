/**
 * Webhooks Service
 */

import { Injectable } from '@nestjs/common';
import { createLogger } from '@devflow/common';
import { WorkflowsService } from '@/workflows/workflows.service';

@Injectable()
export class WebhooksService {
  private logger = createLogger('WebhooksService');

  constructor(private workflowsService: WorkflowsService) {}

  async handleGitHub(event: string, payload: any) {
    this.logger.info('GitHub webhook received', { event });

    // TODO: Handle different GitHub events (push, pull_request, etc.)
    return { received: true, event };
  }

  async handleLinear(signature: string, payload: any) {
    this.logger.info('Linear webhook received', { action: payload?.action, type: payload?.type });

    // TODO: Verify webhook signature

    // Handle Issue update events
    if (payload?.action === 'update' && payload?.type === 'Issue') {
      const issue = payload.data;
      const stateName = issue?.state?.name;

      // Three-Phase Agile Workflow triggers
      const triggerStatuses = [
        process.env.LINEAR_STATUS_TO_REFINEMENT || 'To Refinement',
        process.env.LINEAR_STATUS_TO_USER_STORY || 'Refinement Ready',
        process.env.LINEAR_STATUS_TO_PLAN || 'UserStory Ready',
      ];

      this.logger.info('Issue updated', {
        issueId: issue?.id,
        identifier: issue?.identifier,
        stateName,
        triggerStatuses,
        linearProjectId: issue?.projectId,
      });

      // Check if the issue moved to any of the trigger statuses
      if (triggerStatuses.includes(stateName)) {
        this.logger.info('Issue moved to trigger status, starting workflow', {
          issueId: issue?.id,
          identifier: issue?.identifier,
          triggerStatus: stateName,
        });

        try {
          // Map Linear projectId to DevFlow projectId
          // TODO: Create a proper mapping table in database
          const projectId = process.env.DEFAULT_PROJECT_ID;

          this.logger.info('Using DevFlow projectId', {
            devflowProjectId: projectId,
            linearProjectId: issue.projectId,
          });

          // Start the DevFlow workflow (router will determine which phase)
          const result = await this.workflowsService.start({
            taskId: issue.id,
            projectId,
            userId: payload.actor?.id,
            workflowType: 'devflowWorkflow',
          });

          this.logger.info('Workflow started successfully', {
            workflowId: result.workflowId,
            issueId: issue.id,
            projectId,
            triggerStatus: stateName,
          });

          return {
            received: true,
            action: payload?.action,
            type: payload?.type,
            workflowStarted: true,
            workflowId: result.workflowId,
            triggerStatus: stateName,
          };
        } catch (error) {
          this.logger.error('Failed to start workflow', error as Error, { issueId: issue?.id });
          throw error;
        }
      }
    }

    return { received: true, action: payload?.action, type: payload?.type };
  }
}

