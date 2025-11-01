/**
 * Config Commands
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { ProjectAdapter } from '@devflow/sdk';
import { DEVFLOW_CONFIG_FILE } from '@devflow/common';

export const configCommands = {
  async validate() {
    const spinner = ora('Validating configuration...').start();

    try {
      const adapter = new ProjectAdapter(process.cwd());
      await adapter.loadConfig();
      
      spinner.succeed(chalk.green('✓ Configuration is valid'));
      
      const config = adapter.getConfig();
      console.log(chalk.bold('\n📋 Configuration Summary:\n'));
      console.log(`  ${chalk.bold('Project:')} ${config.project.name}`);
      console.log(`  ${chalk.bold('Language:')} ${config.project.language}`);
      console.log(`  ${chalk.bold('VCS:')} ${config.vcs.provider}`);
      console.log(`  ${chalk.bold('CI:')} ${config.ci.provider}`);
      console.log(`  ${chalk.bold('Code Agent:')} ${config.code_agent.provider}\n`);
    } catch (error: any) {
      spinner.fail(chalk.red('✗ Configuration is invalid'));
      console.error(error.message);
      process.exit(1);
    }
  },

  async show() {
    const configPath = path.join(process.cwd(), DEVFLOW_CONFIG_FILE);

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      console.log(chalk.bold(`\n📄 ${DEVFLOW_CONFIG_FILE}:\n`));
      console.log(content);
    } catch (error: any) {
      console.error(chalk.red(`Failed to read ${DEVFLOW_CONFIG_FILE}`));
      console.error(error.message);
      process.exit(1);
    }
  },
};

