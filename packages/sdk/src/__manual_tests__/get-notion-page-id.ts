/**
 * Quick script to get a Notion page ID from the database for testing
 */

import { NotionClient } from '../notion/notion.client';

async function getPageId() {
  console.log('🔍 Fetching Notion page IDs...\n');

  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!apiKey || !databaseId) {
    console.error('❌ Missing NOTION_API_KEY or NOTION_DATABASE_ID');
    process.exit(1);
  }

  try {
    const client = new NotionClient({
      apiKey,
      databaseId,
    });

    const tasks = await client.queryTasks({ pageSize: 5 });

    if (tasks.length === 0) {
      console.log('⚠️ No tasks found in database');
      process.exit(0);
    }

    console.log(`✅ Found ${tasks.length} tasks:\n`);
    tasks.forEach((task, index) => {
      console.log(`${index + 1}. ${task.title}`);
      console.log(`   ID: ${task.id}`);
      console.log(`   Status: ${task.status}`);
      console.log(`   URL: https://notion.so/${task.id.replace(/-/g, '')}\n`);
    });

    console.log(`\n💡 Use any of these IDs for testing with:`);
    console.log(`export NOTION_PAGE_ID="${tasks[0].id}"`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

getPageId();
