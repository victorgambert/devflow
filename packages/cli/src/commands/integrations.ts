/**
 * Integrations Commands
 * Configure external integrations (Figma, Sentry, GitHub Issues)
 */

import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { apiClient } from '../utils/api-client';

export const integrationsCommands = {
  /**
   * Show current integration configuration for a project
   */
  async show(projectId?: string) {
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

    const spinner = ora('Fetching integration configuration...').start();

    try {
      const { data } = await apiClient.get(`/projects/${projectId}/integrations`);
      spinner.stop();

      console.log(chalk.bold('\n⚙️  Integration Configuration\n'));

      // Figma
      console.log(chalk.bold('📐 Figma'));
      if (data.figmaFileKey) {
        console.log(`   File Key: ${chalk.cyan(data.figmaFileKey)}`);
        if (data.figmaNodeId) {
          console.log(`   Node ID: ${chalk.cyan(data.figmaNodeId)}`);
        }
        console.log(`   ${chalk.green('✓ Configured')}`);
      } else {
        console.log(`   ${chalk.gray('Not configured')}`);
      }

      // Sentry
      console.log(chalk.bold('\n🐛 Sentry'));
      if (data.sentryOrgSlug && data.sentryProjectSlug) {
        console.log(`   Organization: ${chalk.cyan(data.sentryOrgSlug)}`);
        console.log(`   Project: ${chalk.cyan(data.sentryProjectSlug)}`);
        console.log(`   ${chalk.green('✓ Configured')}`);
      } else {
        console.log(`   ${chalk.gray('Not configured')}`);
      }

      // GitHub Issues
      console.log(chalk.bold('\n🔗 GitHub Issues'));
      if (data.githubIssuesRepo) {
        console.log(`   Repository: ${chalk.cyan(data.githubIssuesRepo)}`);
        console.log(`   ${chalk.green('✓ Configured')}`);
      } else {
        console.log(`   ${chalk.gray('Not configured')}`);
      }

      console.log();
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to fetch integration configuration'));
      console.error(
        chalk.red(
          `\n${error.response?.data?.message || error.message}\n`,
        ),
      );
      process.exit(1);
    }
  },

  /**
   * Configure integrations for a project
   */
  async configure(projectId?: string, options?: {
    figmaFile?: string;
    figmaNode?: string;
    sentryOrg?: string;
    sentryProject?: string;
    githubIssues?: string;
  }) {
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

    // If options provided via CLI, use them directly
    const hasOptions = options && Object.values(options).some(Boolean);

    let integrationData: any = {};

    if (hasOptions) {
      integrationData = {
        figmaFileKey: options?.figmaFile,
        figmaNodeId: options?.figmaNode,
        sentryOrgSlug: options?.sentryOrg,
        sentryProjectSlug: options?.sentryProject,
        githubIssuesRepo: options?.githubIssues,
      };
    } else {
      // Interactive mode
      console.log(chalk.bold('\n⚙️  Configure Integrations\n'));
      console.log(chalk.gray('Leave blank to skip an integration.\n'));

      // Figma configuration
      console.log(chalk.bold('📐 Figma'));
      console.log(chalk.gray('   Extract from URL: https://www.figma.com/file/[FILE_KEY]/...?node-id=[NODE_ID]\n'));

      const figmaAnswers = await prompts([
        {
          type: 'text',
          name: 'figmaFileKey',
          message: 'Figma File Key:',
        },
        {
          type: (prev) => (prev ? 'text' : null),
          name: 'figmaNodeId',
          message: 'Figma Node ID (optional):',
        },
      ]);

      // Sentry configuration
      console.log(chalk.bold('\n🐛 Sentry'));
      console.log(chalk.gray('   Find at: https://[ORG_SLUG].sentry.io/projects/[PROJECT_SLUG]/\n'));

      const sentryAnswers = await prompts([
        {
          type: 'text',
          name: 'sentryOrgSlug',
          message: 'Sentry Organization Slug:',
        },
        {
          type: (prev) => (prev ? 'text' : null),
          name: 'sentryProjectSlug',
          message: 'Sentry Project Slug:',
        },
      ]);

      // GitHub Issues configuration
      console.log(chalk.bold('\n🔗 GitHub Issues'));
      console.log(chalk.gray('   Format: owner/repo (e.g., facebook/react)\n'));

      const githubAnswers = await prompts({
        type: 'text',
        name: 'githubIssuesRepo',
        message: 'GitHub Issues Repository:',
        validate: (value) => {
          if (!value) return true; // Allow empty
          return value.includes('/') ? true : 'Format should be owner/repo';
        },
      });

      integrationData = {
        figmaFileKey: figmaAnswers.figmaFileKey || undefined,
        figmaNodeId: figmaAnswers.figmaNodeId || undefined,
        sentryOrgSlug: sentryAnswers.sentryOrgSlug || undefined,
        sentryProjectSlug: sentryAnswers.sentryProjectSlug || undefined,
        githubIssuesRepo: githubAnswers.githubIssuesRepo || undefined,
      };
    }

    // Remove undefined values
    Object.keys(integrationData).forEach((key) => {
      if (integrationData[key] === undefined || integrationData[key] === '') {
        delete integrationData[key];
      }
    });

    if (Object.keys(integrationData).length === 0) {
      console.log(chalk.gray('\nNo integrations configured'));
      return;
    }

    const spinner = ora('Saving integration configuration...').start();

    try {
      await apiClient.put(`/projects/${projectId}/integrations`, integrationData);

      spinner.succeed(chalk.green('Integration configuration saved!'));

      console.log(chalk.bold('\n✅ Configured:\n'));

      if (integrationData.figmaFileKey) {
        console.log(`   📐 Figma: ${chalk.cyan(integrationData.figmaFileKey)}`);
      }
      if (integrationData.sentryOrgSlug && integrationData.sentryProjectSlug) {
        console.log(`   🐛 Sentry: ${chalk.cyan(`${integrationData.sentryOrgSlug}/${integrationData.sentryProjectSlug}`)}`);
      }
      if (integrationData.githubIssuesRepo) {
        console.log(`   🔗 GitHub Issues: ${chalk.cyan(integrationData.githubIssuesRepo)}`);
      }

      console.log();
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to save integration configuration'));
      console.error(
        chalk.red(
          `\n${error.response?.data?.message || error.message}\n`,
        ),
      );
      process.exit(1);
    }
  },

  /**
   * Setup Linear Custom Fields for a project
   */
  async setupLinear(projectId?: string, teamId?: string) {
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

    // If no teamId provided, fetch teams and let user select
    if (!teamId) {
      const spinner = ora('Fetching Linear teams...').start();

      try {
        const { data: teams } = await apiClient.get(`/projects/${projectId}/linear/teams`);
        spinner.stop();

        if (!teams || teams.length === 0) {
          console.log(chalk.red('\nNo Linear teams found. Make sure Linear OAuth is connected.\n'));
          return;
        }

        const teamAnswer = await prompts({
          type: 'select',
          name: 'teamId',
          message: 'Select Linear team:',
          choices: teams.map((team: any) => ({
            title: team.name,
            value: team.id,
            description: team.key,
          })),
        });

        if (!teamAnswer.teamId) {
          console.log(chalk.gray('\nCancelled'));
          return;
        }

        teamId = teamAnswer.teamId;
      } catch (error: any) {
        spinner.fail(chalk.red('Failed to fetch Linear teams'));
        console.error(
          chalk.red(
            `\n${error.response?.data?.message || error.message}\n`,
          ),
        );
        process.exit(1);
      }
    }

    const setupSpinner = ora('Setting up Linear Custom Fields...').start();

    try {
      const { data } = await apiClient.post(`/projects/${projectId}/linear/setup-custom-fields`, {
        teamId,
      });

      setupSpinner.succeed(chalk.green('Linear Custom Fields setup complete!'));

      console.log(chalk.bold('\n📋 Custom Fields:\n'));

      if (data.created && data.created.length > 0) {
        console.log(chalk.green(`   ✅ Created: ${data.created.join(', ')}`));
      }

      if (data.existing && data.existing.length > 0) {
        console.log(chalk.gray(`   ℹ️  Already exist: ${data.existing.join(', ')}`));
      }

      console.log(chalk.bold('\n💡 Usage:\n'));
      console.log(chalk.gray('   When creating Linear issues, fill in these custom fields:'));
      console.log(chalk.gray('   • Figma URL - Link to relevant Figma design'));
      console.log(chalk.gray('   • Sentry URL - Link to related Sentry error'));
      console.log(chalk.gray('   • GitHub Issue URL - Link to related GitHub issue'));
      console.log(chalk.gray('\n   DevFlow will automatically extract context from these URLs.\n'));
    } catch (error: any) {
      setupSpinner.fail(chalk.red('Failed to setup Linear Custom Fields'));
      console.error(
        chalk.red(
          `\n${error.response?.data?.message || error.message}\n`,
        ),
      );
      process.exit(1);
    }
  },

  /**
   * Test integration connections and context extraction
   */
  async test(projectId?: string, provider?: string) {
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

    // If provider specified, test only that one
    const providersToTest = provider
      ? [provider.toUpperCase()]
      : ['GITHUB', 'LINEAR', 'FIGMA', 'SENTRY'];

    console.log(chalk.bold('\n🧪 Testing Integration Connections\n'));
    console.log(`Project: ${chalk.cyan(projectId)}\n`);
    console.log('━'.repeat(80));
    console.log();

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const prov of providersToTest) {
      totalTests++;

      const providerName = prov === 'GITHUB' ? 'GitHub' :
                          prov === 'LINEAR' ? 'Linear' :
                          prov === 'FIGMA' ? 'Figma' : 'Sentry';

      const spinner = ora(`Testing ${providerName} integration...`).start();

      try {
        // Test connection via API endpoint
        const { data } = await apiClient.post(`/integrations/test/${prov.toLowerCase()}`, {
          projectId,
        });

        spinner.succeed(chalk.green(`${providerName} integration working`));

        console.log(`   ${chalk.gray('Status:')} ${chalk.green('✓ Connected')}`);

        if (data.user) {
          console.log(`   ${chalk.gray('User:')} ${data.user}`);
        }

        if (data.testResult) {
          console.log(`   ${chalk.gray('Test:')} ${data.testResult}`);
        }

        if (data.details) {
          Object.entries(data.details).forEach(([key, value]) => {
            console.log(`   ${chalk.gray(`${key}:`)} ${value}`);
          });
        }

        console.log();
        passedTests++;
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message;

        if (errorMsg.includes('No OAuth connection')) {
          spinner.warn(chalk.yellow(`${providerName} not connected`));
          console.log(`   ${chalk.gray('Status:')} ${chalk.yellow('⚠ Not configured')}`);
          console.log(`   ${chalk.gray('Hint:')} Run ${chalk.cyan(`devflow oauth:connect --project ${projectId} --provider ${prov}`)}`);
        } else if (errorMsg.includes('inactive') || errorMsg.includes('refresh failed')) {
          spinner.fail(chalk.red(`${providerName} connection inactive`));
          console.log(`   ${chalk.gray('Status:')} ${chalk.red('✗ Inactive')}`);
          console.log(`   ${chalk.gray('Error:')} ${errorMsg}`);
          console.log(`   ${chalk.gray('Hint:')} Reconnect with ${chalk.cyan(`devflow oauth:connect --project ${projectId} --provider ${prov}`)}`);
          failedTests++;
        } else {
          spinner.fail(chalk.red(`${providerName} test failed`));
          console.log(`   ${chalk.gray('Status:')} ${chalk.red('✗ Error')}`);
          console.log(`   ${chalk.gray('Error:')} ${errorMsg}`);
          failedTests++;
        }

        console.log();
      }
    }

    console.log('━'.repeat(80));
    console.log(chalk.bold('\n📊 Test Summary\n'));
    console.log(`   Total: ${totalTests}`);
    console.log(`   ${chalk.green('Passed:')} ${passedTests}`);

    if (failedTests > 0) {
      console.log(`   ${chalk.red('Failed:')} ${failedTests}`);
    }

    const notConfigured = totalTests - passedTests - failedTests;
    if (notConfigured > 0) {
      console.log(`   ${chalk.yellow('Not Configured:')} ${notConfigured}`);
    }

    console.log();

    if (passedTests === totalTests) {
      console.log(chalk.green('✅ All configured integrations are working!\n'));
      process.exit(0);
    } else if (failedTests > 0) {
      console.log(chalk.red('❌ Some integrations have errors. Please check the logs above.\n'));
      process.exit(1);
    } else {
      console.log(chalk.yellow('⚠️  Some integrations are not configured yet.\n'));
      process.exit(0);
    }
  },
};
