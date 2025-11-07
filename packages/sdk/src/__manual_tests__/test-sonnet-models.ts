import axios from 'axios';

// Tous les modèles Sonnet possibles, du plus récent au plus ancien
const SONNET_MODELS = [
  // Claude 4 (si disponible)
  'claude-sonnet-4-0',
  'claude-4-sonnet',

  // Claude 3.5 Sonnet (différentes versions)
  'claude-3-5-sonnet-latest',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-20240620',
  'claude-3-5-sonnet',

  // Claude 3 Sonnet
  'claude-3-sonnet-20240229',
  'claude-3-sonnet',
];

async function testModel(model: string): Promise<{ works: boolean; response?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  try {
    const response = await axios.post(
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
    return { works: true, response: response.data.content[0].text };
  } catch (error: any) {
    return { works: false };
  }
}

async function findBestSonnetModel() {
  console.log('\n=== SEARCHING FOR BEST AVAILABLE SONNET MODEL ===\n');

  for (const model of SONNET_MODELS) {
    process.stdout.write(`Testing ${model}... `);
    const result = await testModel(model);

    if (result.works) {
      console.log(`✅ WORKS!`);
      console.log(`   Response: "${result.response}"`);
      console.log(`\n🎉 BEST AVAILABLE MODEL: ${model}\n`);
      return model;
    } else {
      console.log(`❌`);
    }
  }

  console.log('\n❌ No Sonnet models available with this API key\n');
  return null;
}

findBestSonnetModel();
