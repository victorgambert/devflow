/**
 * Linear Configuration Commands
 *
 * Configure Linear workflow statuses and features for a project
 */

import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { apiClient } from '../utils/api-client';

interface LinearConfigOptions {
  projectId?: string;
  interactive?: boolean;
}

/**
 * Default Linear statuses for Three-Phase Agile Workflow
 */
const DEFAULT_LINEAR_STATUSES = {
  // Generic statuses
  inReview: 'In Review',
  done: 'Done',
  blocked: 'Blocked',

  // Backlog
  backlog: 'Backlog',

  // Phase 1: Refinement
  toRefinement: 'To Refinement',
  refinementInProgress: 'Refinement In Progress',
  refinementReady: 'Refinement Ready',
  refinementFailed: 'Refinement Failed',

  // Phase 2: User Story
  toUserStory: 'Refinement Ready',
  userStoryInProgress: 'UserStory In Progress',
  userStoryReady: 'UserStory Ready',
  userStoryFailed: 'UserStory Failed',

  // Phase 3: Technical Plan
  toPlan: 'UserStory Ready',
  planInProgress: 'Plan In Progress',
  planReady: 'Plan Ready',
  planFailed: 'Plan Failed',
};

const DEFAULT_LINEAR_FEATURES = {
  enableSubtaskCreation: true,
};

