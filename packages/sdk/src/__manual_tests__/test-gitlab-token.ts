/**
 * Simple GitLab Token Verification Script
 * Tests if the GitLab token is valid by fetching user info
 */

import 'dotenv/config';
import { Gitlab } from '@gitbeaker/node';

async function testGitLabToken() {
  console.log('🔐 GitLab Token Verification\n');
  console.log('================================\n');

  const token = process.env.GITLAB_TOKEN;
  if (!token) {
    console.error('❌ Error: GITLAB_TOKEN not set');
    process.exit(1);
  }

  console.log('✅ Token found\n');

  try {
    const api = new Gitlab({ token });

    // Test 1: Get current user
    console.log('Test 1: Get Current User');
    console.log('------------------------');
    const user = await api.Users.current();
    console.log('✅ Token is valid!');
    console.log(`   - Username: ${user.username}`);
    console.log(`   - Name: ${user.name}`);
    console.log(`   - ID: ${user.id}\n`);

    // Test 2: Get user's projects
    console.log('Test 2: Get Your Projects');
    console.log('-------------------------');
    const projects = await api.Projects.all({
      membership: true,
      simple: true,
      perPage: 10
    });

    console.log(`✅ Found ${projects.length} accessible projects:\n`);

    if (projects.length === 0) {
      console.log('   ℹ️  You have no projects yet.');
      console.log('   Create a test project on GitLab to test further.\n');
    } else {
      projects.slice(0, 5).forEach((project: any, i: number) => {
        console.log(`   ${i + 1}. ${project.path_with_namespace}`);
        console.log(`      - Visibility: ${project.visibility}`);
        console.log(`      - URL: ${project.web_url}\n`);
      });

      console.log('To test with one of your projects, use:');
      const firstProject = projects[0] as any;
      const [owner, ...repoParts] = firstProject.path_with_namespace.split('/');
      const repo = repoParts.join('/');
      console.log(`   Owner: "${owner}"`);
      console.log(`   Repo: "${repo}"\n`);
    }

    // Test 3: Get a known public project
    console.log('Test 3: Access Public Project');
    console.log('-----------------------------');
    try {
      const publicProject = await api.Projects.show('gitlab-examples/nodejs');
      console.log('✅ Can access public projects:');
      console.log(`   - Name: ${publicProject.name}`);
      console.log(`   - Path: ${publicProject.path_with_namespace}`);
      console.log(`   - URL: ${publicProject.web_url}\n`);
    } catch (error) {
      console.log('⚠️  Could not access example public project');
      console.log('   This is OK if you are using a self-hosted GitLab instance.\n');
    }

    console.log('================================');
    console.log('🎉 Token verification successful!');
    console.log('================================\n');

    console.log('Next steps:');
    console.log('  1. Update test-gitlab.ts to use one of your projects');
    console.log('  2. Or create a test repository on GitLab');
    console.log('  3. Run: GITLAB_TOKEN=your_token npx ts-node src/__manual_tests__/test-gitlab.ts\n');

  } catch (error) {
    console.error('\n❌ Token verification failed:');
    console.error(error);
    console.log('\nPossible causes:');
    console.log('  - Invalid token');
    console.log('  - Token expired');
    console.log('  - Insufficient permissions');
    console.log('  - Network/API issues\n');
    process.exit(1);
  }
}

testGitLabToken()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
