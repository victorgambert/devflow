#!/usr/bin/env node

/**
 * DevFlow CLI Entry Point
 */

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { projectCommands } from './commands/project';
import { workflowCommands } from './commands/workflow';
import { configCommands } from './commands/config';

const program = new Command();

program
  .name('devflow')
  .description('DevFlow - Universal DevOps Orchestrator')
  .version('1.0.0');

// Init command
program
  .command('init')
  .description('Initialize DevFlow in current directory')
  .action(initCommand);

// Project commands
program
  .command('project:list')
  .description('List all projects')
  .action(projectCommands.list);

program
  .command('project:create')
  .description('Create a new project')
  .action(projectCommands.create);

program
  .command('project:show <id>')
  .description('Show project details')
  .action(projectCommands.show);

// Workflow commands
program
  .command('workflow:start')
  .description('Start a workflow for a task')
  .option('-t, --task <id>', 'Task ID')
  .option('-p, --project <id>', 'Project ID')
  .action(workflowCommands.start);

program
  .command('workflow:status <id>')
  .description('Get workflow status')
  .action(workflowCommands.status);

program
  .command('workflow:cancel <id>')
  .description('Cancel a workflow')
  .action(workflowCommands.cancel);

// Config commands
program
  .command('config:validate')
  .description('Validate .devflow.yml configuration')
  .action(configCommands.validate);

program
  .command('config:show')
  .description('Show current configuration')
  .action(configCommands.show);

program.parse();

