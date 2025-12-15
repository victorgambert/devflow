/**
 * Test GitHub Access for RAG (codebase download)
 *
 * This test verifies:
 * 1. GitHub OAuth connection works
 * 2. Can list repository files
 * 3. Can read file contents
 * 4. Can get repository structure
 */

import { GitHubProvider } from '../vcs/github.provider.js';

async function testGitHubAccess() {
  console.log('🧪 Testing GitHub Access for RAG\n');
  console.log('================================\n');

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error('❌ GITHUB_TOKEN environment variable not set');
    process.exit(1);
  }

  const github = new GitHubProvider(githubToken);

  try {
    // Test 1: List repository files
    console.log('📂 Test 1: List repository files');
    console.log('Repository: expressjs/express');
    console.log('Path: lib/');
    const files = await github.listFiles('expressjs', 'express', 'lib/');
    console.log(`✅ Found ${files.length} files in lib/`);
    console.log('First 5 files:');
    files.slice(0, 5).forEach(file => {
      console.log(`  - ${file.name} (${file.type})`);
    });
    console.log();

    // Test 2: Read file content
    console.log('📄 Test 2: Read file content');
    console.log('File: README.md');
    const readmeContent = await github.getFile('expressjs', 'express', 'README.md');
    const readmeLines = readmeContent.split('\n');
    console.log(`✅ Read README.md (${readmeLines.length} lines)`);
    console.log('First 5 lines:');
    readmeLines.slice(0, 5).forEach((line, i) => {
      console.log(`  ${i + 1}. ${line}`);
    });
    console.log();

    // Test 3: Get repository info
    console.log('📊 Test 3: Get repository info');
    const repoInfo = await github.getRepository('expressjs', 'express');
    console.log(`✅ Repository: ${repoInfo.full_name}`);
    console.log(`  Description: ${repoInfo.description}`);
    console.log(`  Language: ${repoInfo.language}`);
    console.log(`  Stars: ${repoInfo.stargazers_count}`);
    console.log(`  Default branch: ${repoInfo.default_branch}`);
    console.log();

    // Test 4: List branches
    console.log('🌿 Test 4: List branches');
    const branches = await github.listBranches('expressjs', 'express');
    console.log(`✅ Found ${branches.length} branches`);
    console.log('First 3 branches:');
    branches.slice(0, 3).forEach(branch => {
      console.log(`  - ${branch.name} (${branch.commit.sha.substring(0, 7)})`);
    });
    console.log();

    // Success summary
    console.log('================================');
    console.log('✅ All tests passed!');
    console.log('\nGitHub Access Summary:');
    console.log('  ✅ OAuth connection active');
    console.log('  ✅ Can list repository files');
    console.log('  ✅ Can read file contents');
    console.log('  ✅ Can get repository metadata');
    console.log('  ✅ Can list branches');
    console.log('\n🎉 GitHub integration ready for RAG!');

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error);
    process.exit(1);
  }
}

testGitHubAccess();
