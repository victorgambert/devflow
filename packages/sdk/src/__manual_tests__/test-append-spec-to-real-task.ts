/**
 * Test appending a spec to a real Notion task
 */

import { AnthropicProvider } from '../agents/anthropic.provider';
import { NotionClient } from '../notion/notion.client';
import { formatSpecAsMarkdown } from '../notion/spec-formatter';

async function testAppendSpecToRealTask() {
  console.log('\n=== Testing Spec Append to Real Notion Task ===\n');

  const notionApiKey = process.env.NOTION_API_KEY;
  const notionDatabaseId = process.env.NOTION_DATABASE_ID;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!notionApiKey || !notionDatabaseId || !anthropicApiKey) {
    throw new Error('Missing required environment variables');
  }

  // 1. Connect to Notion and find a task
  console.log('Step 1: Connecting to Notion and finding a task...');
  const notionClient = new NotionClient({
    apiKey: notionApiKey,
    databaseId: notionDatabaseId,
  });

  const tasks = await notionClient.queryTasks({
    pageSize: 1,
  });

  if (tasks.length === 0) {
    console.log('❌ No tasks found in the database');
    return;
  }

  const task = tasks[0];
  console.log('✅ Found task:');
  console.log(`   - ID: ${task.id}`);
  console.log(`   - Title: ${task.title}`);
  console.log(`   - Status: ${task.status}`);
  console.log(`   - Priority: ${task.priority}`);

  // 2. Generate a simple spec
  console.log('\nStep 2: Generating spec...');
  const provider = new AnthropicProvider(anthropicApiKey, 'claude-sonnet-4-0');

  const spec = await provider.generateSpec({
    task: {
      title: task.title,
      description: task.description || 'No description provided',
      priority: task.priority,
    },
    project: {
      language: 'typescript',
      framework: 'nestjs',
    },
    existingFiles: [],
  });

  console.log('✅ Spec generated!');

  // 3. Format as markdown
  console.log('\nStep 3: Formatting as markdown...');
  const markdown = formatSpecAsMarkdown(spec);
  console.log('✅ Formatted as markdown');
  console.log(`   - Length: ${markdown.length} characters`);

  // 4. Append to Notion page
  console.log(`\nStep 4: Appending spec to Notion page ${task.id}...`);
  try {
    await notionClient.appendPageContent(task.id, markdown);
    console.log('✅ Spec appended successfully!');
    console.log(`\n🎉 View the updated task in Notion:`);
    console.log(`   https://notion.so/${task.id.replace(/-/g, '')}\n`);
  } catch (error: any) {
    console.error('❌ Failed to append spec:', error.message);
    if (error.body) {
      console.error('   Error details:', JSON.stringify(error.body, null, 2));
    }
    throw error;
  }
}

// Run the test
testAppendSpecToRealTask().catch((error) => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});
