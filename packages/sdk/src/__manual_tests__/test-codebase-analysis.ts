/**
 * Test script for codebase analysis
 *
 * Usage:
 * GITHUB_TOKEN="your-token" npx ts-node src/__manual_tests__/test-codebase-analysis.ts owner/repo
 *
 * Example:
 * GITHUB_TOKEN="ghp_xxx" npx ts-node src/__manual_tests__/test-codebase-analysis.ts facebook/react
 */

import { GitHubProvider } from '../vcs/github.provider';
import { parseGitHubUrl } from '../vcs/repository-utils';
import {
  analyzeRepository,
  generateCodebaseSummary,
  formatContextForAI,
  extractSpecGenerationContext,
  extractCodeGenerationContext,
} from '../codebase';

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  // Get repository from command line or use default
  const repoArg = process.argv[2];
  if (!repoArg) {
    console.error('❌ Usage: npx ts-node test-codebase-analysis.ts owner/repo');
    console.error('   Example: npx ts-node test-codebase-analysis.ts facebook/react');
    process.exit(1);
  }

  // Parse owner/repo from argument
  let owner: string;
  let repo: string;

  if (repoArg.includes('/')) {
    [owner, repo] = repoArg.split('/');
  } else {
    console.error('❌ Repository must be in format owner/repo');
    process.exit(1);
  }

  console.log(`\n🔍 Analyzing repository: ${owner}/${repo}\n`);

  try {
    // Create GitHub provider
    const github = new GitHubProvider(token);

    // Test basic repository access
    console.log('📡 Testing repository access...');
    const repoInfo = await github.getRepository(owner, repo);
    console.log(`✅ Repository found: ${repoInfo.fullName}`);
    console.log(`   Default branch: ${repoInfo.defaultBranch}`);
    console.log(`   URL: ${repoInfo.url}\n`);

    // Analyze repository
    console.log('🔬 Analyzing codebase...');
    const startTime = Date.now();

    const context = await analyzeRepository(github, owner, repo, 'authentication system');

    const duration = Date.now() - startTime;
    console.log(`✅ Analysis completed in ${duration}ms\n`);

    // Display results
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 CODEBASE ANALYSIS RESULTS');
    console.log('═══════════════════════════════════════════════════\n');

    // Structure
    console.log('🏗️  PROJECT STRUCTURE');
    console.log('─────────────────────');
    console.log(`Language: ${context.structure.language}`);
    console.log(`Framework: ${context.structure.framework || 'Not detected'}`);
    console.log(`Files: ${context.structure.fileCount}`);
    console.log(`Directories: ${context.structure.directories.length}`);
    if (context.structure.mainPaths.src) {
      console.log(`Source directory: ${context.structure.mainPaths.src}`);
    }
    if (context.structure.mainPaths.tests) {
      console.log(`Tests directory: ${context.structure.mainPaths.tests}`);
    }
    console.log(`\n${context.structure.summary}\n`);

    // Dependencies
    console.log('📦 DEPENDENCIES');
    console.log('─────────────────────');
    console.log(`Production: ${Object.keys(context.dependencies.production).length}`);
    console.log(`Development: ${Object.keys(context.dependencies.dev).length}`);
    if (context.dependencies.mainLibraries.length > 0) {
      console.log(`\nMain libraries:`);
      context.dependencies.mainLibraries.slice(0, 10).forEach((lib) => {
        console.log(`  • ${lib}`);
      });
    }
    console.log(`\n${context.dependencies.summary}\n`);

    // Documentation
    console.log('📖 DOCUMENTATION');
    console.log('─────────────────────');
    console.log(`README: ${context.documentation.readme ? 'Found' : 'Not found'}`);
    console.log(`CONTRIBUTING: ${context.documentation.contributing ? 'Found' : 'Not found'}`);
    if (context.documentation.conventions.length > 0) {
      console.log(`\nConventions (${context.documentation.conventions.length}):`);
      context.documentation.conventions.slice(0, 5).forEach((conv) => {
        console.log(`  • ${conv}`);
      });
    }
    if (context.documentation.patterns.length > 0) {
      console.log(`\nPatterns (${context.documentation.patterns.length}):`);
      context.documentation.patterns.slice(0, 5).forEach((pattern) => {
        console.log(`  • ${pattern}`);
      });
    }
    console.log(`\n${context.documentation.summary}\n`);

    // Similar Code
    if (context.similarCode.length > 0) {
      console.log('🔎 SIMILAR CODE EXAMPLES');
      console.log('─────────────────────');
      console.log(`Found ${context.similarCode.length} relevant examples:`);
      context.similarCode.forEach((code, index) => {
        console.log(`\n${index + 1}. ${code.path}`);
        console.log(`   Reason: ${code.reason}`);
        console.log(`   Score: ${code.relevanceScore}`);
        console.log(`   Content preview: ${code.content.substring(0, 100)}...`);
      });
      console.log('');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════');
    console.log('📝 SUMMARY');
    console.log('═══════════════════════════════════════════════════\n');
    console.log(generateCodebaseSummary(context));

    // Show how it would be formatted for AI
    console.log('\n\n═══════════════════════════════════════════════════');
    console.log('🤖 AI CONTEXT FORMAT (for spec/code generation)');
    console.log('═══════════════════════════════════════════════════\n');

    const specContext = extractSpecGenerationContext(context);
    console.log('For SPEC Generation:');
    console.log(JSON.stringify(specContext, null, 2));

    console.log('\n\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();
