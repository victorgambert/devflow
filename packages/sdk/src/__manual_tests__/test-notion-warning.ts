/**
 * Manual test for Notion warning callout functionality
 *
 * This script tests the appendCalloutToPage method that adds a warning
 * message to a Notion page after spec generation.
 *
 * Usage:
 *   NOTION_API_KEY="your_key" NOTION_PAGE_ID="page_id" npx ts-node src/__manual_tests__/test-notion-warning.ts
 */

import { NotionClient } from '../notion/notion.client';

async function testNotionWarning() {
  console.log('🧪 Testing Notion Warning Callout...\n');

  const apiKey = process.env.NOTION_API_KEY;
  const pageId = process.env.NOTION_PAGE_ID;
  const databaseId = process.env.NOTION_DATABASE_ID || '';

  if (!apiKey) {
    console.error('❌ Error: NOTION_API_KEY environment variable is required');
    process.exit(1);
  }

  if (!pageId) {
    console.error('❌ Error: NOTION_PAGE_ID environment variable is required');
    console.log('\n💡 Tip: Get a page ID from your Notion database page URL');
    process.exit(1);
  }

  try {
    // Initialize Notion client
    const client = new NotionClient({
      apiKey,
      databaseId,
    });

    console.log(`📄 Target Page ID: ${pageId}\n`);

    // Test 1: Add warning with default message
    console.log('Test 1: Adding warning callout with default message...');
    await client.appendCalloutToPage(
      pageId,
      '⚠️ Les spécifications ont été générées automatiquement par DevFlow.\nLes modifications manuelles ne seront pas prises en compte dans le flux de développement.',
      {
        emoji: '⚠️',
        color: 'yellow_background',
      }
    );
    console.log('✅ Warning callout added successfully!\n');

    // Test 2: Add a custom info callout
    console.log('Test 2: Adding custom info callout...');
    await client.appendCalloutToPage(
      pageId,
      'ℹ️ Ceci est un test de callout personnalisé avec une couleur bleue.',
      {
        emoji: 'ℹ️',
        color: 'blue_background',
      }
    );
    console.log('✅ Custom callout added successfully!\n');

    // Test 3: Add a success callout
    console.log('Test 3: Adding success callout...');
    await client.appendCalloutToPage(
      pageId,
      '✅ Les tests sont passés avec succès !',
      {
        emoji: '✅',
        color: 'green_background',
      }
    );
    console.log('✅ Success callout added successfully!\n');

    console.log('🎉 All tests passed!\n');
    console.log('📝 Check your Notion page to see the callouts.');
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testNotionWarning().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
