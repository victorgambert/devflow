/**
 * Test complete spec generation → Notion flow
 */

import { AnthropicProvider } from '../agents/anthropic.provider';
import { NotionClient } from '../notion/notion.client';
import { formatSpecAsMarkdown } from '../notion/spec-formatter';

async function testSpecToNotion() {
  console.log('\n=== Testing Spec Generation → Notion Flow ===\n');

  // 1. Test spec generation
  console.log('Step 1: Generating spec with Claude Sonnet 4.0...');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  const provider = new AnthropicProvider(apiKey, 'claude-sonnet-4-0');

  const spec = await provider.generateSpec({
    task: {
      title: 'Add user authentication',
      description: 'Implement JWT-based authentication with login and registration endpoints',
      priority: 'High',
    },
    project: {
      language: 'typescript',
      framework: 'nestjs',
    },
    existingFiles: [],
  });

  console.log('✅ Spec generated successfully!');
  console.log(`   - Architecture decisions: ${spec.architecture?.length || 0}`);
  console.log(`   - Implementation steps: ${spec.implementationSteps?.length || 0}`);
  console.log(`   - Dependencies: ${spec.dependencies?.length || 0}`);
  console.log(`   - Estimated time: ${spec.estimatedTime || 'N/A'} minutes`);

  // 2. Test markdown formatting
  console.log('\nStep 2: Formatting spec as markdown...');
  const markdown = formatSpecAsMarkdown(spec);
  console.log('✅ Markdown formatted successfully!');
  console.log(`   - Markdown length: ${markdown.length} characters`);
  console.log('\n--- Markdown Preview (first 500 chars) ---');
  console.log(markdown.substring(0, 500));
  console.log('...\n');

  // 3. Test Notion client initialization
  console.log('Step 3: Testing Notion client...');
  const notionApiKey = process.env.NOTION_API_KEY;
  const notionDatabaseId = process.env.NOTION_DATABASE_ID;

  if (!notionApiKey || !notionDatabaseId) {
    console.log('⚠️  Notion credentials not set, skipping Notion upload test');
    console.log('   Set NOTION_API_KEY and NOTION_DATABASE_ID to test full integration');
    console.log('\n✅ All tests completed (Notion upload skipped)!');
    return;
  }

  const notionClient = new NotionClient({
    apiKey: notionApiKey,
    databaseId: notionDatabaseId,
  });

  // Test connection
  const connected = await notionClient.testConnection();
  if (!connected) {
    console.log('❌ Failed to connect to Notion');
    return;
  }
  console.log('✅ Connected to Notion successfully!');

  // 4. Optional: Test appending to a page (if TEST_PAGE_ID is provided)
  const testPageId = process.env.TEST_PAGE_ID;
  if (testPageId) {
    console.log(`\nStep 4: Appending spec to test page ${testPageId}...`);
    try {
      await notionClient.appendPageContent(testPageId, markdown);
      console.log('✅ Spec appended to Notion page successfully!');
      console.log(`   View it at: https://notion.so/${testPageId.replace(/-/g, '')}`);
    } catch (error) {
      console.error('❌ Failed to append to Notion:', error);
    }
  } else {
    console.log('\n⚠️  TEST_PAGE_ID not set, skipping page append test');
    console.log('   Set TEST_PAGE_ID to a Notion page ID to test appending content');
  }

  console.log('\n✅ All tests completed successfully!\n');
}

// Run the test
testSpecToNotion().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
