import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function updateDatabaseSchema() {
  try {
    const databaseId = process.env.NOTION_DATABASE_ID!;

    console.log('\n=== UPDATING NOTION DATABASE SCHEMA ===\n');
    console.log('Database ID:', databaseId);

    // Step 1: Rename properties
    console.log('Step 1: Renaming properties...');
    const response = await notion.databases.update({
      database_id: databaseId,
      properties: {
        // Rename Projets -> Name (title)
        'Projets': {
          name: 'Name',
        } as any,
        // Rename Statut -> Status (select)
        'Statut': {
          name: 'Status',
        } as any,
        // Rename Priorité -> Priority (select)
        'Priorité': {
          name: 'Priority',
        } as any,
        // Rename Développeur -> Assignee (people)
        'Développeur': {
          name: 'Assignee',
        } as any,
        // Rename Type -> Description
        'Type': {
          name: 'Description',
        } as any,
        // Rename Épopée -> Epic (relation)
        'Épopée': {
          name: 'Epic',
        } as any,
        // Rename Estimation (pts) -> Story Points (number)
        'Estimation (pts)': {
          name: 'Story Points',
        } as any,
        // Rename Technologies utilisées -> Labels (multi_select)
        'Technologies utilisées': {
          name: 'Labels',
        } as any,
      },
    });

    console.log('✅ Properties renamed!\n');

    // Step 2: Update Status select options
    console.log('Step 2: Updating Status options...');
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

    // Step 3: Update Priority select options
    console.log('Step 3: Updating Priority options...');
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

    console.log('\n🎉 Database schema fully updated!\n');
    console.log('Properties renamed:');
    console.log('  ✓ Projets → Name');
    console.log('  ✓ Statut → Status');
    console.log('  ✓ Priorité → Priority');
    console.log('  ✓ Développeur → Assignee');
    console.log('  ✓ Type → Description');
    console.log('  ✓ Épopée → Epic');
    console.log('  ✓ Estimation (pts) → Story Points');
    console.log('  ✓ Technologies utilisées → Labels');

    console.log('\nStatus options:');
    console.log('  ✓ To Do, In Progress, In Review, Testing, Done, Blocked, Cancelled');

    console.log('\nPriority options:');
    console.log('  ✓ Low, Medium, High, Critical');

  } catch (error: any) {
    console.error('\n❌ Error updating database schema:', error.message);
    if (error.body) {
      console.error('Details:', JSON.stringify(error.body, null, 2));
    }
  }
}

updateDatabaseSchema();
