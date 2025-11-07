/**
 * Verify that callout blocks were added to the Notion page
 */

import { Client } from '@notionhq/client';

async function verifyBlocks() {
  console.log('🔍 Verifying Notion page blocks...\n');

  const apiKey = process.env.NOTION_API_KEY;
  const pageId = process.env.NOTION_PAGE_ID;

  if (!apiKey || !pageId) {
    console.error('❌ Missing NOTION_API_KEY or NOTION_PAGE_ID');
    process.exit(1);
  }

  try {
    const client = new Client({ auth: apiKey });

    // Get all blocks from the page
    const response = await client.blocks.children.list({
      block_id: pageId,
      page_size: 100,
    });

    console.log(`📄 Found ${response.results.length} blocks in the page\n`);

    // Filter and display callout blocks
    const callouts = response.results.filter((block: any) => block.type === 'callout');

    if (callouts.length === 0) {
      console.log('⚠️ No callout blocks found');
      return;
    }

    console.log(`✅ Found ${callouts.length} callout block(s):\n`);

    callouts.forEach((block: any, index: number) => {
      const callout = block.callout;
      const emoji = callout.icon?.emoji || '❓';
      const text = callout.rich_text.map((rt: any) => rt.plain_text).join('');
      const color = callout.color;

      console.log(`${index + 1}. ${emoji} [${color}]`);
      console.log(`   Text: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      console.log('');
    });

    console.log(`\n🔗 View the page at: https://notion.so/${pageId.replace(/-/g, '')}`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyBlocks();
