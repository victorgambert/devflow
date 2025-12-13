/**
 * Project Commands
 */

import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { apiClient } from '../utils/api-client';
import { DEFAULT_WORKFLOW_CONFIG } from '@devflow/common';

export const projectCommands = {
  async list() {
    const spinner = ora('Fetching projects...').start();

    try {
      const { data } = await apiClient.get('/projects');
      spinner.stop();

      if (data.length === 0) {
        console.log(chalk.gray('No projects found'));
        return;
      }

      console.log(chalk.bold('\n📦 Projects:\n'));
      data.forEach((project: any) => {
        console.log(`  ${chalk.blue(project.id)} - ${project.name}`);
        console.log(`    ${chalk.gray(project.description)}`);
        console.log(`    ${chalk.gray(`Repository: ${project.repository}`)}\n`);
      });
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to fetch projects'));
      console.error(error.message);
      process.exit(1);
    }
  },

  async create() {
    console.log(chalk.bold('\n📦 Create New Project\n'));

    try {
      // Step 1: Project basic info
      const projectInfo = await prompts([
        {
          type: 'text',
          name: 'name',
          message: 'Project name:',
          validate: (value) => value.length > 0 || 'Name is required',
        },
        {
          type: 'text',
          name: 'description',
          message: 'Project description:',
          validate: (value) => value.length > 0 || 'Description is required',
        },
        {
          type: 'text',
          name: 'repository',
          message: 'Repository URL (e.g., https://github.com/org/repo):',
          validate: (value) => {
            if (!value) return 'Repository URL is required';
            if (!value.startsWith('http')) return 'Must be a valid URL';
            return true;
          },
        },
        {
          type: 'text',
          name: 'workspacePath',
          message: 'Workspace path (optional):',
        },
      ]);

      if (!projectInfo.name) {
        console.log(chalk.yellow('Project creation cancelled.'));
        return;
      }

      // Step 2: Configure Linear
      console.log(chalk.cyan('\n🔧 Linear Configuration\n'));

      const { configureLinear } = await prompts({
        type: 'confirm',
        name: 'configureLinear',
        message: 'Configure Linear workflow now?',
        initial: true,
      });

      let config = { ...DEFAULT_WORKFLOW_CONFIG };

      if (configureLinear) {
        const { customizeStatuses } = await prompts({
          type: 'confirm',
          name: 'customizeStatuses',
          message: 'Customize Linear statuses? (default statuses will be used otherwise)',
          initial: false,
        });

        if (customizeStatuses) {
          console.log(chalk.gray('\nConfiguring Three-Phase Agile statuses...\n'));

          // Phase 1: Refinement
          console.log(chalk.bold('Phase 1: Refinement'));
          const refinementStatuses = await prompts([
            {
              type: 'text',
              name: 'toRefinement',
              message: '  Trigger status (to start refinement):',
              initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.toRefinement,
            },
            {
              type: 'text',
              name: 'refinementInProgress',
              message: '  In progress status:',
              initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.refinementInProgress,
            },
            {
              type: 'text',
              name: 'refinementReady',
              message: '  Ready status:',
              initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.refinementReady,
            },
            {
              type: 'text',
              name: 'refinementFailed',
              message: '  Failed status:',
              initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.refinementFailed,
            },
          ]);

          // Phase 2: User Story
          console.log(chalk.bold('\nPhase 2: User Story'));
          const userStoryStatuses = await prompts([
            {
              type: 'text',
              name: 'toUserStory',
              message: '  Trigger status (to start user story):',
              initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.toUserStory,
            },
            {
              type: 'text',
              name: 'userStoryInProgress',
              message: '  In progress status:',
              initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.userStoryInProgress,
            },
            {
              type: 'text',
              name: 'userStoryReady',
              message: '  Ready status:',
              initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.userStoryReady,
            },
            {
              type: 'text',
              name: 'userStoryFailed',
              message: '  Failed status:',
              initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.userStoryFailed,
            },
          ]);

          // Phase 3: Technical Plan
          console.log(chalk.bold('\nPhase 3: Technical Plan'));
          const planStatuses = await prompts([
            {
              type: 'text',
              name: 'toPlan',
              message: '  Trigger status (to start planning):',
              initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.toPlan,
            },
            {
              type: 'text',
              name: 'planInProgress',
              message: '  In progress status:',
              initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.planInProgress,
            },
            {
              type: 'text',
              name: 'planReady',
              message: '  Ready status:',
              initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.planReady,
            },
            {
              type: 'text',
              name: 'planFailed',
              message: '  Failed status:',
              initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.planFailed,
            },
          ]);

          // Merge custom statuses
          config = {
            ...DEFAULT_WORKFLOW_CONFIG,
            linear: {
              ...DEFAULT_WORKFLOW_CONFIG.linear,
              statuses: {
                ...DEFAULT_WORKFLOW_CONFIG.linear.statuses,
                ...refinementStatuses,
                ...userStoryStatuses,
                ...planStatuses,
              },
            },
          };
        }

        // Features configuration
        const { enableSubtaskCreation } = await prompts({
          type: 'confirm',
          name: 'enableSubtaskCreation',
          message: 'Enable automatic subtask creation for L/XL complexity tasks?',
          initial: DEFAULT_WORKFLOW_CONFIG.linear.features?.enableSubtaskCreation ?? true,
        });

        config = {
          ...config,
          linear: {
            ...config.linear,
            features: {
              enableSubtaskCreation,
            },
          },
        };
      }

      // Step 3: Confirm and create
      console.log(chalk.bold('\n📋 Project Summary:\n'));
      console.log(`  ${chalk.bold('Name:')} ${projectInfo.name}`);
      console.log(`  ${chalk.bold('Description:')} ${projectInfo.description}`);
      console.log(`  ${chalk.bold('Repository:')} ${projectInfo.repository}`);
      if (projectInfo.workspacePath) {
        console.log(`  ${chalk.bold('Workspace:')} ${projectInfo.workspacePath}`);
      }
      console.log(`  ${chalk.bold('Linear configured:')} ${configureLinear ? 'Yes' : 'No (defaults)'}`);
      console.log();

      const { confirm } = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: 'Create this project?',
        initial: true,
      });

      if (!confirm) {
        console.log(chalk.yellow('Project creation cancelled.'));
        return;
      }

      // Create project
      const spinner = ora('Creating project...').start();

      const { data: project } = await apiClient.post('/projects', {
        name: projectInfo.name,
        description: projectInfo.description,
        repository: projectInfo.repository,
        workspacePath: projectInfo.workspacePath || undefined,
        config,
      });

      spinner.succeed(chalk.green('✓ Project created successfully!'));

      console.log(chalk.bold('\n📦 Project Details:\n'));
      console.log(`  ${chalk.bold('ID:')} ${chalk.blue(project.id)}`);
      console.log(`  ${chalk.bold('Name:')} ${project.name}`);
      console.log(`  ${chalk.bold('Repository:')} ${project.repository}`);
      console.log();

      console.log(chalk.gray('Next steps:'));
      console.log(chalk.gray('  1. Connect OAuth: devflow oauth:connect ' + project.id));
      console.log(chalk.gray('  2. View project: devflow project:show ' + project.id));
      console.log();
    } catch (error: any) {
      console.error(chalk.red('Failed to create project'));
      console.error(error.response?.data?.message || error.message);
      process.exit(1);
    }
  },

  async show(id: string) {
    const spinner = ora('Fetching project...').start();

    try {
      const { data } = await apiClient.get(`/projects/${id}`);
      spinner.stop();

      console.log(chalk.bold('\n📦 Project Details:\n'));
      console.log(`  ${chalk.bold('ID:')} ${data.id}`);
      console.log(`  ${chalk.bold('Name:')} ${data.name}`);
      console.log(`  ${chalk.bold('Description:')} ${data.description}`);
      console.log(`  ${chalk.bold('Repository:')} ${data.repository}`);
      console.log(`  ${chalk.bold('Created:')} ${new Date(data.createdAt).toLocaleString()}\n`);
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to fetch project'));
      console.error(error.message);
      process.exit(1);
    }
  },
};

