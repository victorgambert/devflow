/**
 * Manual Test Script for OpenAI Provider
 *
 * Usage:
 *   1. Get an OpenAI API key from: https://platform.openai.com/api-keys
 *   2. Set environment variable: export OPENAI_API_KEY=sk-xxxxxxxxxxxx
 *   3. Run: npx ts-node src/__manual_tests__/test-openai.ts
 */

import 'dotenv/config';
import { OpenAIProvider } from '../agents/openai.provider';

async function testOpenAIProvider() {
  console.log('🤖 OpenAI Provider Manual Test\n');
  console.log('================================\n');

  // Check API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: OPENAI_API_KEY not set in environment');
    console.log('\nPlease set your OpenAI API key:');
    console.log('  export OPENAI_API_KEY=sk-xxxxxxxxxxxx\n');
    console.log('Get your API key from: https://platform.openai.com/api-keys\n');
    process.exit(1);
  }

  console.log('✅ OpenAI API key found\n');

  // Initialize provider
  const openai = new OpenAIProvider(apiKey, 'gpt-4-turbo-preview');
  console.log('✅ OpenAI provider initialized (model: gpt-4-turbo-preview)\n');

  try {
    // Test 1: Simple Generation
    console.log('Test 1: Simple Generation');
    console.log('-------------------------');
    console.log('Prompt: "Write a hello world function in TypeScript"\n');

    const startTime = Date.now();
    const response = await openai.generate({
      system: 'You are a helpful programming assistant.',
      user: 'Write a hello world function in TypeScript. Keep it simple.',
    });
    const duration = Date.now() - startTime;

    console.log('✅ Response received:');
    console.log(`   - Model: ${response.model}`);
    console.log(`   - Duration: ${duration}ms`);
    console.log(`   - Content length: ${response.content.length} chars`);
    console.log('\n   Content preview:');
    console.log('   ' + '-'.repeat(50));
    console.log(response.content.split('\n').slice(0, 10).map(l => `   ${l}`).join('\n'));
    if (response.content.split('\n').length > 10) {
      console.log('   ...');
    }
    console.log('   ' + '-'.repeat(50));
    console.log('');

    // Test 2: Spec Generation
    console.log('Test 2: Spec Generation');
    console.log('-----------------------');
    console.log('Task: "Create a user authentication system"\n');

    const specStartTime = Date.now();
    const spec = await openai.generateSpec({
      task: {
        title: 'User Authentication System',
        description: 'Create a simple user authentication system with login and registration',
        acceptanceCriteria: [
          'Users can register with email and password',
          'Users can login with credentials',
          'Passwords are hashed securely',
          'JWT tokens are issued on login',
        ],
      },
      project: {
        name: 'test-app',
        language: 'typescript',
        framework: 'express',
        description: 'A test application',
      },
    });
    const specDuration = Date.now() - specStartTime;

    console.log('✅ Spec generated:');
    console.log(`   - Duration: ${specDuration}ms`);
    console.log(`   - Overview: ${spec.overview.substring(0, 100)}...`);
    console.log(`   - Steps: ${spec.implementation.steps.length} steps`);
    console.log(`   - Files: ${spec.implementation.files.length} files to create`);
    console.log(`   - Dependencies: ${spec.dependencies.runtime.length} runtime, ${spec.dependencies.dev.length} dev`);
    console.log('\n   Implementation steps:');
    spec.implementation.steps.slice(0, 3).forEach((step, i) => {
      console.log(`   ${i + 1}. ${step}`);
    });
    if (spec.implementation.steps.length > 3) {
      console.log(`   ... and ${spec.implementation.steps.length - 3} more steps`);
    }
    console.log('');

    // Test 3: Code Generation (Simple)
    console.log('Test 3: Code Generation');
    console.log('-----------------------');
    console.log('Generating: User model class\n');

    const codeStartTime = Date.now();
    const code = await openai.generateCode({
      task: {
        title: 'User Model',
        description: 'Create a User model class',
        acceptanceCriteria: ['Has id, email, and password fields'],
      },
      spec: {
        overview: 'Create a User model',
        architecture: {
          pattern: 'Class-based',
          components: ['User class'],
          dataFlow: 'Simple CRUD',
        },
        implementation: {
          approach: 'TypeScript class',
          steps: ['Create User class with properties'],
          files: ['user.model.ts'],
          coreLogic: 'Define User interface and class',
        },
        risks: [],
        dependencies: { runtime: [], dev: [] },
      },
      project: {
        name: 'test-app',
        language: 'typescript',
        framework: 'express',
        description: 'Test app',
      },
    });
    const codeDuration = Date.now() - codeStartTime;

    console.log('✅ Code generated:');
    console.log(`   - Duration: ${codeDuration}ms`);
    console.log(`   - Files: ${code.files.length} file(s)`);
    code.files.forEach((file, i) => {
      console.log(`\n   File ${i + 1}: ${file.path}`);
      console.log(`   - Action: ${file.action}`);
      console.log(`   - Content length: ${file.content.length} chars`);
      console.log(`   - Reason: ${file.reason}`);
    });
    console.log('');

    // Summary
    console.log('================================');
    console.log('🎉 All tests passed!');
    console.log('================================\n');
    console.log('OpenAI provider is working correctly! ✅\n');
    console.log('Performance Summary:');
    console.log(`  - Simple generation: ${duration}ms`);
    console.log(`  - Spec generation: ${specDuration}ms`);
    console.log(`  - Code generation: ${codeDuration}ms`);
    console.log(`  - Total: ${duration + specDuration + codeDuration}ms\n`);

    console.log('You can now use OpenAI with DevFlow:\n');
    console.log('  const openai = new OpenAIProvider(apiKey);');
    console.log('  const spec = await openai.generateSpec(input);\n');

    // Cost estimate
    const totalTokensEstimate = 2000; // Rough estimate
    const costEstimate = (totalTokensEstimate / 1000) * 0.01; // Input + output
    console.log(`Estimated cost for this test: $${costEstimate.toFixed(4)}\n`);

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    console.log('\nPossible causes:');
    console.log('  - Invalid OpenAI API key');
    console.log('  - Insufficient credits/quota');
    console.log('  - Network/API issues');
    console.log('  - Rate limit exceeded\n');
    process.exit(1);
  }
}

// Run tests
testOpenAIProvider()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
