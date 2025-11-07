/**
 * Project Commands
 */

import chalk from 'chalk';
import ora from 'ora';
import { apiClient } from '../utils/api-client';

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
    console.log(chalk.yellow('Use "soma-squad-ai init" to create a project configuration first'));
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

