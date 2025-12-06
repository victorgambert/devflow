/**
 * Soma Spec Engine - Example Usage
 *
 * This file demonstrates how to use the Spec Engine to transform
 * a raw user story into a comprehensive Master Plan.
 *
 * Prerequisites:
 * 1. Set OPENROUTER_API_KEY environment variable
 * 2. Optionally configure model environment variables
 *
 * Run with: npx ts-node example.ts
 */

import { generateSpecification, Phase1Output } from './specEngine';

// Example user story
const userStory = `
As a developer using the Soma Squad AI platform,
I want to be able to upload code repositories from GitHub
so that the AI can analyze my codebase and provide intelligent suggestions.

The feature should:
- Support both public and private repositories
- Handle authentication via GitHub OAuth or personal access tokens
- Parse and index common file types (JS, TS, Python, etc.)
- Store repository metadata in our database
- Trigger initial analysis after successful upload

We need to ensure proper error handling for:
- Invalid repository URLs
- Authentication failures
- Rate limiting from GitHub API
- Large repositories that exceed our storage limits

Performance requirements:
- Repository cloning should complete within 2 minutes for repos under 1GB
- Initial analysis should start within 30 seconds of clone completion
`;

async function main() {
  console.log('='.repeat(60));
  console.log('Soma Spec Engine - Example');
  console.log('='.repeat(60));
  console.log();

  // Check for API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('Error: OPENROUTER_API_KEY environment variable is not set');
    console.error('');
    console.error('To run this example:');
    console.error('  export OPENROUTER_API_KEY=your-api-key');
    console.error('  npx ts-node example.ts');
    process.exit(1);
  }

  console.log('Input User Story:');
  console.log('-'.repeat(40));
  console.log(userStory.trim());
  console.log();

  console.log('Starting specification generation...');
  console.log('This may take a few minutes as multiple LLMs are queried.');
  console.log();

  const startTime = Date.now();

  try {
    const result: Phase1Output = await generateSpecification(userStory);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`Completed in ${duration} seconds`);
    console.log();

    // Display refined user story
    console.log('='.repeat(60));
    console.log('STAGE 1: Refined User Story');
    console.log('='.repeat(60));
    console.log(`Summary: ${result.refined_user_story.summary}`);
    console.log(`Context: ${result.refined_user_story.context}`);
    console.log();
    console.log('Objectives:');
    result.refined_user_story.objectives.forEach((o, i) => {
      console.log(`  ${i + 1}. ${o}`);
    });
    console.log();

    // Stages 2-4 disabled for now
    console.log('='.repeat(60));
    console.log('(Stages 2-4 are currently disabled)');
    console.log('='.repeat(60));

    // Save full output to file
    const outputPath = 'spec-output.json';
    const fs = await import('fs');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\nFull output saved to: ${outputPath}`);
  } catch (error) {
    console.error('Error generating specification:', error);
    process.exit(1);
  }
}

main();
