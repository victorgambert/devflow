/**
 * Format specification as Markdown for Notion
 */

import { SpecGenerationOutput } from '@soma-squad-ai/common';

export function formatSpecAsMarkdown(spec: SpecGenerationOutput): string {
  const lines: string[] = [];

  // Title
  lines.push('# Technical Specification');
  lines.push('');

  // Architecture
  if (spec.architecture && spec.architecture.length > 0) {
    lines.push('## Architecture Decisions');
    lines.push('');
    spec.architecture.forEach((decision) => {
      lines.push(`- ${decision}`);
    });
    lines.push('');
  }

  // Implementation Steps
  if (spec.implementationSteps && spec.implementationSteps.length > 0) {
    lines.push('## Implementation Steps');
    lines.push('');
    spec.implementationSteps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step}`);
    });
    lines.push('');
  }

  // Testing Strategy
  if (spec.testingStrategy) {
    lines.push('## Testing Strategy');
    lines.push('');
    lines.push(spec.testingStrategy);
    lines.push('');
  }

  // Dependencies
  if (spec.dependencies && spec.dependencies.length > 0) {
    lines.push('## Dependencies');
    lines.push('');
    spec.dependencies.forEach((dep) => {
      lines.push(`- ${dep}`);
    });
    lines.push('');
  }

  // Technical Decisions
  if (spec.technicalDecisions && spec.technicalDecisions.length > 0) {
    lines.push('## Technical Decisions');
    lines.push('');
    spec.technicalDecisions.forEach((decision) => {
      lines.push(`- ${decision}`);
    });
    lines.push('');
  }

  // Risks
  if (spec.risks && spec.risks.length > 0) {
    lines.push('## Risks & Considerations');
    lines.push('');
    spec.risks.forEach((risk) => {
      lines.push(`- ${risk}`);
    });
    lines.push('');
  }

  // Estimated Time
  if (spec.estimatedTime) {
    lines.push('## Estimated Time');
    lines.push('');
    lines.push(`${spec.estimatedTime} minutes`);
    lines.push('');
  }

  return lines.join('\n');
}
