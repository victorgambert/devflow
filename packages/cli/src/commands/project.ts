/**
 * Project Commands
 */

import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import open from 'open';
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

  /**
   * Helper: Connect OAuth provider (handles both device and auth code flows)
   */
  async _connectOAuth(projectId: string, provider: string): Promise<boolean> {
    const authCodeProviders = ['LINEAR', 'FIGMA', 'SENTRY'];
    const deviceFlowProviders = ['GITHUB', 'GITHUB_ISSUES'];

    const providerLower = provider.toLowerCase().replace('_', '-');
    const endpoint = authCodeProviders.includes(provider)
      ? `/auth/${providerLower}/authorize`
      : `/auth/${providerLower}/device/initiate`;

    try {
      const { data } = await apiClient.post(endpoint, { projectId });

      // Authorization Code Flow
      if (authCodeProviders.includes(provider)) {
        console.log(chalk.cyan(`   Authorization URL: ${data.authorizationUrl}`));
        console.log(chalk.gray('   Opening browser...'));
        await open(data.authorizationUrl);
        console.log(chalk.yellow('   Please authorize in your browser.\n'));
        return true;
      }

      // Device Flow
      if (deviceFlowProviders.includes(provider)) {
        console.log(chalk.cyan(`   User Code: ${chalk.bold(data.userCode)}`));
        console.log(chalk.cyan(`   Verification URL: ${data.verificationUri}`));
        console.log(chalk.gray('   Opening browser...'));
        await open(data.verificationUri);

        const pollSpinner = ora('   Waiting for authorization...').start();

        try {
          await apiClient.post(`/auth/${providerLower}/device/poll`, {
            projectId,
            deviceCode: data.deviceCode,
          });
          pollSpinner.succeed(chalk.green(`   ${provider} connected!`));
          return true;
        } catch (pollError: any) {
          pollSpinner.fail(chalk.red(`   ${provider} authorization failed`));
          return false;
        }
      }
    } catch (error: any) {
      console.log(chalk.red(`   Failed: ${error.response?.data?.message || error.message}`));
      return false;
    }
    return false;
  },

  /**
   * Helper: Check if OAuth is already connected
   */
  async _hasOAuthConnection(projectId: string, provider: string): Promise<boolean> {
    try {
      const { data } = await apiClient.get(`/auth/connections?project=${projectId}`);
      return data.connections?.some((c: any) => c.provider === provider && c.isActive) || false;
    } catch {
      return false;
    }
  },

  async create(options?: { skipOauth?: boolean; skipIntegrations?: boolean }) {
    console.log(chalk.bold('\n📦 Create New Project - Complete Setup Wizard\n'));
    console.log(chalk.gray('This wizard will guide you through the complete setup.\n'));

    try {
      // ============================================
      // Step 1: Project basic info
      // ============================================
      console.log(chalk.bold('📝 Step 1: Project Information\n'));

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
        console.log(chalk.yellow('\nProject creation cancelled.'));
        return;
      }

      // Create project first
      const createSpinner = ora('Creating project...').start();
      const { data: project } = await apiClient.post('/projects', {
        name: projectInfo.name,
        description: projectInfo.description,
        repository: projectInfo.repository,
        workspacePath: projectInfo.workspacePath || undefined,
        config: DEFAULT_WORKFLOW_CONFIG,
      });
      createSpinner.succeed(chalk.green(`Project created: ${chalk.blue(project.id)}`));

      // ============================================
      // Step 2: Required OAuth Connections
      // ============================================
      if (!options?.skipOauth) {
        console.log(chalk.bold('\n🔐 Step 2: Required OAuth Connections\n'));
        console.log(chalk.gray('These integrations are required for DevFlow to work.\n'));

        // GitHub OAuth (required)
        console.log(chalk.bold('🔗 GitHub (required for repository access)'));
        const githubConnected = await this._connectOAuth(project.id, 'GITHUB');
        if (!githubConnected) {
          console.log(chalk.yellow('   Skipped - you can connect later with: devflow oauth:connect'));
        }

        // Linear OAuth (required)
        console.log(chalk.bold('\n🔗 Linear (required for task management)'));
        const linearConnected = await this._connectOAuth(project.id, 'LINEAR');
        if (!linearConnected) {
          console.log(chalk.yellow('   Skipped - you can connect later with: devflow oauth:connect'));
        }

        // ============================================
        // Step 3: Linear Custom Fields Setup
        // ============================================
        if (linearConnected) {
          console.log(chalk.bold('\n📋 Step 3: Linear Custom Fields Setup\n'));
          console.log(chalk.gray('DevFlow uses custom fields to track external context (Figma, Sentry, GitHub Issues).\n'));

          const teamsSpinner = ora('Fetching Linear teams...').start();
          try {
            const { data: teams } = await apiClient.get(`/projects/${project.id}/linear/teams`);
            teamsSpinner.stop();

            if (teams && teams.length > 0) {
              const teamAnswer = await prompts({
                type: 'select',
                name: 'teamId',
                message: 'Select Linear team for custom fields:',
                choices: teams.map((team: any) => ({
                  title: `${team.name} (${team.key})`,
                  value: team.id,
                })),
              });

              if (teamAnswer.teamId) {
                const setupSpinner = ora('Setting up custom fields...').start();
                try {
                  const { data: setupResult } = await apiClient.post(`/projects/${project.id}/linear/setup-custom-fields`, {
                    teamId: teamAnswer.teamId,
                  });
                  setupSpinner.succeed(chalk.green('Linear custom fields configured!'));

                  if (setupResult.created?.length > 0) {
                    console.log(chalk.green(`   Created: ${setupResult.created.join(', ')}`));
                  }
                  if (setupResult.existing?.length > 0) {
                    console.log(chalk.gray(`   Already existed: ${setupResult.existing.join(', ')}`));
                  }
                } catch (setupError: any) {
                  setupSpinner.fail(chalk.yellow('Could not setup custom fields'));
                  console.log(chalk.gray('   You can set them up later with: devflow integrations:setup-linear'));
                }
              }
            }
          } catch {
            teamsSpinner.fail(chalk.yellow('Could not fetch Linear teams'));
          }
        }

        // ============================================
        // Step 4: Optional OAuth Connections
        // ============================================
        console.log(chalk.bold('\n🔌 Step 4: Optional Integrations\n'));
        console.log(chalk.gray('These integrations provide additional context for task refinement.\n'));

        const optionalIntegrations = await prompts([
          {
            type: 'confirm',
            name: 'figma',
            message: 'Connect Figma? (for design context extraction)',
            initial: false,
          },
          {
            type: 'confirm',
            name: 'sentry',
            message: 'Connect Sentry? (for error context extraction)',
            initial: false,
          },
          {
            type: 'confirm',
            name: 'githubIssues',
            message: 'Connect GitHub Issues? (for issue context extraction)',
            initial: false,
          },
        ]);

        if (optionalIntegrations.figma) {
          console.log(chalk.bold('\n📐 Figma OAuth'));
          await this._connectOAuth(project.id, 'FIGMA');
        }

        if (optionalIntegrations.sentry) {
          console.log(chalk.bold('\n🐛 Sentry OAuth'));
          await this._connectOAuth(project.id, 'SENTRY');
        }

        if (optionalIntegrations.githubIssues) {
          console.log(chalk.bold('\n🔗 GitHub Issues OAuth'));
          await this._connectOAuth(project.id, 'GITHUB_ISSUES');
        }
      }

      // ============================================
      // Step 5: Integration Settings
      // ============================================
      if (!options?.skipIntegrations) {
        console.log(chalk.bold('\n⚙️  Step 5: Integration Settings\n'));
        console.log(chalk.gray('Configure default settings for external integrations.\n'));

        const { configureNow } = await prompts({
          type: 'confirm',
          name: 'configureNow',
          message: 'Configure integration settings now?',
          initial: false,
        });

        if (configureNow) {
          const integrationSettings = await prompts([
            {
              type: 'text',
              name: 'figmaFileKey',
              message: 'Default Figma file key (optional):',
            },
            {
              type: 'text',
              name: 'sentryOrgSlug',
              message: 'Sentry organization slug (optional):',
            },
            {
              type: 'text',
              name: 'sentryProjectSlug',
              message: 'Sentry project slug (optional):',
            },
            {
              type: 'text',
              name: 'githubIssuesRepo',
              message: 'GitHub Issues repository (owner/repo, optional):',
            },
          ]);

          // Save non-empty settings
          const settings: any = {};
          if (integrationSettings.figmaFileKey) settings.figmaFileKey = integrationSettings.figmaFileKey;
          if (integrationSettings.sentryOrgSlug) settings.sentryOrgSlug = integrationSettings.sentryOrgSlug;
          if (integrationSettings.sentryProjectSlug) settings.sentryProjectSlug = integrationSettings.sentryProjectSlug;
          if (integrationSettings.githubIssuesRepo) settings.githubIssuesRepo = integrationSettings.githubIssuesRepo;

          if (Object.keys(settings).length > 0) {
            await apiClient.put(`/projects/${project.id}/integrations`, settings);
            console.log(chalk.green('   Integration settings saved!'));
          }
        }
      }

      // ============================================
      // Step 6: Linear Workflow Configuration
      // ============================================
      console.log(chalk.bold('\n📊 Step 6: Linear Workflow Configuration\n'));

      const { customizeWorkflow } = await prompts({
        type: 'confirm',
        name: 'customizeWorkflow',
        message: 'Customize Linear workflow statuses? (default Three-Phase Agile)',
        initial: false,
      });

      let config = { ...DEFAULT_WORKFLOW_CONFIG };

      if (customizeWorkflow) {
        console.log(chalk.gray('\nConfiguring Three-Phase Agile statuses...\n'));

        // Phase 1: Refinement
        console.log(chalk.bold('Phase 1: Refinement'));
        const refinementStatuses = await prompts([
          {
            type: 'text',
            name: 'toRefinement',
            message: '  Trigger status:',
            initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.toRefinement,
          },
          {
            type: 'text',
            name: 'refinementReady',
            message: '  Ready status:',
            initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.refinementReady,
          },
        ]);

        // Phase 2: User Story
        console.log(chalk.bold('\nPhase 2: User Story'));
        const userStoryStatuses = await prompts([
          {
            type: 'text',
            name: 'userStoryReady',
            message: '  Ready status:',
            initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.userStoryReady,
          },
        ]);

        // Phase 3: Technical Plan
        console.log(chalk.bold('\nPhase 3: Technical Plan'));
        const planStatuses = await prompts([
          {
            type: 'text',
            name: 'planReady',
            message: '  Ready status:',
            initial: DEFAULT_WORKFLOW_CONFIG.linear.statuses.planReady,
          },
        ]);

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

      // Features
      const { enableSubtaskCreation } = await prompts({
        type: 'confirm',
        name: 'enableSubtaskCreation',
        message: 'Enable automatic subtask creation for L/XL tasks?',
        initial: true,
      });

      config.linear.features = { enableSubtaskCreation };

      // Update project config
      await apiClient.put(`/projects/${project.id}`, { config });

      // ============================================
      // Final Summary
      // ============================================
      console.log('\n' + '='.repeat(50));
      console.log(chalk.bold.green('\n✅ Project Setup Complete!\n'));

      console.log(chalk.bold('📦 Project Details:'));
      console.log(`   ID: ${chalk.blue(project.id)}`);
      console.log(`   Name: ${project.name}`);
      console.log(`   Repository: ${project.repository}`);

      console.log(chalk.bold('\n💡 Next Steps:'));
      console.log(chalk.gray('   1. Create a Linear issue with status "To Refinement"'));
      console.log(chalk.gray('   2. Fill in Figma URL / Sentry URL / GitHub Issue URL custom fields (optional)'));
      console.log(chalk.gray(`   3. Run: devflow workflow:start --project ${project.id}`));

      console.log(chalk.bold('\n📚 Useful Commands:'));
      console.log(chalk.gray(`   devflow project:show ${project.id}`));
      console.log(chalk.gray(`   devflow integrations:show ${project.id}`));
      console.log(chalk.gray(`   devflow oauth:status ${project.id}`));
      console.log();
    } catch (error: any) {
      console.error(chalk.red('\nFailed to create project'));
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

