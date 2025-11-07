import { AnthropicProvider } from '../agents/anthropic.provider';

async function testSpecGeneration() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  console.log('\n=== TESTING SPEC GENERATION WITH CLAUDE SONNET 4.0 ===\n');

  const provider = new AnthropicProvider(apiKey, 'claude-sonnet-4-0');

  try {
    const spec = await provider.generateSpec({
      task: {
        title: 'Add a Hello World endpoint',
        description: 'Create a simple HTTP endpoint that returns "Hello World"',
        priority: 'High',
      },
      project: {
        language: 'typescript',
        framework: 'nestjs',
      },
      existingFiles: [],
    });

    console.log('✅ Spec generated successfully!');
    console.log('\nGenerated Spec:');
    console.log(JSON.stringify(spec, null, 2));
  } catch (error: any) {
    console.error('❌ Spec generation failed:');
    console.error(error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
  }
}

testSpecGeneration();
