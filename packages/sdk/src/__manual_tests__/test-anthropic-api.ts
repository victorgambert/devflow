import axios from 'axios';

async function testAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  console.log('\n=== TESTING ANTHROPIC API ===\n');
  console.log('API Key:', apiKey?.substring(0, 20) + '...');

  try {
    // Test with the default model
    console.log('\nTest 1: claude-3-5-sonnet-20241022');
    const response1 = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: 'Say "Hello from DevFlow!"',
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
          'anthropic-version': '2023-06-01',
        },
      },
    );

    console.log('✅ SUCCESS with claude-3-5-sonnet-20241022');
    console.log('Response:', response1.data.content[0].text);
  } catch (error: any) {
    console.log('❌ FAILED with claude-3-5-sonnet-20241022');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data);

    // Try with an older model
    try {
      console.log('\nTest 2: claude-3-5-sonnet-20240620');
      const response2 = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: 'Say "Hello from DevFlow!"',
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey!,
            'anthropic-version': '2023-06-01',
          },
        },
      );

      console.log('✅ SUCCESS with claude-3-5-sonnet-20240620');
      console.log('Response:', response2.data.content[0].text);
    } catch (error2: any) {
      console.log('❌ FAILED with claude-3-5-sonnet-20240620');
      console.log('Status:', error2.response?.status);
      console.log('Error:', error2.response?.data);

      // Try with claude-3-opus
      try {
        console.log('\nTest 3: claude-3-opus-20240229');
        const response3 = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: 'claude-3-opus-20240229',
            max_tokens: 100,
            messages: [
              {
                role: 'user',
                content: 'Say "Hello from DevFlow!"',
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey!,
              'anthropic-version': '2023-06-01',
            },
          },
        );

        console.log('✅ SUCCESS with claude-3-opus-20240229');
        console.log('Response:', response3.data.content[0].text);
      } catch (error3: any) {
        console.log('❌ FAILED with claude-3-opus-20240229');
        console.log('Status:', error3.response?.status);
        console.log('Error:', error3.response?.data);
      }
    }
  }
}

testAnthropic();
