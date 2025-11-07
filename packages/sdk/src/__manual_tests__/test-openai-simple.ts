/**
 * Simple OpenAI Provider Manual Test
 * Tests basic functionality with correct types
 */

import 'dotenv/config';
import { OpenAIProvider } from '../agents/openai.provider';

async function testOpenAIProvider() {
  console.log('🤖 OpenAI Provider Manual Test (Simple)\n');
  console.log('================================\n');

  // Check API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: OPENAI_API_KEY not set in environment');
    console.log('\nPlease set your OpenAI API key:');
    console.log('  export OPENAI_API_KEY=sk-xxxxxxxxxxxx\n');
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
      system: 'You are a helpful programming assistant. Be concise.',
      user: 'Write a hello world function in TypeScript. Keep it simple and short.',
    });
    const duration = Date.now() - startTime;

    console.log('✅ Response received:');
    console.log(`   - Model: ${response.model}`);
    console.log(`   - Duration: ${duration}ms`);
    console.log(`   - Content length: ${response.content.length} chars`);
    console.log('\n   Content preview:');
    console.log('   ' + '-'.repeat(50));
    const lines = response.content.split('\n').slice(0, 10);
    lines.forEach(line => console.log(`   ${line.substring(0, 70)}`));
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
        priority: 'high',
      },
      project: {
        language: 'typescript',
        framework: 'express',
      },
    });
    const specDuration = Date.now() - specStartTime;

    console.log('✅ Spec generated:');
    console.log(`   - Duration: ${specDuration}ms`);
    console.log(`   - Architecture components: ${spec.architecture.length}`);
    console.log(`   - Implementation steps: ${spec.implementationSteps.length}`);
    console.log(`   - Testing strategy: ${spec.testingStrategy.substring(0, 50)}...`);
    console.log(`   - Risks identified: ${spec.risks.length}`);
    console.log(`   - Estimated time: ${spec.estimatedTime}h`);
    if (spec.dependencies) {
      console.log(`   - Dependencies: ${spec.dependencies.length}`);
    }

    console.log('\n   Architecture:');
    spec.architecture.slice(0, 3).forEach((item, i) => {
      console.log(`   ${i + 1}. ${item}`);
    });
    if (spec.architecture.length > 3) {
      console.log(`   ... and ${spec.architecture.length - 3} more`);
    }

    console.log('\n   Implementation Steps:');
    spec.implementationSteps.slice(0, 3).forEach((step, i) => {
      console.log(`   ${i + 1}. ${step}`);
    });
    if (spec.implementationSteps.length > 3) {
      console.log(`   ... and ${spec.implementationSteps.length - 3} more`);
    }
    console.log('');

    // Test 3: Code Generation (Simple)
    console.log('Test 3: Code Generation');
    console.log('-----------------------');
    console.log('Generating: Simple utility function\n');

    const codeStartTime = Date.now();
    const code = await openai.generateCode({
      task: {
        title: 'UUID Generator',
        description: 'Create a function to generate UUIDs',
      },
      spec,
      projectStructure: 'src/utils/uuid.ts',
      relevantFiles: [],
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

      // Show preview of code
      console.log('\n   Code preview:');
      console.log('   ' + '-'.repeat(50));
      const codeLines = file.content.split('\n').slice(0, 10);
      codeLines.forEach(line => console.log(`   ${line.substring(0, 70)}`));
      if (file.content.split('\n').length > 10) {
        console.log('   ...');
      }
      console.log('   ' + '-'.repeat(50));
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

    // Cost estimate (very rough)
    const estimatedTokens =
      Math.ceil(response.content.length / 4) +
      Math.ceil(JSON.stringify(spec).length / 4) +
      Math.ceil(code.files.reduce((sum, f) => sum + f.content.length, 0) / 4);
    const estimatedCost = (estimatedTokens / 1000) * 0.01; // GPT-4 Turbo pricing
    console.log(`Estimated tokens used: ~${estimatedTokens}`);
    console.log(`Estimated cost for this test: $${estimatedCost.toFixed(4)}\n`);

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
