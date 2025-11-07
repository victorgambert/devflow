/**
 * Manual Test Script for GitLab Provider
 *
 * Usage:
 *   1. Create a GitLab Personal Access Token at: https://gitlab.com/-/profile/personal_access_tokens
 *      Required scopes: api, read_api, write_repository
 *   2. Set environment variable: export GITLAB_TOKEN=glpat-xxxxxxxxxxxx
 *   3. Run: npx ts-node src/__manual_tests__/test-gitlab.ts
 */

import 'dotenv/config';
import { GitLabProvider } from '../vcs/gitlab.provider';

async function testGitLabProvider() {
  console.log('🦊 GitLab Provider Manual Test\n');
  console.log('================================\n');

  // Check token
  const token = process.env.GITLAB_TOKEN;
  if (!token) {
    console.error('❌ Error: GITLAB_TOKEN not set in environment');
    console.log('\nPlease set your GitLab token:');
    console.log('  export GITLAB_TOKEN=glpat-xxxxxxxxxxxx\n');
    console.log('Get your token from: https://gitlab.com/-/profile/personal_access_tokens');
    console.log('Required scopes: api, read_api, write_repository\n');
    process.exit(1);
  }

  console.log('✅ GitLab token found\n');

  // Initialize provider
  const gitlab = new GitLabProvider(token);
  console.log('✅ GitLab provider initialized\n');

  // Test repository (using a public GitLab repo)
  const testOwner = 'gitlab-org';
  const testRepo = 'gitlab';

  try {
    // Test 1: Get Repository
    console.log('Test 1: Get Repository');
    console.log('----------------------');
    const repo = await gitlab.getRepository(testOwner, testRepo);
    console.log('✅ Repository retrieved:');
    console.log(`   - Name: ${repo.name}`);
    console.log(`   - Owner: ${repo.owner}`);
    console.log(`   - URL: ${repo.url}`);
    console.log(`   - Default Branch: ${repo.defaultBranch}\n`);

    // Test 2: Get Branch
    console.log('Test 2: Get Branch (main)');
    console.log('-------------------------');
    const branch = await gitlab.getBranch(testOwner, testRepo, 'master');
    console.log('✅ Branch retrieved:');
    console.log(`   - Name: ${branch.name}`);
    console.log(`   - SHA: ${branch.sha.substring(0, 8)}...`);
    console.log(`   - Protected: ${branch.protected}\n`);

    // Test 3: Get Commits
    console.log('Test 3: Get Commits');
    console.log('-------------------');
    const commits = await gitlab.getCommits(testOwner, testRepo, 'master');
    console.log(`✅ Retrieved ${commits.length} commits:`);
    commits.slice(0, 3).forEach((commit, i) => {
      console.log(`   ${i + 1}. ${commit.message.split('\n')[0]}`);
      console.log(`      Author: ${commit.author}`);
      console.log(`      SHA: ${commit.sha.substring(0, 8)}...\n`);
    });

    // Test 4: Get File Content
    console.log('Test 4: Get File Content (README.md)');
    console.log('------------------------------------');
    const fileContent = await gitlab.getFileContent(
      testOwner,
      testRepo,
      'README.md',
      'master'
    );
    console.log('✅ File content retrieved:');
    console.log(`   - Length: ${fileContent.length} characters`);
    console.log(`   - Preview: ${fileContent.substring(0, 100)}...\n`);

    // Test 5: Get Directory Tree
    console.log('Test 5: Get Directory Tree');
    console.log('--------------------------');
    const tree = await gitlab.getDirectoryTree(testOwner, testRepo, '', 'master');
    console.log(`✅ Directory tree retrieved (${tree.length} items):`);
    tree.slice(0, 10).forEach((item, i) => {
      console.log(`   ${i + 1}. ${item}`);
    });
    if (tree.length > 10) {
      console.log(`   ... and ${tree.length - 10} more items`);
    }
    console.log('');

    // Summary
    console.log('================================');
    console.log('🎉 All tests passed!');
    console.log('================================\n');
    console.log('GitLab provider is working correctly! ✅\n');
    console.log('You can now use GitLab with DevFlow:\n');
    console.log('  const gitlab = new GitLabProvider(token);');
    console.log('  const repo = await gitlab.getRepository(owner, repo);\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    console.log('\nPossible causes:');
    console.log('  - Invalid GitLab token');
    console.log('  - Insufficient token permissions');
    console.log('  - Network/API issues');
    console.log('  - Rate limit exceeded\n');
    process.exit(1);
  }
}

// Run tests
testGitLabProvider()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
