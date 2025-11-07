import axios from 'axios';

const MODELS_TO_TEST = [
  // Claude 3.5 Sonnet (latest)
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-20240620',

  // Claude 3 Opus
  'claude-3-opus-20240229',

  // Claude 3 Sonnet
  'claude-3-sonnet-20240229',

  // Claude 3 Haiku
  'claude-3-haiku-20240307',
];

async function testModel(model: string): Promise<boolean> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  try {
    await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
          'anthropic-version': '2023-06-01',
        },
      },
    );
    return true;
  } catch {
    return false;
  }
}

async function testAllModels() {
  console.log('\n=== TESTING ALL CLAUDE MODELS ===\n');

  for (const model of MODELS_TO_TEST) {
    const works = await testModel(model);
    console.log(`${works ? '✅' : '❌'} ${model}`);
  }

  console.log('\n');
}

testAllModels();
