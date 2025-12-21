import { promises as fs } from 'fs';
import path from 'path';

interface PromptVariables {
  [key: string]: string | string[] | number | undefined;
}

interface LoadedPrompts {
  system: string;
  user: string;
}

// In-memory cache pour éviter de relire les fichiers à chaque fois
const promptCache = new Map<string, { system: string; user: string }>();

/**
 * Charge les prompts depuis les fichiers markdown et substitue les variables
 * @param phase - Phase du workflow ('refinement', 'user-story', 'technical-plan')
 * @param variables - Variables à substituer dans les templates
 */
export async function loadPrompts(
  phase: 'refinement' | 'user-story' | 'technical-plan',
  variables: PromptVariables
): Promise<LoadedPrompts> {
  // Charger les templates depuis le cache ou les fichiers
  const templates = await getPromptTemplates(phase);

  // Substituer les variables
  const system = substituteVariables(templates.system, variables);
  const user = substituteVariables(templates.user, variables);

  return { system, user };
}

async function getPromptTemplates(
  phase: string
): Promise<{ system: string; user: string }> {
  const cacheKey = phase;

  // Vérifier le cache en développement (désactivé en dev pour hot reload)
  if (process.env.NODE_ENV === 'production' && promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey)!;
  }

  // Charger depuis les fichiers
  // Note: __dirname is /dist/agents/prompts, phase directories are at the same level
  const promptsDir = path.join(__dirname, phase);
  const systemPath = path.join(promptsDir, 'system.md');
  const userPath = path.join(promptsDir, 'user.md');

  const [system, user] = await Promise.all([
    fs.readFile(systemPath, 'utf-8'),
    fs.readFile(userPath, 'utf-8'),
  ]);

  const templates = { system, user };

  // Mettre en cache en production
  if (process.env.NODE_ENV === 'production') {
    promptCache.set(cacheKey, templates);
  }

  return templates;
}

function substituteVariables(
  template: string,
  variables: PromptVariables
): string {
  let result = template;

  // Substituer chaque variable {{varName}}
  for (const [key, value] of Object.entries(variables)) {
    if (value === undefined || value === null) continue;

    const placeholder = `{{${key}}}`;

    // Convertir les arrays en string formaté
    const stringValue = Array.isArray(value) ? value.join(', ') : String(value);

    result = result.replace(new RegExp(placeholder, 'g'), stringValue);
  }

  // Vérifier s'il reste des variables non substituées
  const remainingVars = result.match(/\{\{(\w+)\}\}/g);
  if (remainingVars && remainingVars.length > 0) {
    console.warn(
      `Warning: Unsubstituted variables in prompt: ${remainingVars.join(', ')}`
    );
  }

  return result;
}

/**
 * Vider le cache (utile pour les tests)
 */
export function clearPromptCache(): void {
  promptCache.clear();
}
