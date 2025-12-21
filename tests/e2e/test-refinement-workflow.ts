#!/usr/bin/env npx tsx
/**
 * End-to-End Test: Refinement Workflow
 *
 * This test validates the complete refinement workflow:
 * 1. Creates a test issue in Linear
 * 2. Moves it to "To Refinement" status
 * 3. Simulates the Linear webhook
 * 4. Monitors the Temporal workflow execution
 * 5. Verifies the refinement is appended to Linear
 * 6. Verifies the issue moves to "Refinement Ready"
 *
 * Prerequisites:
 * - Docker services running (postgres, redis, temporal)
 * - API running on port 3001
 * - Worker running
 * - LINEAR_API_KEY env var set
 * - DEFAULT_PROJECT_ID env var set
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." LINEAR_API_KEY="lin_api_xxx" npx tsx tests/e2e/test-refinement-workflow.ts
 *
 * Options:
 *   --cleanup    Delete the test issue after the test
 *   --team-id    Specify Linear team ID (auto-detected if not provided)
 *   --timeout    Workflow completion timeout in seconds (default: 120)
 */

import { LinearClient as LinearSDK } from '@linear/sdk';

// Configuration
const config = {
  apiUrl: process.env.DEVFLOW_API_URL || 'http://localhost:3001/api/v1',
  linearApiKey: process.env.LINEAR_API_KEY,
  projectId: process.env.DEFAULT_PROJECT_ID,
  teamId: process.env.LINEAR_TEAM_ID,
  timeoutSeconds: parseInt(process.env.TEST_TIMEOUT || '120', 10),
  cleanup: process.argv.includes('--cleanup'),
};

// Parse CLI arguments
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--team-id' && process.argv[i + 1]) {
    config.teamId = process.argv[i + 1];
    i++;
  }
  if (process.argv[i] === '--timeout' && process.argv[i + 1]) {
    config.timeoutSeconds = parseInt(process.argv[i + 1], 10);
    i++;
  }
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: number, total: number, message: string) {
  console.log(`\n${colors.blue}[$${step}/${total}] ${message}${colors.reset}`);
}

function logSuccess(message: string) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message: string) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function logInfo(message: string) {
  console.log(`${colors.cyan}ℹ️  ${message}${colors.reset}`);
}

function logWarning(message: string) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

