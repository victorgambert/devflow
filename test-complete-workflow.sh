#!/bin/bash

# Test Complet du Workflow DevFlow avec Repository Context
# Ce script teste la génération de spec avec le contexte de votre repo GitHub

set -e

echo "🚀 Test du Workflow Complet DevFlow"
echo "=========================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Charger les variables d'environnement
if [ ! -f .env ]; then
    echo -e "${RED}❌ Fichier .env introuvable${NC}"
    exit 1
fi

source .env

# Vérifier les variables requises
echo "📋 Vérification des variables d'environnement..."

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}❌ GITHUB_TOKEN manquant${NC}"
    exit 1
fi

if [ -z "$DEFAULT_REPO_OWNER" ]; then
    echo -e "${RED}❌ DEFAULT_REPO_OWNER manquant${NC}"
    exit 1
fi

if [ -z "$DEFAULT_REPO_NAME" ]; then
    echo -e "${RED}❌ DEFAULT_REPO_NAME manquant${NC}"
    exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}❌ ANTHROPIC_API_KEY ou OPENAI_API_KEY requis${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Variables d'environnement OK${NC}"
echo "   Repository: $DEFAULT_REPO_OWNER/$DEFAULT_REPO_NAME"
echo ""

# Étape 1 : Tester l'accès au repository
echo "🔍 Étape 1 : Test de l'accès au repository GitHub"
echo "------------------------------------------------------------"

cd packages/sdk

cat > /tmp/test-repo-access.ts << 'EOF'
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import { GitHubProvider } from './src/vcs/github.provider';

async function test() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.DEFAULT_REPO_OWNER;
  const repo = process.env.DEFAULT_REPO_NAME;

  console.log(`   Testing access to: ${owner}/${repo}`);

  const github = new GitHubProvider(token!);

  try {
    const repoData = await github.getRepository(owner!, repo!);
    console.log('   ✅ Repository accessible');
    console.log(`   Name: ${repoData.name}`);
    console.log(`   URL: ${repoData.url}`);
    console.log(`   Branch: ${repoData.defaultBranch}`);
    return true;
  } catch (error) {
    console.error('   ❌ ERROR:', (error as Error).message);
    return false;
  }
}

test().then(success => process.exit(success ? 0 : 1));
EOF

if npx ts-node /tmp/test-repo-access.ts; then
    echo ""
else
    echo -e "${RED}❌ Impossible d'accéder au repository${NC}"
    exit 1
fi

# Étape 2 : Analyser le contexte du codebase
echo "🔍 Étape 2 : Analyse du contexte du codebase"
echo "------------------------------------------------------------"

cat > /tmp/test-codebase-analysis.ts << 'EOF'
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import { GitHubProvider, analyzeRepository, formatContextForAI, extractSpecGenerationContext } from './src/index';

async function test() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.DEFAULT_REPO_OWNER;
  const repo = process.env.DEFAULT_REPO_NAME;

  console.log(`   Analyzing: ${owner}/${repo}`);
  console.log('   This may take 10-30 seconds...');

  const github = new GitHubProvider(token!);

  try {
    const context = await analyzeRepository(
      github,
      owner!,
      repo!,
      'Add user authentication with JWT tokens'
    );

    console.log('');
    console.log('   ✅ Codebase analyzed successfully!');
    console.log('');
    console.log('   📊 Results:');
    console.log(`   Language:     ${context.structure.language}`);
    console.log(`   Framework:    ${context.structure.framework || 'N/A'}`);
    console.log(`   Files:        ${context.structure.fileCount}`);
    console.log(`   Dependencies: ${context.dependencies.mainLibraries.length} main, ${Object.keys(context.dependencies.dev).length} dev`);
    console.log(`   Conventions:  ${context.documentation.conventions.length} found`);
    console.log(`   Patterns:     ${context.documentation.patterns.length} found`);
    console.log(`   Similar code: ${context.similarCode.length} examples`);
    console.log('');

    // Extract spec generation context
    const specContext = extractSpecGenerationContext(context);
    console.log('   📝 Spec Generation Context:');
    console.log(`   - Language: ${specContext.language}`);
    console.log(`   - Framework: ${specContext.framework || 'N/A'}`);
    console.log(`   - Dependencies: ${specContext.dependencies.slice(0, 5).join(', ')}...`);
    console.log(`   - Conventions: ${specContext.conventions.slice(0, 3).join(', ')}...`);
    console.log('');

    // Format for AI
    const aiContext = formatContextForAI(context);
    console.log('   🤖 AI Context:');
    console.log(`   - Total size: ${aiContext.length} characters`);
    console.log(`   - Estimated tokens: ~${Math.ceil(aiContext.length / 4)}`);
    console.log('');
    console.log('   Preview (first 500 chars):');
    console.log('   ' + '─'.repeat(60));
    console.log(aiContext.substring(0, 500).split('\n').map(l => '   ' + l).join('\n'));
    if (aiContext.length > 500) {
      console.log(`   ... (${aiContext.length - 500} more characters)`);
    }
    console.log('   ' + '─'.repeat(60));
    console.log('');

    return true;
  } catch (error) {
    console.error('   ❌ ERROR:', (error as Error).message);
    console.error((error as Error).stack);
    return false;
  }
}

