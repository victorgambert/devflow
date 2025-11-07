import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function inspectDatabase() {
  try {
    const database: any = await notion.databases.retrieve({
      database_id: process.env.NOTION_DATABASE_ID!
    });

    console.log('\n=== NOTION DATABASE SCHEMA ===\n');
    console.log('Database Title:', database.title?.[0]?.plain_text || 'Untitled');
    console.log('\nProperties:');

    for (const [name, prop] of Object.entries(database.properties)) {
      const p = prop as any;
      console.log(`  - ${name}: ${p.type}`);
      if (p.type === 'select' && p.select?.options) {
        console.log(`    Options: ${p.select.options.map((o: any) => o.name).join(', ')}`);
      }
      if (p.type === 'status' && p.status?.options) {
        console.log(`    Statuses: ${p.status.options.map((o: any) => o.name).join(', ')}`);
      }
    }

    console.log('\n=== RAW SCHEMA (JSON) ===\n');
    console.log(JSON.stringify(database.properties, null, 2));

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.body) {
      console.error('Details:', error.body);
    }
  }
}

inspectDatabase();
