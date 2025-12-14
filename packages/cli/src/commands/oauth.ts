/**
 * OAuth Commands
 * Manage OAuth applications and connections
 */

import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import open from 'open';
import { apiClient } from '../utils/api-client';

export const oauthCommands = {
  /**
   * Register OAuth application interactively
   */
  async register() {
    console.log(chalk.bold('\n🔐 Register OAuth Application\n'));

    const answers = await prompts([
      {
        type: 'text',
        name: 'projectId',
        message: 'Project ID:',
        validate: (value) => (value ? true : 'Project ID is required'),
      },
      {
        type: 'select',
        name: 'provider',
        message: 'OAuth Provider:',
        choices: [
          { title: 'Linear (Authorization Code Flow)', value: 'LINEAR' },
          { title: 'GitHub (Device Flow)', value: 'GITHUB' },
          { title: 'Figma (Authorization Code Flow)', value: 'FIGMA' },
          { title: 'Sentry (Authorization Code Flow)', value: 'SENTRY' },
          { title: 'GitHub Issues (Device Flow)', value: 'GITHUB_ISSUES' },
        ],
      },
      {
        type: 'text',
        name: 'clientId',
        message: 'Client ID:',
        validate: (value) => (value ? true : 'Client ID is required'),
      },
      {
        type: 'password',
        name: 'clientSecret',
        message: 'Client Secret:',
        validate: (value) => (value ? true : 'Client Secret is required'),
      },
      {
        type: 'text',
        name: 'redirectUri',
        message: 'Redirect URI:',
        initial: (_prev: any, values: any) => {
          const defaults: Record<string, string> = {
            LINEAR: 'http://localhost:3000/api/v1/auth/linear/callback',
            FIGMA: 'http://localhost:3000/api/v1/auth/figma/callback',
            SENTRY: 'http://localhost:3000/api/v1/auth/sentry/callback',
            GITHUB: '',
            GITHUB_ISSUES: '',
          };
          return defaults[values.provider] || '';
        },
        validate: (value) => (value ? true : 'Redirect URI is required'),
      },
      {
        type: 'list',
        name: 'scopes',
        message: 'Scopes (comma-separated):',
        initial: (_prev: any, values: any) => {
          const defaults: Record<string, string> = {
            LINEAR: 'read,write,issues:create,comments:create',
            GITHUB: 'repo,workflow,admin:repo_hook',
            FIGMA: 'file_read',
            SENTRY: 'project:read,event:read',
            GITHUB_ISSUES: 'repo,read:user',
          };
          return defaults[values.provider] || '';
        },
        separator: ',',
      },
      {
        type: 'select',
        name: 'flowType',
        message: 'OAuth Flow Type:',
        choices: [
          { title: 'Authorization Code Flow', value: 'authorization_code' },
          { title: 'Device Flow', value: 'device' },
        ],
        initial: (_prev: any, values: any) => {
          const deviceFlowProviders = ['GITHUB', 'GITHUB_ISSUES'];
          return deviceFlowProviders.includes(values.provider) ? 1 : 0;
        },
      },
      {
        type: 'text',
        name: 'name',
        message: 'Application Name (optional):',
      },
      {
        type: 'text',
        name: 'description',
        message: 'Description (optional):',
      },
    ]);

    if (!answers.projectId) {
      console.log(chalk.gray('\nCancelled'));
      return;
    }

    const spinner = ora('Registering OAuth application...').start();

    try {
      const { data } = await apiClient.post('/auth/apps/register', {
        projectId: answers.projectId,
        provider: answers.provider,
        clientId: answers.clientId,
        clientSecret: answers.clientSecret,
        redirectUri: answers.redirectUri,
        scopes: answers.scopes,
        flowType: answers.flowType,
        name: answers.name || undefined,
        description: answers.description || undefined,
      });

      spinner.succeed(chalk.green('OAuth application registered successfully!'));

      console.log(chalk.bold('\n📋 Application Details:\n'));
      console.log(`  ${chalk.bold('ID:')} ${data.app.id}`);
      console.log(`  ${chalk.bold('Provider:')} ${data.app.provider}`);
      console.log(`  ${chalk.bold('Client ID:')} ${data.app.clientId}`);
      console.log(`  ${chalk.bold('Redirect URI:')} ${data.app.redirectUri}`);
      console.log(`  ${chalk.bold('Flow Type:')} ${data.app.flowType}`);
      console.log(`  ${chalk.bold('Scopes:')} ${data.app.scopes.join(', ')}`);

      if (data.app.name) {
        console.log(`  ${chalk.bold('Name:')} ${data.app.name}`);
      }

      console.log(
        chalk.gray(`\n  Created: ${new Date(data.app.createdAt).toLocaleString()}\n`),
      );

      // Ask if user wants to connect now
      const { connectNow } = await prompts({
        type: 'confirm',
        name: 'connectNow',
        message: 'Would you like to connect this OAuth app now?',
        initial: true,
      });

      if (connectNow) {
        await this.connect(answers.projectId, answers.provider);
      }
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to register OAuth application'));
      console.error(
        chalk.red(
          `\n${error.response?.data?.message || error.message}\n`,
        ),
      );
      process.exit(1);
    }
  },

  /**
   * List OAuth applications for a project
   */
  async list(projectId?: string) {
    if (!projectId) {
      const answer = await prompts({
        type: 'text',
        name: 'projectId',
        message: 'Project ID:',
        validate: (value) => (value ? true : 'Project ID is required'),
      });

      if (!answer.projectId) {
        console.log(chalk.gray('\nCancelled'));
        return;
      }

      projectId = answer.projectId;
    }

    const spinner = ora('Fetching OAuth applications...').start();

    try {
      const { data } = await apiClient.get(`/auth/apps?project=${projectId}`);
      spinner.stop();

      if (data.apps.length === 0) {
        console.log(chalk.gray('\nNo OAuth applications found'));
        console.log(
          chalk.gray('Use "devflow oauth:register" to register one\n'),
        );
        return;
      }

      console.log(chalk.bold('\n🔐 OAuth Applications:\n'));

      data.apps.forEach((app: any) => {
        const statusIcon = app.isActive ? '✅' : '❌';
        console.log(`  ${statusIcon} ${chalk.bold(app.provider)}`);

        if (app.name) {
          console.log(`     ${chalk.cyan(app.name)}`);
        }

        console.log(`     ${chalk.gray('Client ID:')} ${app.clientId}`);
        console.log(`     ${chalk.gray('Flow Type:')} ${app.flowType}`);
        console.log(`     ${chalk.gray('Scopes:')} ${app.scopes.join(', ')}`);
        console.log(
          `     ${chalk.gray('Created:')} ${new Date(app.createdAt).toLocaleString()}\n`,
        );
      });
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to fetch OAuth applications'));
      console.error(error.message);
      process.exit(1);
    }
  },

  /**
   * Connect OAuth application (initiate OAuth flow)
   */
  async connect(projectId?: string, provider?: string) {
    if (!projectId || !provider) {
      const answers = await prompts([
        {
          type: !projectId ? 'text' : null,
          name: 'projectId',
          message: 'Project ID:',
          validate: (value: string) =>
            value ? true : 'Project ID is required',
        },
        {
          type: !provider ? 'select' : null,
          name: 'provider',
          message: 'OAuth Provider:',
          choices: [
            { title: 'Linear (required)', value: 'LINEAR' },
            { title: 'GitHub (required)', value: 'GITHUB' },
            { title: 'Figma (optional - for design context)', value: 'FIGMA' },
            { title: 'Sentry (optional - for error context)', value: 'SENTRY' },
            { title: 'GitHub Issues (optional - for issue context)', value: 'GITHUB_ISSUES' },
          ],
        },
      ]);

      projectId = projectId || answers.projectId;
      provider = provider || answers.provider;

      if (!projectId || !provider) {
        console.log(chalk.gray('\nCancelled'));
        return;
      }
    }

    // Normalize provider to uppercase
    provider = provider.toUpperCase();

    const spinner = ora('Initiating OAuth connection...').start();

    try {
      // Determine endpoint based on provider
      const authCodeProviders = ['LINEAR', 'FIGMA', 'SENTRY'];
      const deviceFlowProviders = ['GITHUB', 'GITHUB_ISSUES'];

      const providerLower = provider.toLowerCase().replace('_', '-');
      const endpoint = authCodeProviders.includes(provider)
        ? `/auth/${providerLower}/authorize`
        : `/auth/${providerLower}/device/initiate`;

      const { data } = await apiClient.post(endpoint, { projectId });

      spinner.stop();

      // Authorization Code Flow (Linear, Figma, Sentry)
      if (authCodeProviders.includes(provider)) {
        console.log(chalk.bold(`\n🔗 ${provider} Authorization:\n`));
        console.log(chalk.cyan(`  ${data.authorizationUrl}\n`));
        console.log(chalk.gray('Opening browser...\n'));

        // Open browser
        await open(data.authorizationUrl);

        console.log(
          chalk.yellow(
            `Please authorize DevFlow in your browser to complete the ${provider} connection.\n`,
          ),
        );
      }
      // Device Flow (GitHub, GitHub Issues)
      else if (deviceFlowProviders.includes(provider)) {
        const displayName = provider === 'GITHUB_ISSUES' ? 'GitHub Issues' : 'GitHub';
        console.log(chalk.bold(`\n🔗 ${displayName} Device Flow:\n`));
        console.log(`  ${chalk.bold('User Code:')} ${chalk.cyan(data.userCode)}`);
        console.log(
          `  ${chalk.bold('Verification URL:')} ${chalk.cyan(data.verificationUri)}\n`,
        );
        console.log(chalk.gray('Opening browser...\n'));

        // Open browser
        await open(data.verificationUri);

        console.log(
          chalk.yellow(
            `Enter code ${chalk.bold(data.userCode)} in your browser to authorize.\n`,
          ),
        );

        // Poll for tokens
        const pollSpinner = ora('Waiting for authorization...').start();

        try {
          const pollResponse = await apiClient.post(
            `/auth/${providerLower}/device/poll`,
            {
              projectId,
              deviceCode: data.deviceCode,
            },
          );

          pollSpinner.succeed(
            chalk.green(`${displayName} OAuth connection established!`),
          );

          console.log(chalk.bold('\n✅ Connection Details:\n'));
          console.log(`  ${chalk.bold('Provider:')} ${pollResponse.data.provider}`);
          console.log(
            `  ${chalk.bold('User:')} ${pollResponse.data.providerEmail || pollResponse.data.providerUserId}`,
          );
          console.log(
            `  ${chalk.bold('Scopes:')} ${pollResponse.data.scopes.join(', ')}\n`,
          );
        } catch (pollError: any) {
          pollSpinner.fail(chalk.red('Authorization failed'));
          console.error(chalk.red(`\n${pollError.message}\n`));
          process.exit(1);
        }
      }
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to initiate OAuth connection'));
      console.error(
        chalk.red(
          `\n${error.response?.data?.message || error.message}\n`,
        ),
      );
      process.exit(1);
    }
  },

  /**
   * Check OAuth connection status
   */
  async status(projectId?: string) {
    if (!projectId) {
      const answer = await prompts({
        type: 'text',
        name: 'projectId',
        message: 'Project ID:',
        validate: (value) => (value ? true : 'Project ID is required'),
      });

      if (!answer.projectId) {
        console.log(chalk.gray('\nCancelled'));
        return;
      }

      projectId = answer.projectId;
    }

    const spinner = ora('Fetching OAuth connections...').start();

    try {
      const { data } = await apiClient.get(
        `/auth/connections?project=${projectId}`,
      );
      spinner.stop();

      if (data.connections.length === 0) {
        console.log(chalk.gray('\nNo OAuth connections found'));
        console.log(
          chalk.gray('Use "devflow oauth:connect" to establish a connection\n'),
        );
        return;
      }

      console.log(chalk.bold('\n🔗 OAuth Connections:\n'));

      data.connections.forEach((conn: any) => {
        const statusIcon = conn.isActive ? '✅' : '❌';
        const refreshStatus = conn.refreshFailed ? '⚠️  Failed' : '✓ OK';

        console.log(`  ${statusIcon} ${chalk.bold(conn.provider)}`);
        console.log(
          `     ${chalk.gray('User:')} ${conn.providerEmail || conn.providerUserId}`,
        );
        console.log(`     ${chalk.gray('Scopes:')} ${conn.scopes.join(', ')}`);
        console.log(`     ${chalk.gray('Refresh Status:')} ${refreshStatus}`);

        if (conn.lastRefreshed) {
          console.log(
            `     ${chalk.gray('Last Refreshed:')} ${new Date(conn.lastRefreshed).toLocaleString()}`,
          );
        }

        if (conn.refreshFailed && conn.failureReason) {
          console.log(
            `     ${chalk.red('Error:')} ${conn.failureReason}`,
          );
        }

        console.log(
          `     ${chalk.gray('Created:')} ${new Date(conn.createdAt).toLocaleString()}\n`,
        );
      });
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to fetch OAuth connections'));
      console.error(error.message);
      process.exit(1);
    }
  },

  /**
   * Delete OAuth application
   */
  async delete(projectId?: string, provider?: string) {
    if (!projectId || !provider) {
      const answers = await prompts([
        {
          type: !projectId ? 'text' : null,
          name: 'projectId',
          message: 'Project ID:',
          validate: (value: string) =>
            value ? true : 'Project ID is required',
        },
        {
          type: !provider ? 'select' : null,
          name: 'provider',
          message: 'OAuth Provider to delete:',
          choices: [
            { title: 'Linear', value: 'LINEAR' },
            { title: 'GitHub', value: 'GITHUB' },
            { title: 'Figma', value: 'FIGMA' },
            { title: 'Sentry', value: 'SENTRY' },
            { title: 'GitHub Issues', value: 'GITHUB_ISSUES' },
          ],
        },
      ]);

      projectId = projectId || answers.projectId;
      provider = provider || answers.provider;

      if (!projectId || !provider) {
        console.log(chalk.gray('\nCancelled'));
        return;
      }
    }

    // Confirm deletion
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete the ${provider} OAuth app for project ${projectId}? This will also revoke all active connections.`,
      initial: false,
    });

    if (!confirm) {
      console.log(chalk.gray('\nCancelled'));
      return;
    }

    const spinner = ora('Deleting OAuth application...').start();

    try {
      await apiClient.post(`/auth/apps/${provider.toLowerCase()}/delete`, {
        projectId,
      });

      spinner.succeed(
        chalk.green('OAuth application deleted successfully!'),
      );
      console.log(
        chalk.gray('All associated connections have been revoked.\n'),
      );
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to delete OAuth application'));
      console.error(
        chalk.red(
          `\n${error.response?.data?.message || error.message}\n`,
        ),
      );
      process.exit(1);
    }
  },
};
