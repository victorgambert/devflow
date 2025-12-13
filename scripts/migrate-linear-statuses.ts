#!/usr/bin/env ts-node
/**
 * Migration Script: Linear Statuses (Legacy → Three-Phase Agile)
 *
 * Migrates Linear issues from legacy single-phase statuses to new three-phase statuses:
 * - "To Spec" → "To Refinement"
 * - "Spec In Progress" → "Refinement In Progress"
 * - "Spec Ready" → "Refinement Ready"
 * - "Spec Failed" → "Refinement Failed"
 *
 * Usage:
 *   # Dry run (preview changes without applying)
 *   LINEAR_API_KEY=xxx npx ts-node scripts/migrate-linear-statuses.ts --dry-run
 *
 *   # Execute migration
 *   LINEAR_API_KEY=xxx npx ts-node scripts/migrate-linear-statuses.ts
 *
 * Environment Variables:
 *   LINEAR_API_KEY - Required: Your Linear API key
 *   LINEAR_TEAM_ID - Optional: Specific team ID to migrate (default: all teams)
 */

import { LinearClient } from '@linear/sdk';

// Status mapping: Legacy → Three-Phase
const STATUS_MAPPING: Record<string, string> = {
  'To Spec': 'To Refinement',
  'Spec In Progress': 'Refinement In Progress',
  'Spec Ready': 'Refinement Ready',
  'Spec Failed': 'Refinement Failed',
};

interface MigrationStats {
  totalIssues: number;
  migratedIssues: number;
  skippedIssues: number;
  errors: number;
  issuesMigrated: Array<{
    id: string;
    identifier: string;
    oldStatus: string;
    newStatus: string;
  }>;
}

async function migrateLinearStatuses(dryRun = false): Promise<MigrationStats> {
  const apiKey = process.env.LINEAR_API_KEY;
  const teamId = process.env.LINEAR_TEAM_ID;

  if (!apiKey) {
    throw new Error('LINEAR_API_KEY environment variable is required');
  }

  const linear = new LinearClient({ apiKey });
  const stats: MigrationStats = {
    totalIssues: 0,
    migratedIssues: 0,
    skippedIssues: 0,
    errors: 0,
    issuesMigrated: [],
  };

  console.log('\n🔍 Scanning Linear for issues with legacy statuses...\n');
  console.log(`Mode: ${dryRun ? '🔎 DRY RUN (no changes will be made)' : '⚡ LIVE MIGRATION'}\n`);

  try {
    // Get all workflow states to find IDs
    const states = await linear.workflowStates();
    const stateMap = new Map<string, string>();

    states.nodes.forEach((state: any) => {
      stateMap.set(state.name, state.id);
    });

    console.log('📋 Available workflow states:');
    states.nodes.forEach((state: any) => {
      console.log(`   - ${state.name} (${state.id})`);
    });
    console.log('');

    // Verify target states exist
    const missingStates: string[] = [];
    Object.values(STATUS_MAPPING).forEach((targetStatus) => {
      if (!stateMap.has(targetStatus)) {
        missingStates.push(targetStatus);
      }
    });

    if (missingStates.length > 0) {
      throw new Error(
        `Target states not found in Linear workflow: ${missingStates.join(', ')}\n` +
          'Please create these states in Linear before running the migration.'
      );
    }

    // Query issues with legacy statuses
    for (const [oldStatus, newStatus] of Object.entries(STATUS_MAPPING)) {
      console.log(`\n🔄 Processing: "${oldStatus}" → "${newStatus}"`);

      const filter: any = {
        state: { name: { eq: oldStatus } },
      };

      if (teamId) {
        filter.team = { id: { eq: teamId } };
      }

      const issues = await linear.issues({ filter });
      const issueList = issues.nodes;

      stats.totalIssues += issueList.length;

      if (issueList.length === 0) {
        console.log(`   ℹ️  No issues found with status "${oldStatus}"`);
        continue;
      }

      console.log(`   📦 Found ${issueList.length} issue(s)`);

      for (const issue of issueList) {
        try {
          if (dryRun) {
            console.log(
              `   🔎 [DRY RUN] Would migrate: ${issue.identifier} - "${issue.title}"`
            );
            stats.migratedIssues++;
            stats.issuesMigrated.push({
              id: issue.id,
              identifier: issue.identifier,
              oldStatus,
              newStatus,
            });
          } else {
            const targetStateId = stateMap.get(newStatus);
            if (!targetStateId) {
              throw new Error(`Target state ID not found for "${newStatus}"`);
            }

            await linear.updateIssue(issue.id, {
              stateId: targetStateId,
            });

            console.log(`   ✅ Migrated: ${issue.identifier} - "${issue.title}"`);
            stats.migratedIssues++;
            stats.issuesMigrated.push({
              id: issue.id,
              identifier: issue.identifier,
              oldStatus,
              newStatus,
            });
          }
        } catch (error) {
          console.error(
            `   ❌ Error migrating ${issue.identifier}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          stats.errors++;
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total issues scanned: ${stats.totalIssues}`);
    console.log(`Issues migrated: ${stats.migratedIssues}`);
    console.log(`Issues skipped: ${stats.skippedIssues}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(60) + '\n');

    if (dryRun && stats.migratedIssues > 0) {
      console.log('💡 This was a dry run. To execute the migration, run without --dry-run flag.\n');
    }

    if (!dryRun && stats.migratedIssues > 0) {
      console.log('✅ Migration completed successfully!\n');
      console.log('Next steps:');
      console.log('1. Verify migrated issues in Linear');
      console.log('2. Update environment variables to use new statuses:');
      console.log('   LINEAR_STATUS_TO_REFINEMENT=To Refinement');
      console.log('   LINEAR_STATUS_TO_USER_STORY=Refinement Ready');
      console.log('   LINEAR_STATUS_TO_PLAN=UserStory Ready\n');
    }

    return stats;
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run migration
migrateLinearStatuses(dryRun)
  .then((stats) => {
    if (stats.errors > 0) {
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
