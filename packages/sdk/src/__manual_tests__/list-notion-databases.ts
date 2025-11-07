/**
 * Script to list all accessible Notion databases
 *
 * Usage:
 * NOTION_API_KEY="your-key" npx ts-node src/__manual_tests__/list-notion-databases.ts
 */

import { Client } from '@notionhq/client';

async function main() {
  const apiKey = process.env.NOTION_API_KEY;

  if (!apiKey) {
    console.error('❌ Missing required environment variable: NOTION_API_KEY');
    process.exit(1);
  }

  console.log('🔍 Searching for accessible Notion databases...\n');

  try {
    const notion = new Client({ auth: apiKey });

    // Search for all databases
    const response = await notion.search({
      filter: {
        property: 'object',
        value: 'database',
      },
      page_size: 100,
    });

    if (response.results.length === 0) {
      console.log('⚠️  No databases found.');
      console.log('');
      console.log('💡 Make sure you have:');
      console.log('   1. Created a Notion integration at https://www.notion.so/my-integrations');
      console.log('   2. Shared your databases with the integration');
      console.log('   3. Used the correct API key (Internal Integration Token)');
      process.exit(0);
    }

    console.log(`✅ Found ${response.results.length} database(s):\n`);

    response.results.forEach((db: any, index: number) => {
      const title = db.title?.[0]?.plain_text || '(Untitled)';
      const id = db.id.replace(/-/g, '');
      const url = db.url;
      const lastEditedTime = new Date(db.last_edited_time).toLocaleString();

      console.log(`${index + 1}. 📊 ${title}`);
      console.log(`   ID (with dashes):    ${db.id}`);
      console.log(`   ID (without dashes): ${id}`);
      console.log(`   URL:                 ${url}`);
      console.log(`   Last edited:         ${lastEditedTime}`);

      // Show properties
      if (db.properties) {
        console.log('   Properties:');
        Object.entries(db.properties).forEach(([name, prop]: [string, any]) => {
          console.log(`     - ${name} (${prop.type})`);
        });
      }
      console.log('');
    });

    console.log('💡 To use a database with DevFlow:');
    console.log('   NOTION_DATABASE_ID="<ID without dashes>"');
    console.log('');
    console.log('💡 To add the Specification status to a database:');
    console.log('   NOTION_API_KEY="..." NOTION_DATABASE_ID="<ID>" npx ts-node src/__manual_tests__/add-specification-status.ts');

  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }
}

main();
