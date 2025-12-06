/**
 * End-to-End Integration Test
 *
 * Tests the complete GitHub integration workflow:
 * 1. Parse repository URL
 * 2. Validate GitHub access
 * 3. Analyze codebase context
 * 4. Format context for AI
 * 5. Extract spec/code generation context
 *
 * Usage:
 *   # Option 1: Using .env file (recommended)
 *   Create .env file with: GITHUB_TOKEN=ghp_xxx
 *   npx ts-node src/__manual_tests__/test-integration-e2e.ts owner/repo
 *
 *   # Option 2: Inline environment variable
 *   GITHUB_TOKEN="ghp_xxx" npx ts-node src/__manual_tests__/test-integration-e2e.ts owner/repo
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env file from SDK root
dotenv.config({ path: path.join(__dirname, '../../.env') });

import {
  parseRepositoryUrl,
  GitHubProvider,
  analyzeRepository,
  formatContextForAI,
  extractSpecGenerationContext,
  extractCodeGenerationContext,
  generateCodebaseSummary,
} from '../index';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Usage: GITHUB_TOKEN="ghp_xxx" npx ts-node src/__manual_tests__/test-integration-e2e.ts owner/repo');
    console.error('   Example: GITHUB_TOKEN="ghp_xxx" npx ts-node src/__manual_tests__/test-integration-e2e.ts facebook/react');
    process.exit(1);
  }

  const repoInput = args[0];
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error('❌ GITHUB_TOKEN not found');
    console.error('');
    console.error('   Option 1 (Recommended): Create .env file');
    console.error('   Create /Users/victor/Sites/devflow/packages/sdk/.env with:');
    console.error('   GITHUB_TOKEN=ghp_your_token_here');
    console.error('');
    console.error('   Option 2: Set environment variable');
    console.error('   export GITHUB_TOKEN="ghp_your_token"');
    console.error('');
    console.error('   Get your token at: https://github.com/settings/tokens');
    process.exit(1);
  }

  console.log('\n🚀 DevFlow GitHub Integration - End-to-End Test\n');
  console.log('='.repeat(60));

  // ============================================
  // Step 1: Parse Repository URL
  // ============================================
  console.log('\n📋 Step 1: Parsing Repository URL');
  console.log('-'.repeat(60));

  let repoUrl = repoInput;
  if (!repoInput.includes('://') && !repoInput.startsWith('git@')) {
    repoUrl = `https://github.com/${repoInput}`;
  }

  try {
    const repoInfo = parseRepositoryUrl(repoUrl);
    console.log('✅ Repository parsed successfully');
    console.log(`   Provider: ${repoInfo.provider}`);
    console.log(`   Owner:    ${repoInfo.owner}`);
    console.log(`   Repo:     ${repoInfo.repo}`);
    console.log(`   URL:      ${repoInfo.url}`);
  } catch (error) {
    console.error('❌ Failed to parse repository URL:', (error as Error).message);
    process.exit(1);
  }

  // ============================================
  // Step 2: Validate GitHub Access
  // ============================================
  console.log('\n🔑 Step 2: Validating GitHub Access');
  console.log('-'.repeat(60));

  const { owner, repo } = parseRepositoryUrl(repoUrl);
  const github = new GitHubProvider(token);

  try {
    const repoData = await github.getRepository(owner, repo);
    console.log('✅ Repository access validated');
    console.log(`   Name:          ${repoData.name}`);
    console.log(`   Full Name:     ${repoData.fullName}`);
    console.log(`   URL:           ${repoData.url}`);
    console.log(`   Default Branch: ${repoData.defaultBranch}`);
  } catch (error) {
    console.error('❌ Failed to access repository:', (error as Error).message);
    console.error('   Check that:');
    console.error('   - The repository exists');
    console.error('   - Your token has read access');
    console.error('   - The repository is public or you have access');
    process.exit(1);
  }

  // ============================================
  // Step 3: Analyze Codebase Context
  // ============================================
  console.log('\n🔍 Step 3: Analyzing Codebase Context');
  console.log('-'.repeat(60));

  const taskDescription = 'Add user authentication with JWT';

  try {
    console.log('   Analyzing structure...');
    const startTime = Date.now();

    const context = await analyzeRepository(
      github,
      owner,
      repo,
      taskDescription
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Analysis completed in ${duration}s`);
    console.log('\n   📊 Results:');
    console.log(`   Language:     ${context.structure.language}`);
    console.log(`   Framework:    ${context.structure.framework || 'N/A'}`);
    console.log(`   Files:        ${context.structure.fileCount}`);
    console.log(`   Dependencies: ${context.dependencies.mainLibraries.length} main, ${Object.keys(context.dependencies.dev).length} dev`);
    console.log(`   Conventions:  ${context.documentation.conventions.length} found`);
    console.log(`   Patterns:     ${context.documentation.patterns.length} found`);
    console.log(`   Similar code: ${context.similarCode.length} examples`);

    // ============================================
    // Step 4: Generate Context Summary
    // ============================================
    console.log('\n📝 Step 4: Generating Context Summary');
    console.log('-'.repeat(60));

    const summary = generateCodebaseSummary(context);
    console.log(summary);

    // ============================================
    // Step 5: Extract Spec Generation Context
    // ============================================
    console.log('\n🎯 Step 5: Extracting Spec Generation Context');
    console.log('-'.repeat(60));

    const specContext = extractSpecGenerationContext(context);
    console.log('✅ Spec context extracted');
    console.log(`   Language:     ${specContext.language}`);
    console.log(`   Framework:    ${specContext.framework || 'N/A'}`);
    console.log(`   Dependencies: ${specContext.dependencies.length}`);
    console.log(`   Conventions:  ${specContext.conventions.length}`);
    console.log(`   Patterns:     ${specContext.patterns.length}`);

    // ============================================
    // Step 6: Extract Code Generation Context
    // ============================================
    console.log('\n💻 Step 6: Extracting Code Generation Context');
    console.log('-'.repeat(60));

    const codeContext = extractCodeGenerationContext(context);
    console.log('✅ Code context extracted');
    console.log(`   Project structure: ${codeContext.projectStructure.split('\n').length} lines`);
    console.log(`   Relevant files:    ${codeContext.relevantFiles.length}`);
    console.log(`   Conventions:       ${codeContext.conventions.length}`);
    console.log(`   Dependencies:      ${codeContext.dependencies.length}`);

    // ============================================
    // Step 7: Format for AI
    // ============================================
    console.log('\n🤖 Step 7: Formatting Context for AI');
    console.log('-'.repeat(60));

    const aiContext = formatContextForAI(context);
    const lines = aiContext.split('\n').length;
    const chars = aiContext.length;
    const tokens = Math.ceil(chars / 4); // Rough estimate

    console.log('✅ Context formatted for AI');
    console.log(`   Lines:  ${lines}`);
    console.log(`   Chars:  ${chars.toLocaleString()}`);
    console.log(`   Tokens: ~${tokens.toLocaleString()} (estimated)`);

    // Show first 500 chars as preview
    console.log('\n   Preview (first 500 chars):');
    console.log('   ' + '-'.repeat(58));
    console.log(aiContext.substring(0, 500).split('\n').map(l => `   ${l}`).join('\n'));
    if (aiContext.length > 500) {
      console.log(`   ... (${chars - 500} more chars)`);
    }

    // ============================================
    // Summary
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(60));
    console.log('\n📋 Integration Summary:');
    console.log(`   ✅ Repository URL parsing`);
    console.log(`   ✅ GitHub API access`);
    console.log(`   ✅ Codebase structure analysis`);
    console.log(`   ✅ Dependency extraction`);
    console.log(`   ✅ Documentation scanning`);
    console.log(`   ✅ Similar code search`);
    console.log(`   ✅ Spec context extraction`);
    console.log(`   ✅ Code context extraction`);
    console.log(`   ✅ AI context formatting`);
    console.log('\n🎉 The integration is ready for production!');
    console.log('\nNext steps:');
    console.log('   1. Test with your own repositories');
    console.log('   2. Integrate with Temporal workflows');
    console.log('   3. Connect to Linear for task management');
    console.log('   4. Deploy to production\n');

  } catch (error) {
    console.error('\n❌ Analysis failed:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
