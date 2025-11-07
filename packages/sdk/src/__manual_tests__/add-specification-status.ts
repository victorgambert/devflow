/**
 * Script to add "Specification" status to Notion database
 *
 * Usage:
 * NOTION_API_KEY="your-key" NOTION_DATABASE_ID="your-db-id" npx ts-node src/__manual_tests__/add-specification-status.ts
 */

import { NotionClient } from '../notion/notion.client';

async function main() {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!apiKey || !databaseId) {
    console.error('❌ Missing required environment variables:');
    console.error('   NOTION_API_KEY and NOTION_DATABASE_ID');
    process.exit(1);
  }

  console.log('🔄 Adding "Specification" status to Notion database...');
  console.log(`   Database ID: ${databaseId.substring(0, 10)}...`);

  try {
    const client = new NotionClient({
      apiKey,
      databaseId,
    });

    // Test connection first
    console.log('🔍 Testing connection...');
    const canConnect = await client.testConnection();

    if (!canConnect) {
      console.error('❌ Failed to connect to Notion');
      process.exit(1);
    }

    console.log('✅ Connected to Notion');

    // Get current schema
    console.log('🔍 Getting current database schema...');
    const schema = await client.getDatabaseSchema();
    const properties = (schema as any).properties;

    console.log('📋 Current database properties:');
    Object.keys(properties).forEach((key) => {
      const prop = properties[key];
      console.log(`   - ${key} (${prop.type})`);
    });

    // Add "Specification" status
    console.log('\n🔄 Adding "Specification" status option...');
    await client.addStatusOption('Specification', 'purple');

    console.log('✅ Successfully added "Specification" status to Notion database!');
    console.log('');
    console.log('📝 You can now use "Specification" as a status in your tasks.');
    console.log('   When a task moves to "Specification" status, DevFlow will automatically');
    console.log('   generate the technical specification.');

  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();
