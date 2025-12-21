/**
 * Refinement Activities - Phase 1 of Three-Phase Agile Workflow
 *
 * Generates backlog refinement to clarify business requirements.
 * Focus: Business context, objectives, questions for PO, complexity estimation
 */

import { createLogger } from '@devflow/common';
import type { RefinementOutput, AgentImage, CouncilSummary } from '@devflow/common';
import { createCodeAgentDriver, loadPrompts, createCouncilService } from '@devflow/sdk';
import { detectTaskType } from './helpers/task-type-detector';
import {
  extractExternalContext,
  formatExternalContextAsMarkdown,
  hasAnyLink,
  type ExternalContextLinks,
} from './context-extraction.activities';

const logger = createLogger('RefinementActivities');

export interface GenerateRefinementInput {
  task: {
    title: string;
    description: string;
    priority: string;
    labels?: string[];
  };
  projectId: string;
  /** External links to Figma, Sentry, GitHub Issues */
  externalLinks?: ExternalContextLinks;
  /** Previous PO answers (from re-run after questions were answered) */
  poAnswers?: Array<{ question: string; answer: string }>;
}

export interface GenerateRefinementOutput {
  refinement: RefinementOutput;
  council?: CouncilSummary;
}

/**
 * Generate refinement for a task using AI
 */
export async function generateRefinement(
  input: GenerateRefinementInput
): Promise<GenerateRefinementOutput> {
  logger.info('Generating refinement', {
    taskTitle: input.task.title,
    projectId: input.projectId,
    hasExternalLinks: !!input.externalLinks && hasAnyLink(input.externalLinks),
    hasPOAnswers: !!input.poAnswers && input.poAnswers.length > 0,
    poAnswersCount: input.poAnswers?.length || 0,
  });

  try {
    // Step 1: Detect task type
    const taskType = detectTaskType(input.task);
    logger.info('Task type detected', { taskType });

    // Step 1.5: Extract external context if links provided
    let externalContextMarkdown = '';
    let figmaImages: AgentImage[] = [];

    if (input.externalLinks && hasAnyLink(input.externalLinks)) {
      logger.info('Extracting external context', { links: input.externalLinks });

      const { context, errors } = await extractExternalContext({
        projectId: input.projectId,
        links: input.externalLinks,
      });

      if (errors.length > 0) {
        logger.warn('Some external context extractions failed', { errors });
      }

      externalContextMarkdown = formatExternalContextAsMarkdown(context);

      // Collect Figma images for vision (if available)
      if (context.figma?.screenshots) {
        figmaImages = context.figma.screenshots
          .filter((s) => s.imageBase64)
          .slice(0, 3) // Limit to 3 images
          .map((s) => ({
            type: 'base64' as const,
            mediaType: 'image/png' as const,
            data: s.imageBase64!,
          }));
      }

      logger.info('External context extracted', {
        hasContext: !!externalContextMarkdown,
        figmaImagesCount: figmaImages.length,
      });
    }

    // Step 1.6: Format PO answers if available
    let poAnswersContext = '';
    if (input.poAnswers && input.poAnswers.length > 0) {
      poAnswersContext = `

---

## 📋 Réponses du Product Owner

Le Product Owner a répondu aux questions précédentes. **Vous DEVEZ intégrer ces réponses dans votre analyse.**

`;
      for (const qa of input.poAnswers) {
        poAnswersContext += `### Question\n> ${qa.question}\n\n`;
        poAnswersContext += `### Réponse du PO\n${qa.answer}\n\n---\n\n`;
      }

      poAnswersContext += `
**⚠️ INSTRUCTIONS IMPORTANTES:**
1. **Intégrez** les réponses ci-dessus dans votre analyse du Business Context et des Objectives
2. **NE RÉPÉTEZ PAS** les questions déjà répondues dans \`questionsForPO\`
3. **Mettez à jour** le scope et les critères d'acceptation en fonction des clarifications reçues
4. Vous pouvez poser de **NOUVELLES questions** uniquement si de nouvelles ambiguïtés apparaissent
5. Si toutes les ambiguïtés sont levées, retournez \`questionsForPO: []\` (tableau vide)

`;
      logger.info('PO answers included in context', { count: input.poAnswers.length });
    }

    // Step 2: Load prompts from markdown files
    const prompts = await loadPrompts('refinement', {
      taskTitle: input.task.title,
      taskDescription: input.task.description || 'No description provided',
      taskPriority: input.task.priority,
      externalContext: externalContextMarkdown + poAnswersContext,
    });

    // Step 3: Generate refinement with AI
    const useCouncil = process.env.ENABLE_COUNCIL === 'true';

    if (useCouncil) {
      logger.info('Using LLM Council for refinement');

      const councilModels = process.env.COUNCIL_MODELS
        ? process.env.COUNCIL_MODELS.split(',').map((m) => m.trim())
        : ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.0-flash-exp'];

      const council = createCouncilService(
        process.env.OPENROUTER_API_KEY || '',
        {
          enabled: true,
          models: councilModels,
          chairmanModel: process.env.COUNCIL_CHAIRMAN_MODEL || 'anthropic/claude-sonnet-4',
          timeout: parseInt(process.env.COUNCIL_TIMEOUT || '120000'),
        }
      );

      const result = await council.deliberate<Omit<RefinementOutput, 'taskType'>>(
        {
          ...prompts,
          images: figmaImages.length > 0 ? figmaImages : undefined,
        },
        parseRefinementResponse
      );

      logger.info('Council refinement complete', {
        topRankedModel: result.summary.topRankedModel,
        agreementLevel: result.summary.agreementLevel,
        councilModels: result.summary.councilModels,
      });

      return {
        refinement: {
          ...result.finalOutput,
          taskType,
        },
        council: result.summary,
      };
    } else {
      // Single model generation
      logger.info('Using single model generation for refinement');

      const agent = createCodeAgentDriver({
        provider: 'openrouter',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
      });

      const response = await agent.generate({
        ...prompts,
        images: figmaImages.length > 0 ? figmaImages : undefined,
      });
      const refinement = parseRefinementResponse(response.content);

      logger.info('Refinement generated successfully', {
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
        hasImages: figmaImages.length > 0,
      });

      return {
        refinement: {
          ...refinement,
          taskType,
        },
      };
    }
  } catch (error) {
    logger.error('Failed to generate refinement', error);
    throw error;
  }
}

/**
 * Parse JSON response from AI into RefinementOutput (without taskType)
 */
function parseRefinementResponse(
  content: string
): Omit<RefinementOutput, 'taskType'> {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : content;

    const parsed = JSON.parse(jsonString);

    return {
      businessContext: parsed.businessContext || '',
      objectives: parsed.objectives || [],
      questionsForPO: parsed.questionsForPO,
      suggestedSplit: parsed.suggestedSplit,
      preliminaryAcceptanceCriteria:
        parsed.preliminaryAcceptanceCriteria || [],
      complexityEstimate: parsed.complexityEstimate || 'M',
    };
  } catch (error) {
    logger.error('Failed to parse refinement response', error as Error, { content });
    throw new Error(
      `Failed to parse refinement JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

