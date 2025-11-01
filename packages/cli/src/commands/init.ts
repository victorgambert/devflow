/**
 * DevFlow CLI - init command
 * Phase 7: UX & CLI
 */

import { Command, Flags } from '@oclif/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';

export default class Init extends Command {
  static description = 'Initialize DevFlow in your project';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --monorepo',
    '<%= config.bin %> <%= command.id %> --stack node',
  ];

  static flags = {
    monorepo: Flags.boolean({
      char: 'm',
      description: 'Initialize for monorepo project',
      default: false,
    }),
    stack: Flags.string({
      char: 's',
      description: 'Technology stack (node, php, python, go, rust)',
      options: ['node', 'php', 'python', 'go', 'rust'],
    }),
    'dry-run': Flags.boolean({
      description: 'Show what would be created without creating',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing .devflow.yml',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    this.log(chalk.cyan.bold('🚀 DevFlow Initialization'));
    this.log();

    // Check if .devflow.yml already exists
    const configPath = path.join(process.cwd(), '.devflow.yml');
    const exists = await this.fileExists(configPath);

    if (exists && !flags.force) {
      this.log(chalk.yellow('⚠️  .devflow.yml already exists!'));
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Do you want to overwrite it?',
          default: false,
        },
      ]);

      if (!overwrite) {
        this.log(chalk.blue('ℹ️  Initialization cancelled.'));
        return;
      }
    }

    // Detect or select stack
    const stack = flags.stack || (await this.detectStack());
    this.log(chalk.green(`✓ Stack detected: ${stack}`));
    this.log();

    // Generate config
    const config = await this.generateConfig(stack, flags.monorepo);

    // Show preview
    this.log(chalk.cyan('📄 Preview of .devflow.yml:'));
    this.log(chalk.gray('─'.repeat(60)));
    this.log(yaml.stringify(config));
    this.log(chalk.gray('─'.repeat(60)));
    this.log();

    if (flags['dry-run']) {
      this.log(chalk.blue('ℹ️  Dry run - no files created.'));
      return;
    }

    // Confirm
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Create .devflow.yml with this configuration?',
        default: true,
      },
    ]);

    if (!confirm) {
      this.log(chalk.blue('ℹ️  Initialization cancelled.'));
      return;
    }

    // Create .devflow.yml
    const spinner = ora('Creating .devflow.yml...').start();
    try {
      await fs.writeFile(configPath, yaml.stringify(config), 'utf-8');
      spinner.succeed(chalk.green('✓ Created .devflow.yml'));
    } catch (error) {
      spinner.fail(chalk.red('✗ Failed to create .devflow.yml'));
      throw error;
    }

    // Create .env.example if not exists
    await this.createEnvExample();

    // Success message
    this.log();
    this.log(chalk.green.bold('✓ Initialization complete!'));
    this.log();
    this.log(chalk.cyan('Next steps:'));
    this.log(chalk.white('  1. Review and customize .devflow.yml'));
    this.log(chalk.white('  2. Run: devflow connect notion'));
    this.log(chalk.white('  3. Run: devflow connect github'));
    this.log(chalk.white('  4. Run: devflow doctor'));
    this.log();
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async detectStack(): Promise<string> {
    const cwd = process.cwd();

    // Check for package.json (Node)
    if (await this.fileExists(path.join(cwd, 'package.json'))) {
      return 'node';
    }

    // Check for composer.json (PHP)
    if (await this.fileExists(path.join(cwd, 'composer.json'))) {
      return 'php';
    }

    // Check for requirements.txt or pyproject.toml (Python)
    if (
      (await this.fileExists(path.join(cwd, 'requirements.txt'))) ||
      (await this.fileExists(path.join(cwd, 'pyproject.toml')))
    ) {
      return 'python';
    }

    // Check for go.mod (Go)
    if (await this.fileExists(path.join(cwd, 'go.mod'))) {
      return 'go';
    }

    // Check for Cargo.toml (Rust)
    if (await this.fileExists(path.join(cwd, 'Cargo.toml'))) {
      return 'rust';
    }

    // Prompt user
    const { stack } = await inquirer.prompt([
      {
        type: 'list',
        name: 'stack',
        message: 'Select your technology stack:',
        choices: ['node', 'php', 'python', 'go', 'rust'],
      },
    ]);

    return stack;
  }

  private async generateConfig(stack: string, monorepo: boolean): Promise<any> {
    const baseConfig = {
      version: '1.0',
      project: {
        name: path.basename(process.cwd()),
        type: monorepo ? 'monorepo' : 'single',
      },
      commands: this.getCommandsForStack(stack),
      testing: {
        framework: this.getTestFrameworkForStack(stack),
        coverage: {
          enabled: true,
          threshold: 80,
        },
      },
      guardrails: {
        allow_write_paths: ['src/', 'tests/', 'docs/'],
        max_commits: 10,
        max_file_size_kb: 500,
        max_changes_lines: 1000,
        codeowners: {
          enabled: false,
          paths: [],
        },
      },
      llm_budget: {
        daily_tokens: 100000,
        daily_cost_usd: 5.0,
        rate_limit_per_minute: 10,
      },
    };

    return baseConfig;
  }

  private getCommandsForStack(stack: string): any {
    const commands: Record<string, any> = {
      node: {
        setup: { run: 'npm install', timeout: 300 },
        build: { run: 'npm run build', timeout: 600 },
        lint: { run: 'npm run lint', timeout: 120 },
        unit: { run: 'npm test', timeout: 300 },
        e2e: { run: 'npm run test:e2e', timeout: 600 },
        fmt: { run: 'npm run format', timeout: 60 },
      },
      php: {
        setup: { run: 'composer install', timeout: 300 },
        build: { run: 'composer dump-autoload', timeout: 120 },
        lint: { run: './vendor/bin/phpcs', timeout: 120 },
        unit: { run: './vendor/bin/phpunit', timeout: 300 },
        fmt: { run: './vendor/bin/phpcbf', timeout: 60 },
      },
      python: {
        setup: { run: 'pip install -r requirements.txt', timeout: 300 },
        lint: { run: 'flake8 .', timeout: 120 },
        unit: { run: 'pytest', timeout: 300 },
        fmt: { run: 'black .', timeout: 60 },
      },
      go: {
        setup: { run: 'go mod download', timeout: 300 },
        build: { run: 'go build ./...', timeout: 600 },
        lint: { run: 'golangci-lint run', timeout: 120 },
        unit: { run: 'go test ./...', timeout: 300 },
        fmt: { run: 'go fmt ./...', timeout: 60 },
      },
      rust: {
        setup: { run: 'cargo fetch', timeout: 300 },
        build: { run: 'cargo build --release', timeout: 1200 },
        lint: { run: 'cargo clippy', timeout: 300 },
        unit: { run: 'cargo test', timeout: 600 },
        fmt: { run: 'cargo fmt', timeout: 60 },
      },
    };

    return commands[stack] || commands.node;
  }

  private getTestFrameworkForStack(stack: string): string {
    const frameworks: Record<string, string> = {
      node: 'jest',
      php: 'phpunit',
      python: 'pytest',
      go: 'go test',
      rust: 'cargo test',
    };

    return frameworks[stack] || 'unknown';
  }

  private async createEnvExample(): Promise<void> {
    const envExamplePath = path.join(process.cwd(), '.env.example');
    const exists = await this.fileExists(envExamplePath);

    if (exists) {
      this.log(chalk.blue('ℹ️  .env.example already exists, skipping.'));
      return;
    }

    const envContent = `# DevFlow Configuration
# Copy this file to .env and fill in your values

# API
DEVFLOW_API_URL=http://localhost:3000

# Notion
NOTION_API_KEY=
NOTION_DATABASE_ID=

# GitHub
GITHUB_TOKEN=
GITHUB_REPOSITORY=

# Anthropic (optional)
ANTHROPIC_API_KEY=

# OpenAI (optional)
OPENAI_API_KEY=

# Slack (optional)
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
`;

    try {
      await fs.writeFile(envExamplePath, envContent, 'utf-8');
      this.log(chalk.green('✓ Created .env.example'));
    } catch (error) {
      this.log(chalk.yellow('⚠️  Could not create .env.example'));
    }
  }
}
