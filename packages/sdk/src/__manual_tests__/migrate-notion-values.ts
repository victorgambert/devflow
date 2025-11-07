import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const STATUS_MAPPING: Record<string, string> = {
  'Pas commencé': 'To Do',
  'En cours': 'In Progress',
  'Test': 'Testing',
  'Terminé 🙌': 'Done',
};

const PRIORITY_MAPPING: Record<string, string> = {
  'P1 🔥': 'Critical',
  'P2': 'High',
  'P3': 'Medium',
  'P4': 'Low',
  'P5': 'Low',
};

async function migrateValues() {
  try {
    const databaseId = process.env.NOTION_DATABASE_ID!;

    console.log('\n=== MIGRATING NOTION VALUES ===\n');

    // Step 1: Get all pages in the database
    console.log('Step 1: Fetching all pages...');
    const response = await notion.databases.query({
      database_id: databaseId,
    });

    console.log(`Found ${response.results.length} pages\n`);

    // Step 2: Update each page with new status and priority values
    console.log('Step 2: Migrating values...');
    let updatedCount = 0;

    for (const page of response.results) {
      if (page.object !== 'page' || !('properties' in page)) continue;

      const properties: any = page.properties;
      const updates: any = {};
      let needsUpdate = false;

      // Check Status
      const currentStatus = properties.Status?.select?.name;
      if (currentStatus && STATUS_MAPPING[currentStatus]) {
        updates.Status = {
          select: { name: STATUS_MAPPING[currentStatus] },
        };
        needsUpdate = true;
        console.log(`  - Updating status: "${currentStatus}" → "${STATUS_MAPPING[currentStatus]}"`);
      }

      // Check Priority
      const currentPriority = properties.Priority?.select?.name;
      if (currentPriority && PRIORITY_MAPPING[currentPriority]) {
        updates.Priority = {
          select: { name: PRIORITY_MAPPING[currentPriority] },
        };
        needsUpdate = true;
        console.log(`  - Updating priority: "${currentPriority}" → "${PRIORITY_MAPPING[currentPriority]}"`);
      }

      // Update the page if needed
      if (needsUpdate) {
        await notion.pages.update({
          page_id: page.id,
          properties: updates,
        });
        updatedCount++;
      }
    }

    console.log(`\n✅ Migrated ${updatedCount} pages!\n`);

    // Step 3: Add new Status options to the database
    console.log('Step 3: Adding new Status options...');
    await notion.databases.update({
      database_id: databaseId,
      properties: {
        'Status': {
          select: {
            options: [
              { name: 'To Do', color: 'gray' },
              { name: 'In Progress', color: 'blue' },
              { name: 'In Review', color: 'yellow' },
              { name: 'Testing', color: 'orange' },
              { name: 'Done', color: 'green' },
              { name: 'Blocked', color: 'red' },
              { name: 'Cancelled', color: 'gray' },
            ],
          },
        } as any,
      },
    });
    console.log('✅ Status options updated!\n');

    // Step 4: Update Priority options
    console.log('Step 4: Updating Priority options...');
    await notion.databases.update({
      database_id: databaseId,
      properties: {
        'Priority': {
          select: {
            options: [
              { name: 'Low', color: 'gray' },
              { name: 'Medium', color: 'yellow' },
              { name: 'High', color: 'orange' },
              { name: 'Critical', color: 'red' },
            ],
          },
        } as any,
      },
    });
    console.log('✅ Priority options updated!\n');

    console.log('\n🎉 Migration completed successfully!\n');

  } catch (error: any) {
    console.error('\n❌ Error during migration:', error.message);
    if (error.body) {
      console.error('Details:', JSON.stringify(error.body, null, 2));
    }
  }
}

migrateValues();
