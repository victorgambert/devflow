#!/usr/bin/env node

/**
 * DevFlow CLI Entry Point
 */

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { projectCommands } from './commands/project';
import { workflowCommands } from './commands/workflow';
import { configCommands } from './commands/config';
import { oauthCommands } from './commands/oauth';
import { linearConfigCommands } from './commands/linear-config';
import { integrationsCommands } from './commands/integrations';

const program = new Command();

program
  .name('devflow')
  .description('DevFlow - Universal DevOps Orchestrator')
  .version('1.0.0');

// Init command
program
  .command('init')
  .description('Initialize DevFlow in current directory')
  .option('-m, --monorepo', 'Initialize for monorepo project')
  .option('-s, --stack <stack>', 'Technology stack (node, php, python, go, rust)')
  .option('--dry-run', 'Show what would be created without creating')
  .option('-f, --force', 'Overwrite existing .devflow.yml')
  .action((options) =>
    initCommand({
      monorepo: options.monorepo,
      stack: options.stack,
      dryRun: options.dryRun,
      force: options.force,
    }),
  );

// Project commands
program
  .command('project:list')
  .description('List all projects')
  .action(projectCommands.list);

program
  .command('project:create')
  .description('Create a new project with complete setup wizard')
  .option('--skip-oauth', 'Skip OAuth configuration')
  .option('--skip-integrations', 'Skip integration configuration')
  .action((options) =>
    projectCommands.create({
      skipOauth: options.skipOauth,
      skipIntegrations: options.skipIntegrations,
    }),
  );

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

// Linear Config commands
program
  .command('config:linear')
  .description('Configure Linear workflow statuses and features')
  .option('-p, --project <id>', 'Project ID')
  .action((options) => linearConfigCommands.configure(options));

program
  .command('config:linear:show [projectId]')
  .description('Show Linear configuration for a project')
  .action((projectId) => linearConfigCommands.show(projectId));

program
  .command('config:linear:reset [projectId]')
  .description('Reset Linear configuration to defaults')
  .action((projectId) => linearConfigCommands.reset(projectId));

// OAuth commands
program
  .command('oauth:register')
  .description('Register OAuth application for a project')
  .action(oauthCommands.register);

program
  .command('oauth:list [projectId]')
  .description('List OAuth applications for a project')
  .action(oauthCommands.list);

program
  .command('oauth:connect [projectId] [provider]')
  .description('Connect OAuth application (initiate OAuth flow)')
  .action(oauthCommands.connect);

program
  .command('oauth:status [projectId]')
  .description('Check OAuth connection status')
  .action(oauthCommands.status);

program
  .command('oauth:delete [projectId] [provider]')
  .description('Delete OAuth application and revoke connections')
  .action(oauthCommands.delete);

// Integrations commands
program
  .command('integrations:show [projectId]')
  .description('Show integration configuration for a project')
  .action(integrationsCommands.show);

program
  .command('integrations:configure [projectId]')
  .description('Configure external integrations (Figma, Sentry, GitHub Issues)')
  .option('--figma-file <key>', 'Figma file key')
  .option('--figma-node <id>', 'Figma node ID')
  .option('--sentry-org <slug>', 'Sentry organization slug')
  .option('--sentry-project <slug>', 'Sentry project slug')
  .option('--github-issues <repo>', 'GitHub Issues repository (owner/repo)')
  .action((projectId, options) =>
    integrationsCommands.configure(projectId, {
      figmaFile: options.figmaFile,
      figmaNode: options.figmaNode,
      sentryOrg: options.sentryOrg,
      sentryProject: options.sentryProject,
      githubIssues: options.githubIssues,
    }),
  );

program
  .command('integrations:setup-linear [projectId]')
  .description('Setup Linear Custom Fields (Figma URL, Sentry URL, GitHub Issue URL)')
  .option('-t, --team <id>', 'Linear team ID')
  .action((projectId, options) =>
    integrationsCommands.setupLinear(projectId, options.team),
  );

program
  .command('integrations:test [projectId]')
  .description('Test integration connections and context extraction')
  .option('-p, --provider <provider>', 'Test specific provider (github, linear, figma, sentry)')
  .action((projectId, options) =>
    integrationsCommands.test(projectId, options.provider),
  );

program.parse();

