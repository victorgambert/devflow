import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function cleanupOptions() {
  try {
    const databaseId = process.env.NOTION_DATABASE_ID!;

    console.log('\n=== CLEANING UP NOTION OPTIONS ===\n');

    // Step 1: Get all pages and check for any French values
    console.log('Step 1: Checking for any remaining French values...');
    const response = await notion.databases.query({
      database_id: databaseId,
    });

    const frenchStatusPages: string[] = [];
    const frenchPriorityPages: string[] = [];

    for (const page of response.results) {
      if (page.object !== 'page' || !('properties' in page)) continue;

      const properties: any = page.properties;
      const status = properties.Status?.select?.name;
      const priority = properties.Priority?.select?.name;

      // Check for French status values
      if (status && ['Pas commencé', 'En cours', 'Terminé 🙌', 'Test'].includes(status)) {
        frenchStatusPages.push(page.id);
        console.log(`  ⚠️  Found French status "${status}" on page ${page.id}`);
      }

      // Check for French priority values
      if (priority && ['P1 🔥', 'P2', 'P3', 'P4', 'P5'].includes(priority)) {
        frenchPriorityPages.push(page.id);
        console.log(`  ⚠️  Found French priority "${priority}" on page ${page.id}`);
      }
    }

    if (frenchStatusPages.length === 0 && frenchPriorityPages.length === 0) {
      console.log('✅ No French values found!\n');
    } else {
      console.log(`\n⚠️  Found ${frenchStatusPages.length} pages with French status`);
      console.log(`⚠️  Found ${frenchPriorityPages.length} pages with French priority\n`);
    }

    // Step 2: Get current schema
    console.log('Step 2: Getting current database schema...');
    const database: any = await notion.databases.retrieve({
      database_id: databaseId,
    });

    const statusOptions = database.properties.Status?.select?.options || [];
    const priorityOptions = database.properties.Priority?.select?.options || [];

    console.log('\nCurrent Status options:');
    statusOptions.forEach((opt: any) => console.log(`  - ${opt.name}`));

    console.log('\nCurrent Priority options:');
    priorityOptions.forEach((opt: any) => console.log(`  - ${opt.name}`));

    // Step 3: Identify which options to keep
    const desiredStatusOptions = ['To Do', 'In Progress', 'In Review', 'Testing', 'Done', 'Blocked', 'Cancelled'];
    const desiredPriorityOptions = ['Low', 'Medium', 'High', 'Critical'];

    const statusOptionsToRemove = statusOptions
      .map((opt: any) => opt.name)
      .filter((name: string) => !desiredStatusOptions.includes(name));

    const priorityOptionsToRemove = priorityOptions
      .map((opt: any) => opt.name)
      .filter((name: string) => !desiredPriorityOptions.includes(name));

    console.log('\n\nStep 3: Options to remove:');
    if (statusOptionsToRemove.length > 0) {
      console.log('Status options to remove:', statusOptionsToRemove.join(', '));
    }
    if (priorityOptionsToRemove.length > 0) {
      console.log('Priority options to remove:', priorityOptionsToRemove.join(', '));
    }

    // Step 4: Since Notion doesn't allow direct deletion of options,
    // we need to recreate the properties with only the desired options
    console.log('\n\nStep 4: Recreating Status property with clean options...');

    // First, rename the old property to a temp name
    await notion.databases.update({
      database_id: databaseId,
      properties: {
        'Status': {
          name: 'Status_OLD',
        } as any,
      },
    });
    console.log('  ✓ Renamed Status to Status_OLD');

    // Create new Status property with only desired options
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
    console.log('  ✓ Created new Status property with clean options');

    // Step 5: Migrate all pages from Status_OLD to Status
    console.log('\n\nStep 5: Migrating pages from Status_OLD to Status...');
    let migratedStatusCount = 0;

    const allPages = await notion.databases.query({
      database_id: databaseId,
    });

    for (const page of allPages.results) {
      if (page.object !== 'page' || !('properties' in page)) continue;

      const properties: any = page.properties;
      const oldStatus = properties.Status_OLD?.select?.name;

      if (oldStatus) {
        const newStatus = oldStatus; // Already using English values from previous migration

        await notion.pages.update({
          page_id: page.id,
          properties: {
            'Status': {
              select: { name: newStatus },
            },
          },
        });

        migratedStatusCount++;
        if (migratedStatusCount % 10 === 0) {
          console.log(`  ... migrated ${migratedStatusCount} pages`);
        }
      }
    }

    console.log(`✅ Migrated ${migratedStatusCount} pages to new Status property`);

    // Step 6: Delete the old Status_OLD property
    console.log('\n\nStep 6: Deleting Status_OLD property...');
    await notion.databases.update({
      database_id: databaseId,
      properties: {
        'Status_OLD': null as any,
      },
    });
    console.log('✅ Deleted Status_OLD property');

    // Step 7: Do the same for Priority
    console.log('\n\nStep 7: Recreating Priority property with clean options...');

    await notion.databases.update({
      database_id: databaseId,
      properties: {
        'Priority': {
          name: 'Priority_OLD',
        } as any,
      },
    });
    console.log('  ✓ Renamed Priority to Priority_OLD');

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
    console.log('  ✓ Created new Priority property with clean options');

    // Step 8: Migrate all pages from Priority_OLD to Priority
    console.log('\n\nStep 8: Migrating pages from Priority_OLD to Priority...');
    let migratedPriorityCount = 0;

    const allPagesForPriority = await notion.databases.query({
      database_id: databaseId,
    });

    for (const page of allPagesForPriority.results) {
      if (page.object !== 'page' || !('properties' in page)) continue;

      const properties: any = page.properties;
      const oldPriority = properties.Priority_OLD?.select?.name;

      if (oldPriority) {
        const newPriority = oldPriority; // Already using English values from previous migration

        await notion.pages.update({
          page_id: page.id,
          properties: {
            'Priority': {
              select: { name: newPriority },
            },
          },
        });

        migratedPriorityCount++;
        if (migratedPriorityCount % 10 === 0) {
          console.log(`  ... migrated ${migratedPriorityCount} pages`);
        }
      }
    }

    console.log(`✅ Migrated ${migratedPriorityCount} pages to new Priority property`);

    // Step 9: Delete the old Priority_OLD property
    console.log('\n\nStep 9: Deleting Priority_OLD property...');
    await notion.databases.update({
      database_id: databaseId,
      properties: {
        'Priority_OLD': null as any,
      },
    });
    console.log('✅ Deleted Priority_OLD property');

    console.log('\n\n🎉 CLEANUP COMPLETED SUCCESSFULLY! 🎉\n');
    console.log('Status property now has only:');
    console.log('  - To Do, In Progress, In Review, Testing, Done, Blocked, Cancelled');
    console.log('\nPriority property now has only:');
    console.log('  - Low, Medium, High, Critical');

  } catch (error: any) {
    console.error('\n❌ Error during cleanup:', error.message);
    if (error.body) {
      console.error('Details:', JSON.stringify(error.body, null, 2));
    }
  }
}

cleanupOptions();