export const linearConfigCommands = {
  /**
   * Configure Linear statuses and features interactively
   */
  async configure(options: LinearConfigOptions = {}) {
    console.log(chalk.bold('\n🔧 Linear Configuration\n'));

    try {
      // Step 1: Get project ID
      let projectId = options.projectId;

      if (!projectId) {
        const { data: projects } = await apiClient.get('/projects');

        if (projects.length === 0) {
          console.log(chalk.red('No projects found. Create a project first.'));
          process.exit(1);
        }

        const response = await prompts({
          type: 'select',
          name: 'selectedProject',
          message: 'Select a project:',
          choices: projects.map((p: any) => ({
            title: `${p.name} (${p.id})`,
            value: p.id,
          })),
        });

        projectId = response.selectedProject;
      }

      // Step 2: Fetch current project config
      const spinner = ora('Fetching project configuration...').start();
      const { data: project } = await apiClient.get(`/projects/${projectId}`);
      spinner.succeed();

      const currentConfig = project.config || {};
      const currentLinearConfig = currentConfig.linear || {};
      const currentStatuses = currentLinearConfig.statuses || {};
      const currentFeatures = currentLinearConfig.features || {};

      // Step 3: Configure statuses
      console.log(chalk.cyan('\n📊 Configure Linear Statuses\n'));

      const response1 = await prompts({
        type: 'confirm',
        name: 'configureStatuses',
        message: 'Configure Linear statuses?',
        initial: true,
      });

      const configureStatuses = response1.configureStatuses;

      let statuses = { ...DEFAULT_LINEAR_STATUSES, ...currentStatuses };

      if (configureStatuses) {
        const statusCategories = [
          {
            name: 'Generic Statuses',
            statuses: ['inReview', 'done', 'blocked', 'backlog'],
          },
          {
            name: 'Phase 1: Refinement',
            statuses: ['toRefinement', 'refinementInProgress', 'refinementReady', 'refinementFailed'],
          },
          {
            name: 'Phase 2: User Story',
            statuses: ['toUserStory', 'userStoryInProgress', 'userStoryReady', 'userStoryFailed'],
          },
          {
            name: 'Phase 3: Technical Plan',
            statuses: ['toPlan', 'planInProgress', 'planReady', 'planFailed'],
          },
        ];

        for (const category of statusCategories) {
          console.log(chalk.bold(`\n${category.name}:`));

          for (const statusKey of category.statuses) {
            const response = await prompts({
              type: 'text',
              name: 'value',
              message: `  ${statusKey}:`,
              initial: statuses[statusKey as keyof typeof statuses] || DEFAULT_LINEAR_STATUSES[statusKey as keyof typeof DEFAULT_LINEAR_STATUSES],
            });
            statuses = { ...statuses, [statusKey]: response.value };
          }
        }
      }

      // Step 4: Configure features
      console.log(chalk.cyan('\n⚙️  Configure Features\n'));

      const response2 = await prompts({
        type: 'confirm',
        name: 'enableSubtaskCreation',
        message: 'Enable automatic subtask creation in refinement (L/XL complexity)?',
        initial: currentFeatures.enableSubtaskCreation ?? DEFAULT_LINEAR_FEATURES.enableSubtaskCreation,
      });

      const enableSubtaskCreation = response2.enableSubtaskCreation;

      const features = {
        enableSubtaskCreation,
      };

      // Step 5: Build new config
      const newLinearConfig = {
        statuses,
        features,
      };

      const newConfig = {
        ...currentConfig,
        linear: newLinearConfig,
      };

      // Step 6: Preview changes
      console.log(chalk.bold('\n📋 Configuration Preview:\n'));
      console.log(chalk.gray(JSON.stringify(newLinearConfig, null, 2)));
      console.log();

      const response3 = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: 'Apply this configuration?',
        initial: true,
      });

      const confirm = response3.confirm;

      if (!confirm) {
        console.log(chalk.yellow('Configuration cancelled.'));
        return;
      }

      // Step 7: Update project
      const updateSpinner = ora('Updating project configuration...').start();

      await apiClient.put(`/projects/${projectId}`, {
        config: newConfig,
      });

      updateSpinner.succeed(chalk.green('✓ Configuration updated successfully!'));

      console.log(chalk.gray('\nYou can now use these statuses in your Linear workspace.\n'));
    } catch (error: any) {
      console.error(chalk.red('Failed to configure Linear'));
      console.error(error.response?.data?.message || error.message);
      process.exit(1);
    }
  },

  /**
   * Show current Linear configuration
   */
  async show(projectId?: string) {
    try {
      if (!projectId) {
        const { data: projects } = await apiClient.get('/projects');

        if (projects.length === 0) {
          console.log(chalk.red('No projects found. Create a project first.'));
          process.exit(1);
        }

        const response = await prompts({
          type: 'select',
          name: 'selectedProject',
          message: 'Select a project:',
          choices: projects.map((p: any) => ({
            title: `${p.name} (${p.id})`,
            value: p.id,
          })),
        });

        projectId = response.selectedProject;
      }

      const spinner = ora('Fetching Linear configuration...').start();
      const { data: project } = await apiClient.get(`/projects/${projectId}`);
      spinner.stop();

      const linearConfig = project.config?.linear;

      if (!linearConfig) {
        console.log(chalk.yellow('\nNo Linear configuration found for this project.'));
        console.log(chalk.gray('Run "devflow config:linear" to configure.\n'));
        return;
      }

      console.log(chalk.bold(`\n🔧 Linear Configuration (${project.name}):\n`));
      console.log(chalk.cyan('Statuses:'));
      console.log(chalk.gray(JSON.stringify(linearConfig.statuses, null, 2)));
      console.log();
      console.log(chalk.cyan('Features:'));
      console.log(chalk.gray(JSON.stringify(linearConfig.features, null, 2)));
      console.log();
    } catch (error: any) {
      console.error(chalk.red('Failed to fetch Linear configuration'));
      console.error(error.response?.data?.message || error.message);
      process.exit(1);
    }
  },

  /**
   * Reset Linear configuration to defaults
   */
  async reset(projectId?: string) {
    try {
      if (!projectId) {
        const { data: projects } = await apiClient.get('/projects');

        if (projects.length === 0) {
          console.log(chalk.red('No projects found. Create a project first.'));
          process.exit(1);
        }

        const response = await prompts({
          type: 'select',
          name: 'selectedProject',
          message: 'Select a project:',
          choices: projects.map((p: any) => ({
            title: `${p.name} (${p.id})`,
            value: p.id,
          })),
        });

        projectId = response.selectedProject;
      }

      const response2 = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow('Reset Linear configuration to defaults?'),
        initial: false,
      });

      const confirm = response2.confirm;

      if (!confirm) {
        console.log(chalk.yellow('Reset cancelled.'));
        return;
      }

      const spinner = ora('Resetting Linear configuration...').start();

      const { data: project } = await apiClient.get(`/projects/${projectId}`);
      const currentConfig = project.config || {};

      const newConfig = {
        ...currentConfig,
        linear: {
          statuses: DEFAULT_LINEAR_STATUSES,
          features: DEFAULT_LINEAR_FEATURES,
        },
      };

      await apiClient.put(`/projects/${projectId}`, {
        config: newConfig,
      });

      spinner.succeed(chalk.green('✓ Linear configuration reset to defaults!'));
      console.log();
    } catch (error: any) {
      console.error(chalk.red('Failed to reset Linear configuration'));
      console.error(error.response?.data?.message || error.message);
      process.exit(1);
    }
  },
};
