/**
 * Workflow Commands
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { apiClient } from '../utils/api-client';

export const workflowCommands = {
  async start(options: any) {
    let { task, project } = options;

    // Prompt for missing options
    if (!task || !project) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'task',
          message: 'Task ID:',
          when: !task,
        },
        {
          type: 'input',
          name: 'project',
          message: 'Project ID:',
          when: !project,
        },
      ]);
      task = task || answers.task;
      project = project || answers.project;
    }

    const spinner = ora('Starting workflow...').start();

    try {
      const { data } = await apiClient.post('/workflows/start', {
        taskId: task,
        projectId: project,
      });

      spinner.succeed(chalk.green('✓ Workflow started'));
      console.log(chalk.bold('\n🚀 Workflow Details:\n'));
      console.log(`  ${chalk.bold('Workflow ID:')} ${data.workflowId}`);
      console.log(`  ${chalk.bold('Run ID:')} ${data.runId}\n`);
      console.log(chalk.gray(`Monitor progress: devflow workflow:status ${data.workflowId}\n`));
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to start workflow'));
      console.error(error.response?.data?.message || error.message);
      process.exit(1);
    }
  },

  async status(id: string) {
    const spinner = ora('Fetching workflow status...').start();

    try {
      const { data } = await apiClient.get(`/workflows/${id}`);
      spinner.stop();

      console.log(chalk.bold('\n📊 Workflow Status:\n'));
      console.log(`  ${chalk.bold('Workflow ID:')} ${data.workflowId}`);
      console.log(`  ${chalk.bold('Status:')} ${data.status}`);
      console.log(`  ${chalk.bold('Started:')} ${new Date(data.startTime).toLocaleString()}`);
      if (data.closeTime) {
        console.log(`  ${chalk.bold('Completed:')} ${new Date(data.closeTime).toLocaleString()}`);
      }
      console.log();
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to fetch workflow status'));
      console.error(error.response?.data?.message || error.message);
      process.exit(1);
    }
  },

  async cancel(id: string) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to cancel workflow ${id}?`,
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.gray('Cancelled'));
      return;
    }

    const spinner = ora('Cancelling workflow...').start();

    try {
      await apiClient.post(`/workflows/${id}/cancel`);
      spinner.succeed(chalk.green('✓ Workflow cancelled'));
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to cancel workflow'));
      console.error(error.response?.data?.message || error.message);
      process.exit(1);
    }
  },
};