test().then(success => process.exit(success ? 0 : 1));
EOF

if npx ts-node /tmp/test-codebase-analysis.ts; then
    echo ""
else
    echo -e "${RED}❌ Échec de l'analyse du codebase${NC}"
    exit 1
fi

# Étape 3 : Simuler la génération de spec
echo "🤖 Étape 3 : Simulation de génération de spec"
echo "------------------------------------------------------------"

cat > /tmp/test-spec-generation.ts << 'EOF'
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import { GitHubProvider, analyzeRepository, extractSpecGenerationContext } from './src/index';
import { createCodeAgentDriver } from './src/agents';

async function test() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.DEFAULT_REPO_OWNER;
  const repo = process.env.DEFAULT_REPO_NAME;
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  const provider = process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai';

  console.log(`   Using AI provider: ${provider}`);
  console.log(`   Repository: ${owner}/${repo}`);
  console.log('');

  const github = new GitHubProvider(token!);

  try {
    // Analyze codebase
    console.log('   🔍 Analyzing codebase...');
    const context = await analyzeRepository(
      github,
      owner!,
      repo!,
      'Add user authentication with JWT tokens and refresh tokens'
    );

    const specContext = extractSpecGenerationContext(context);
    console.log('   ✅ Codebase analyzed');
    console.log('');

    // Generate spec with context
    console.log('   🤖 Generating spec with AI...');
    const agent = createCodeAgentDriver({
      provider: provider as any,
      apiKey: apiKey!,
      model: provider === 'anthropic' ? 'claude-sonnet-4-0' : 'gpt-4',
    });

    const spec = await agent.generateSpec({
      task: {
        title: 'Add user authentication',
        description: 'Implement JWT-based authentication with refresh tokens, login/logout endpoints, and protected routes',
        priority: 'high',
      },
      project: {
        language: specContext.language,
        framework: specContext.framework,
        dependencies: specContext.dependencies,
        conventions: specContext.conventions,
        patterns: specContext.patterns,
      },
    });

    console.log('   ✅ Spec generated successfully!');
    console.log('');
    console.log('   📋 Generated Spec:');
    console.log('   ' + '='.repeat(60));
    console.log('');
    console.log('   🏗️  Architecture:');
    spec.architecture.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item}`);
    });
    console.log('');
    console.log('   📝 Implementation Steps:');
    spec.implementationSteps.forEach((step, i) => {
      console.log(`   ${i + 1}. ${step}`);
    });
    console.log('');
    console.log('   🧪 Testing Strategy:');
    console.log(`   ${spec.testingStrategy}`);
    console.log('');
    console.log('   ⚠️  Risks:');
    spec.risks.forEach((risk, i) => {
      console.log(`   ${i + 1}. ${risk}`);
    });
    console.log('');
    console.log('   ' + '='.repeat(60));
    console.log('');

    return true;
  } catch (error) {
    console.error('   ❌ ERROR:', (error as Error).message);
    console.error((error as Error).stack);
    return false;
  }
}

test().then(success => process.exit(success ? 0 : 1));
EOF

if npx ts-node /tmp/test-spec-generation.ts; then
    echo ""
else
    echo -e "${RED}❌ Échec de la génération de spec${NC}"
    exit 1
fi

# Résumé final
echo "=========================================="
echo -e "${GREEN}✅ TEST COMPLET RÉUSSI${NC}"
echo "=========================================="
echo ""
echo "📊 Résumé:"
echo "   ✅ Accès au repository GitHub vérifié"
echo "   ✅ Analyse du contexte du codebase réussie"
echo "   ✅ Génération de spec avec contexte réussie"
echo ""
echo "🎉 Votre repository est correctement configuré!"
echo ""
echo "📋 Prochaines étapes:"
echo "   1. Démarrer les services (Docker, Temporal, API, Worker)"
echo "   2. Créer une tâche dans Linear"
echo "   3. La déplacer en statut 'Specification'"
echo "   4. Soma Squad AI générera automatiquement la spec avec le contexte de votre repo"
echo ""

# Cleanup
rm -f /tmp/test-repo-access.ts /tmp/test-codebase-analysis.ts /tmp/test-spec-generation.ts

exit 0
