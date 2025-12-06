/**
 * Comparator & Synthesizer Prompt Template
 * Stage 4: Synthesize all inputs into the final Master Plan
 */

import { Message } from '../types/openrouter.types';
import { RefinedUserStory, MultiLLMPlan, ResearchInsights } from '../types/spec.types';

/**
 * Build the prompt messages for synthesizing the master plan
 *
 * @param refinedStory - Structured user story from Stage 1
 * @param plans - Implementation plans from Stage 2
 * @param research - Research insights from Stage 3
 * @returns Array of messages for the LLM
 */
export function buildComparatorSynthesizerPrompt(
  refinedStory: RefinedUserStory,
  plans: MultiLLMPlan[],
  research: ResearchInsights
): Message[] {
  const plansFormatted = plans
    .map(
      (p) => `
### ${p.model}
**Architecture:** ${p.architecture_overview}

**Technical Steps:**
${p.technical_steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

**Tradeoffs:**
${p.tradeoffs.map((t) => `- ${t}`).join('\n')}

**Risks & Unknowns:**
${p.risks_and_unknowns.map((r) => `- ${r}`).join('\n')}

**Implementation Notes:**
${p.implementation_notes.map((n) => `- ${n}`).join('\n')}
`
    )
    .join('\n---\n');

  return [
    {
      role: 'system',
      content: `You are a principal software architect synthesizing multiple implementation plans into a definitive Master Plan. Analyze all inputs, compare approaches, and create a comprehensive, actionable specification.

Return your response as valid JSON matching this exact structure:
{
  "summary": "Executive summary of the Master Plan",
  "recommended_architecture": "Detailed architecture recommendation with clear rationale for choices made",
  "detailed_steps": ["Step 1: Comprehensive description with sub-tasks", "Step 2: Description"],
  "key_decisions": ["Decision 1: What was decided and why", "Decision 2: Explanation"],
  "acceptance_criteria": ["Refined AC 1: Specific and testable", "Refined AC 2"],
  "dependencies": ["Dependency 1 with version/specifics if applicable", "Dependency 2"],
  "risks_and_mitigations": ["Risk 1 -> Specific mitigation approach", "Risk 2 -> Mitigation"],
  "open_questions": ["Question 1 to resolve before implementation", "Question 2"],
  "checklist_before_dev": ["Prerequisite 1", "Setup step 2", "Validation item 3"]
}

Guidelines:
- Synthesize the best elements from all submitted plans
- Resolve conflicts between different approaches with clear reasoning
- Prioritize practical, maintainable solutions
- Ensure steps are sequenced logically for implementation
- Make acceptance criteria specific and testable
- Address all identified risks with concrete mitigations
- Keep the checklist actionable and comprehensive`,
    },
    {
      role: 'user',
      content: `Synthesize the following inputs into a definitive Master Plan:

## Original User Story (Refined)

**Summary:** ${refinedStory.summary}

**Context:** ${refinedStory.context}

**Objectives:**
${refinedStory.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

**Constraints:**
${refinedStory.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}

**Original Acceptance Criteria:**
${refinedStory.acceptance_criteria.map((ac, i) => `${i + 1}. ${ac}`).join('\n')}

**Known Risks:**
${refinedStory.risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---

## Implementation Plans from Multiple LLMs
${plansFormatted}

---

## Research Insights

**Best Practices:**
${research.best_practices.map((bp) => `- ${bp}`).join('\n')}

**Applicable Patterns:**
${research.patterns.map((p) => `- ${p}`).join('\n')}

**Pitfalls to Avoid:**
${research.pitfalls.map((p) => `- ${p}`).join('\n')}

**Benchmarks:**
${research.benchmarks.map((b) => `- ${b}`).join('\n')}

**Recommendations:**
${research.recommendations.map((r) => `- ${r}`).join('\n')}

---

Create a definitive Master Plan that:
1. Selects the best architecture approach with clear rationale
2. Provides detailed, sequenced implementation steps
3. Documents key technical decisions with justifications
4. Refines acceptance criteria for testability
5. Lists all dependencies with specifics
6. Maps each risk to concrete mitigations
7. Identifies open questions requiring resolution before implementation
8. Provides a comprehensive pre-development checklist`,
    },
  ];
}
