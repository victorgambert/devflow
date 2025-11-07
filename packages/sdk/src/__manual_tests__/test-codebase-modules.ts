/**
 * Test that codebase analysis modules are correctly exported and functional
 */

import { parseGitHubUrl, parseRepositoryUrl, normalizeRepositoryUrl } from '../vcs/repository-utils';

console.log('🧪 Testing Codebase Analysis Modules\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error}`);
    failed++;
  }
}

// Test repository URL parsing
console.log('📋 Testing Repository URL Parsing');
console.log('─────────────────────────────────\n');

test('Parse HTTPS GitHub URL', () => {
  const result = parseGitHubUrl('https://github.com/facebook/react');
  if (result.owner !== 'facebook' || result.repo !== 'react') {
    throw new Error(`Expected owner=facebook, repo=react, got owner=${result.owner}, repo=${result.repo}`);
  }
});

test('Parse HTTPS GitHub URL with .git', () => {
  const result = parseGitHubUrl('https://github.com/vercel/next.js.git');
  if (result.owner !== 'vercel' || result.repo !== 'next.js') {
    throw new Error(`Expected owner=vercel, repo=next.js, got owner=${result.owner}, repo=${result.repo}`);
  }
});

test('Parse SSH GitHub URL', () => {
  const result = parseGitHubUrl('git@github.com:expressjs/express.git');
  if (result.owner !== 'expressjs' || result.repo !== 'express') {
    throw new Error(`Expected owner=expressjs, repo=express, got owner=${result.owner}, repo=${result.repo}`);
  }
});

test('Parse GitHub URL without protocol', () => {
  const result = parseGitHubUrl('github.com/nodejs/node');
  if (result.owner !== 'nodejs' || result.repo !== 'node') {
    throw new Error(`Expected owner=nodejs, repo=node, got owner=${result.owner}, repo=${result.repo}`);
  }
});

test('parseRepositoryUrl with provider detection', () => {
  const result = parseRepositoryUrl('https://github.com/facebook/react');
  if (result.owner !== 'facebook' || result.repo !== 'react' || result.provider !== 'github') {
    throw new Error(`Expected facebook/react on github, got ${result.owner}/${result.repo} on ${result.provider}`);
  }
});

test('normalizeRepositoryUrl', () => {
  const result = normalizeRepositoryUrl('git@github.com:facebook/react.git');
  if (result !== 'https://github.com/facebook/react') {
    throw new Error(`Expected https://github.com/facebook/react, got ${result}`);
  }
});

console.log('\n📦 Testing Module Exports');
console.log('─────────────────────────────────\n');

test('analyzeRepository function exported', () => {
  const { analyzeRepository } = require('../codebase/codebase-analyzer.service');
  if (typeof analyzeRepository !== 'function') {
    throw new Error('analyzeRepository is not a function');
  }
});

test('analyzeStructure function exported', () => {
  const { analyzeStructure } = require('../codebase/structure-analyzer');
  if (typeof analyzeStructure !== 'function') {
    throw new Error('analyzeStructure is not a function');
  }
});

test('analyzeDependencies function exported', () => {
  const { analyzeDependencies } = require('../codebase/dependency-analyzer');
  if (typeof analyzeDependencies !== 'function') {
    throw new Error('analyzeDependencies is not a function');
  }
});

test('findSimilarCode function exported', () => {
  const { findSimilarCode } = require('../codebase/code-similarity.service');
  if (typeof findSimilarCode !== 'function') {
    throw new Error('findSimilarCode is not a function');
  }
});

test('scanDocumentation function exported', () => {
  const { scanDocumentation } = require('../codebase/documentation-scanner');
  if (typeof scanDocumentation !== 'function') {
    throw new Error('scanDocumentation is not a function');
  }
});

test('GitHubProvider has new methods', () => {
  const { GitHubProvider } = require('../vcs/github.provider');
  const provider = new GitHubProvider('fake-token');

  if (typeof provider.getRepositoryTree !== 'function') {
    throw new Error('getRepositoryTree method not found');
  }
  if (typeof provider.getRepositoryLanguages !== 'function') {
    throw new Error('getRepositoryLanguages method not found');
  }
  if (typeof provider.searchCode !== 'function') {
    throw new Error('searchCode method not found');
  }
  if (typeof provider.getMultipleFiles !== 'function') {
    throw new Error('getMultipleFiles method not found');
  }
  if (typeof provider.fileExists !== 'function') {
    throw new Error('fileExists method not found');
  }
});

console.log('\n═══════════════════════════════════════════');
console.log('📊 TEST RESULTS');
console.log('═══════════════════════════════════════════\n');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Total: ${passed + failed}`);

if (failed === 0) {
  console.log('\n🎉 All tests passed!\n');
  console.log('✨ The codebase analysis integration is ready to use.');
  console.log('\n📝 Next steps:');
  console.log('   1. Get a GitHub token from https://github.com/settings/tokens');
  console.log('   2. Run: GITHUB_TOKEN="your-token" npx ts-node src/__manual_tests__/test-codebase-analysis.ts owner/repo');
  console.log('   3. Example: GITHUB_TOKEN="ghp_xxx" npx ts-node src/__manual_tests__/test-codebase-analysis.ts facebook/react');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. Please check the errors above.\n');
  process.exit(1);
}
