/**
 * Multi-LLM Specification Generation
 * Generates specs with 4 models in parallel and synthesizes the best result:
 * - Claude Sonnet 4 (architecture & reasoning)
 * - GPT-4 (coding & multimodal)
 * - Gemini 2.0 (fast reasoning)
 * - Perplexity Sonar Pro (web research & best practices)
 */

import { createLogger } from '@devflow/common';
import { createCodeAgentDriver, formatContextForAI } from '@devflow/sdk';
import type { CodebaseContext } from '@devflow/sdk';

const logger = createLogger('SpecMultiLLM');

export interface MultiLLMSpecInput {
  task: any;
  codebaseContext: CodebaseContext;
  specContext: {
    language: string;
    framework?: string;
    dependencies: string[];
    conventions: string[];
    patterns: string[];
  };
}

export interface ModelSpec {
  model: string;
  spec: any;
  score: number;
  reasoning: string;
  summary: string; // 10-line summary of the plan
}

export interface MultiLLMSpecOutput {
  bestSpec: any;
  allSpecs: ModelSpec[];
  synthesis: {
    chosenModel: string;
    reasoning: string;
    detailedExplanation: string;
    agreementScore: number;
    comparisonPoints: string[];
  };
}

const DEFAULT_MODELS = [
  { name: 'anthropic/claude-sonnet-4', weight: 1.0 },      // Best for architecture & reasoning
  { name: 'openai/gpt-4o', weight: 0.9 },                  // Strong coding, multimodal
  { name: 'google/gemini-2.0-flash-exp', weight: 0.85 },   // Fast Google model
  { name: 'perplexity/sonar-pro', weight: 0.95 },          // Web research, best practices
];

/**
 * Generate specs with multiple LLMs in parallel
 */
export async function generateSpecsWithMultiLLM(
  input: MultiLLMSpecInput,
): Promise<MultiLLMSpecOutput> {
  logger.info('Starting multi-LLM spec generation');

  // Step 1: Generate specs in parallel with all models
  const specPromises = DEFAULT_MODELS.map(async ({ name, weight }) => {
    try {
      logger.info(`Generating spec with ${name}`);

      const agent = createCodeAgentDriver({
        provider: 'openrouter',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        model: name,
      });

      const spec = await agent.generateSpec({
        task: {
          title: input.task.title,
          description: input.task.description,
          priority: input.task.priority,
        },
        project: {
          language: input.specContext.language,
          framework: input.specContext.framework,
          dependencies: input.specContext.dependencies,
          conventions: input.specContext.conventions,
          patterns: input.specContext.patterns,
        },
        codebaseContext: formatContextForAI(input.codebaseContext),
      });

      // Score the spec based on completeness and quality
      const score = scoreSpec(spec, input.codebaseContext) * weight;

      // Generate summary of this plan
      const summary = generateSpecSummary(spec, name);

      logger.info(`Spec generated with ${name}`, { score });

      return {
        model: name,
        spec,
        score,
        reasoning: `Generated with ${name}, score: ${score.toFixed(2)}`,
        summary,
      };
    } catch (error) {
      logger.error(`Failed to generate spec with ${name}`, error as Error);
      return {
        model: name,
        spec: null,
        score: 0,
        reasoning: `Failed: ${(error as Error).message}`,
        summary: `❌ **Échec de génération:** ${(error as Error).message}`,
      };
    }
  });

  const allSpecs = await Promise.all(specPromises);

  // Filter out failed specs
  const validSpecs = allSpecs.filter((s) => s.spec !== null);

  if (validSpecs.length === 0) {
    throw new Error('All LLM models failed to generate specs');
  }

  // Step 2: Choose the best spec
  const bestSpecResult = validSpecs.reduce((best, current) =>
    current.score > best.score ? current : best,
  );

  // Step 3: Calculate agreement score
  const agreementScore = calculateAgreementScore(validSpecs);

  // Step 4: Generate detailed explanation of the choice
  const { detailedExplanation, comparisonPoints } = generateChoiceExplanation(
    validSpecs,
    bestSpecResult,
    agreementScore,
  );

  logger.info('Multi-LLM generation completed', {
    bestModel: bestSpecResult.model,
    bestScore: bestSpecResult.score,
    agreementScore,
  });

  return {
    bestSpec: bestSpecResult.spec,
    allSpecs: validSpecs,
    synthesis: {
      chosenModel: bestSpecResult.model,
      reasoning: `Selected ${bestSpecResult.model} with score ${bestSpecResult.score.toFixed(2)}. Agreement across models: ${(agreementScore * 100).toFixed(0)}%`,
      detailedExplanation,
      agreementScore,
      comparisonPoints,
    },
  };
}

/**
 * Score a spec based on completeness and quality
 */