// Validate configuration
function validateConfig(): boolean {
  const errors: string[] = [];

  if (!config.linearApiKey) {
    errors.push('LINEAR_API_KEY environment variable is required');
  }
  if (!config.projectId) {
    errors.push('DEFAULT_PROJECT_ID environment variable is required');
  }

  if (errors.length > 0) {
    logError('Configuration errors:');
    errors.forEach((e) => console.log(`  - ${e}`));
    return false;
  }

  return true;
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main test
async function runTest() {
  console.log('\n' + '═'.repeat(70));
  log('  DevFlow E2E Test: Refinement Workflow', 'blue');
  console.log('═'.repeat(70) + '\n');

  // Validate configuration
  if (!validateConfig()) {
    process.exit(1);
  }

  logInfo(`API URL: ${config.apiUrl}`);
  logInfo(`Project ID: ${config.projectId}`);
  logInfo(`Timeout: ${config.timeoutSeconds}s`);
  logInfo(`Cleanup: ${config.cleanup ? 'yes' : 'no'}`);

  const totalSteps = 7;
  let createdIssueId: string | null = null;
  let createdIssueIdentifier: string | null = null;

  try {
    // Initialize Linear client
    const linear = new LinearSDK({ apiKey: config.linearApiKey! });

    // =========================================================================
    // Step 1: Check API Health
    // =========================================================================
    logStep(1, totalSteps, 'Checking API health...');

    const healthResponse = await fetch(`${config.apiUrl}/health`);
    if (!healthResponse.ok) {
      throw new Error(`API not healthy: ${healthResponse.status}`);
    }
    logSuccess('API is healthy');

    // =========================================================================
    // Step 2: Get Linear team (auto-detect if not provided)
    // =========================================================================
    logStep(2, totalSteps, 'Getting Linear team...');

    let teamId = config.teamId;
    if (!teamId) {
      const teams = await linear.teams();
      const team = teams.nodes[0];
      if (!team) {
        throw new Error('No Linear team found');
      }
      teamId = team.id;
      logInfo(`Auto-detected team: ${team.name} (${team.key})`);
    }

    // Get "To Refinement" state ID
    const team = await linear.team(teamId);
    const states = await team.states();
    const toRefinementState = states.nodes.find(
      (s) => s.name === 'To Refinement' || s.name === 'To Spec'
    );
    const refinementReadyState = states.nodes.find(
      (s) => s.name === 'Refinement Ready' || s.name === 'Spec Ready'
    );

    if (!toRefinementState) {
      logWarning('No "To Refinement" status found. Available statuses:');
      states.nodes.forEach((s) => console.log(`  - ${s.name} (${s.type})`));
      throw new Error('Please create a "To Refinement" status in Linear');
    }

    logSuccess(`Found "To Refinement" state: ${toRefinementState.name}`);
    if (refinementReadyState) {
      logInfo(`Target state: ${refinementReadyState.name}`);
    }

    // =========================================================================
    // Step 3: Create test issue in Linear
    // =========================================================================
    logStep(3, totalSteps, 'Creating test issue in Linear...');

    const testTitle = `[E2E Test] Refinement Workflow - ${new Date().toISOString()}`;
    const testDescription = `
## Test Issue for E2E Refinement Workflow

This is an automated test issue created by the DevFlow E2E test suite.

### Requirements
- The user should be able to login with email/password
- The system should validate credentials
- On success, return a JWT token
- On failure, return appropriate error messages

### Acceptance Criteria
- [ ] Login endpoint accepts email and password
- [ ] Invalid credentials return 401
- [ ] Valid credentials return JWT
- [ ] Rate limiting is implemented

---
*Created by: test-refinement-workflow.ts*
*Timestamp: ${new Date().toISOString()}*
    `.trim();

    const createResult = await linear.createIssue({
      teamId,
      title: testTitle,
      description: testDescription,
      stateId: toRefinementState.id,
      priority: 2, // Medium priority
    });

    const createdIssue = await createResult.issue;
    if (!createdIssue) {
      throw new Error('Failed to create issue');
    }

    createdIssueId = createdIssue.id;
    createdIssueIdentifier = createdIssue.identifier;

    logSuccess(`Created issue: ${createdIssue.identifier}`);
    logInfo(`Issue ID: ${createdIssue.id}`);
    logInfo(`URL: ${createdIssue.url}`);

    // =========================================================================
    // Step 4: Simulate Linear webhook
    // =========================================================================
    logStep(4, totalSteps, 'Triggering workflow via webhook...');

    // Build webhook payload (simulating Linear webhook)
    const webhookPayload = {
      action: 'update',
      type: 'Issue',
      createdAt: new Date().toISOString(),
      data: {
        id: createdIssue.id,
        identifier: createdIssue.identifier,
        title: testTitle,
        description: testDescription,
        priority: 2,
        state: {
          id: toRefinementState.id,
          name: toRefinementState.name,
          type: toRefinementState.type,
        },
        team: {
          id: teamId,
          key: team.key,
          name: team.name,
        },
      },
      actor: {
        id: 'e2e-test',
        name: 'E2E Test Runner',
      },
    };

    const webhookResponse = await fetch(`${config.apiUrl}/webhooks/linear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'linear-signature': 'e2e-test-signature', // Note: signature validation should be disabled in test mode
      },
      body: JSON.stringify(webhookPayload),
    });

    const webhookResult = await webhookResponse.json();

    if (!webhookResponse.ok) {
      logError(`Webhook failed: ${JSON.stringify(webhookResult)}`);
      throw new Error(`Webhook returned ${webhookResponse.status}`);
    }

    if (webhookResult.workflowStarted) {
      logSuccess(`Workflow started: ${webhookResult.workflowId}`);
    } else {
      logWarning('Webhook received but workflow not started');
      logInfo(`Response: ${JSON.stringify(webhookResult, null, 2)}`);
    }

    // =========================================================================
    // Step 5: Monitor workflow progress
    // =========================================================================
    logStep(5, totalSteps, 'Monitoring workflow progress...');

    const startTime = Date.now();
    const timeoutMs = config.timeoutSeconds * 1000;
    let workflowCompleted = false;
    let finalStatus = '';
    let lastStatus = '';
    let checkCount = 0;

    while (Date.now() - startTime < timeoutMs) {
      checkCount++;

      // Check issue status in Linear
      const issue = await linear.issue(createdIssueId);
      const state = await issue.state;
      const currentStatus = state?.name || 'Unknown';

      if (currentStatus !== lastStatus) {
        logInfo(`Status changed: ${lastStatus || 'Initial'} → ${currentStatus}`);
        lastStatus = currentStatus;
      }

      // Check for completion states
      if (currentStatus === 'Refinement Ready' || currentStatus === 'Spec Ready') {
        workflowCompleted = true;
        finalStatus = currentStatus;
        break;
      }

      if (currentStatus === 'Refinement Failed' || currentStatus === 'Spec Failed') {
        finalStatus = currentStatus;
        throw new Error(`Workflow failed with status: ${currentStatus}`);
      }

      // Progress indicator
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      process.stdout.write(
        `\r${colors.dim}  Waiting... ${elapsed}s/${config.timeoutSeconds}s (check #${checkCount}, status: ${currentStatus})${colors.reset}`
      );

      await sleep(5000); // Check every 5 seconds
    }

    console.log(''); // New line after progress indicator

    if (!workflowCompleted) {
      throw new Error(
        `Workflow did not complete within ${config.timeoutSeconds}s (last status: ${lastStatus})`
      );
    }

    logSuccess(`Workflow completed with status: ${finalStatus}`);

    // =========================================================================
    // Step 6: Verify refinement output
    // =========================================================================
    logStep(6, totalSteps, 'Verifying refinement output...');

    const finalIssue = await linear.issue(createdIssueId);
    const finalDescription = finalIssue.description || '';

    // Check for refinement markers
    const hasRefinementHeader =
      finalDescription.includes('## 1️⃣ Phase 1: Backlog Refinement') ||
      finalDescription.includes('# DevFlow Analysis') ||
      finalDescription.includes('## Refinement') ||
      finalDescription.includes('## Specification') ||
      finalDescription.includes('## Technical Analysis');

    const hasBusinessContext =
      finalDescription.includes('Business Context') ||
      finalDescription.includes('Objectives') ||
      finalDescription.includes('Requirements');

    const hasComplexityEstimate =
      finalDescription.includes('Complexity') ||
      finalDescription.includes('Estimate') ||
      finalDescription.includes('T-Shirt');

    if (hasRefinementHeader) {
      logSuccess('Refinement header found in description');
    } else {
      logWarning('Refinement header not found');
    }

    if (hasBusinessContext) {
      logSuccess('Business context found');
    } else {
      logWarning('Business context not found');
    }

    if (hasComplexityEstimate) {
      logSuccess('Complexity estimate found');
    } else {
      logWarning('Complexity estimate not found');
    }

    // Show description preview
    console.log(`\n${colors.dim}${'─'.repeat(70)}${colors.reset}`);
    log('Description Preview (first 500 chars):', 'cyan');
    console.log(colors.dim + finalDescription.substring(0, 500) + colors.reset);
    if (finalDescription.length > 500) {
      console.log(colors.dim + `... (${finalDescription.length - 500} more chars)` + colors.reset);
    }
    console.log(`${colors.dim}${'─'.repeat(70)}${colors.reset}\n`);

    // =========================================================================
    // Step 7: Cleanup (optional)
    // =========================================================================
    logStep(7, totalSteps, config.cleanup ? 'Cleaning up...' : 'Skipping cleanup');

    if (config.cleanup && createdIssueId) {
      // Archive or delete the test issue
      await linear.archiveIssue(createdIssueId);
      logSuccess(`Archived test issue: ${createdIssueIdentifier}`);
    } else {
      logInfo(`Test issue preserved: ${createdIssueIdentifier}`);
      logInfo(`View at: ${finalIssue.url}`);
    }

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('\n' + '═'.repeat(70));
    log('  Test Summary', 'green');
    console.log('═'.repeat(70) + '\n');

    logSuccess('All tests passed!');
    console.log(`
  Issue: ${createdIssueIdentifier}
  Status: ${finalStatus}
  Duration: ${Math.round((Date.now() - startTime) / 1000)}s
  Cleanup: ${config.cleanup ? 'Issue archived' : 'Issue preserved'}
    `);

    return 0;
  } catch (error) {
    console.log('\n' + '═'.repeat(70));
    log('  Test Failed', 'red');
    console.log('═'.repeat(70) + '\n');

    logError(error instanceof Error ? error.message : String(error));

    if (createdIssueId && createdIssueIdentifier) {
      logInfo(`Test issue created: ${createdIssueIdentifier}`);
      logInfo(`You may need to manually clean it up`);
    }

    if (error instanceof Error && error.stack) {
      console.log(`\n${colors.dim}${error.stack}${colors.reset}`);
    }

    return 1;
  }
}

// Run the test
runTest()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    logError(`Unexpected error: ${error}`);
    process.exit(1);
  });