function scoreSpec(spec: any, context: CodebaseContext): number {
  let score = 0;

  // Check required fields (40 points)
  if (spec.architecture && Array.isArray(spec.architecture) && spec.architecture.length > 0) {
    score += 10;
  }
  if (
    spec.implementationSteps &&
    Array.isArray(spec.implementationSteps) &&
    spec.implementationSteps.length > 0
  ) {
    score += 10;
  }
  if (spec.testingStrategy && typeof spec.testingStrategy === 'string') {
    score += 10;
  }
  if (spec.risks && Array.isArray(spec.risks) && spec.risks.length > 0) {
    score += 10;
  }

  // Check for codebase-specific references (30 points)
  const specText = JSON.stringify(spec).toLowerCase();
  const language = context.structure.language.toLowerCase();
  const framework = context.structure.framework?.toLowerCase() || '';

  if (specText.includes(language)) {
    score += 10;
  }
  if (framework && specText.includes(framework)) {
    score += 10;
  }

  // Check if mentions existing files or patterns (10 points)
  const mentionsFiles = context.similarCode.some((code) =>
    specText.includes(code.path.toLowerCase()),
  );
  if (mentionsFiles) {
    score += 10;
  }

  // Check implementation steps quality (20 points)
  if (spec.implementationSteps && spec.implementationSteps.length >= 3) {
    score += 10; // At least 3 steps
  }
  if (spec.implementationSteps && spec.implementationSteps.length >= 5) {
    score += 10; // Detailed plan with 5+ steps
  }

  // Check for estimated time (10 points)
  if (spec.estimatedTime && typeof spec.estimatedTime === 'number') {
    score += 10;
  }

  return score;
}

/**
 * Calculate agreement score between different specs
 */
function calculateAgreementScore(specs: ModelSpec[]): number {
  if (specs.length < 2) return 1.0;

  // Simple agreement: compare step counts
  const stepCounts = specs.map((s) => s.spec.implementationSteps?.length || 0);
  const avgSteps = stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length;
  const variance =
    stepCounts.reduce((sum, count) => sum + Math.pow(count - avgSteps, 2), 0) / stepCounts.length;

  // Lower variance = higher agreement
  const agreement = Math.max(0, 1 - variance / 100);

  return agreement;
}

/**
 * Generate a 10-line summary of a spec
 */
function generateSpecSummary(spec: any, modelName: string): string {
  const lines: string[] = [];
  const shortName = modelName.split('/')[1] || modelName;

  lines.push(`**${shortName}** propose:`);
  lines.push('');

  // Architecture decisions (max 2 lines)
  if (spec.architecture && spec.architecture.length > 0) {
    lines.push(`🏗️ **Architecture:** ${spec.architecture.slice(0, 2).join(', ')}`);
  }

  // Key implementation steps (max 4 lines)
  if (spec.implementationSteps && spec.implementationSteps.length > 0) {
    lines.push('');
    lines.push('📋 **Étapes clés:**');
    spec.implementationSteps.slice(0, 3).forEach((step: string, i: number) => {
      lines.push(`${i + 1}. ${step.substring(0, 100)}${step.length > 100 ? '...' : ''}`);
    });
  }

  // Testing strategy (1 line)
  if (spec.testingStrategy) {
    lines.push('');
    lines.push(
      `🧪 **Tests:** ${spec.testingStrategy.substring(0, 80)}${spec.testingStrategy.length > 80 ? '...' : ''}`,
    );
  }

  // Time estimate (1 line)
  if (spec.estimatedTime) {
    lines.push(`⏱️ **Temps estimé:** ${spec.estimatedTime} minutes`);
  }

  return lines.join('\n');
}

/**
 * Generate detailed explanation of why a spec was chosen
 */
function generateChoiceExplanation(
  allSpecs: ModelSpec[],
  winner: ModelSpec,
  agreementScore: number,
): { detailedExplanation: string; comparisonPoints: string[] } {
  const comparisonPoints: string[] = [];
  const sortedSpecs = [...allSpecs].sort((a, b) => b.score - a.score);

  // Compare winner with others
  sortedSpecs.forEach((spec) => {
    if (spec.model === winner.model) {
      comparisonPoints.push(
        `✅ **${spec.model.split('/')[1]}** (Score: ${spec.score.toFixed(1)}/100) - Choisi comme meilleur`,
      );
    } else {
      const diff = winner.score - spec.score;
      comparisonPoints.push(
        `• **${spec.model.split('/')[1]}** (Score: ${spec.score.toFixed(1)}/100) - ${diff.toFixed(1)} points de moins`,
      );
    }
  });

  // Generate detailed explanation
  const explanation = `Le modèle **${winner.model.split('/')[1]}** a été sélectionné avec un score de **${winner.score.toFixed(1)}/100**.

**Critères de sélection:**
- Complétude de la spec (architecture, étapes, tests, risques)
- Références au contexte du projet (langage, framework, fichiers)
- Qualité et détail des étapes d'implémentation
- Estimation de temps fournie

**Accord entre modèles:** ${(agreementScore * 100).toFixed(0)}% des modèles convergent sur une approche similaire${agreementScore > 0.8 ? ' 🎯' : agreementScore > 0.6 ? ' ⚠️' : ' ❌'}.

${agreementScore > 0.8 ? 'Les 3 modèles sont en fort accord, ce qui renforce la confiance dans cette approche.' : agreementScore > 0.6 ? 'Les modèles montrent quelques divergences, mais convergent sur les éléments principaux.' : 'Les modèles proposent des approches assez différentes. Une revue humaine est recommandée.'}`;

  return { detailedExplanation: explanation, comparisonPoints };
}
