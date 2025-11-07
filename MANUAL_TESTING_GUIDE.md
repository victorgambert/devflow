# 🧪 Guide de Test Manuel Soma Squad AI

**Date:** 2025-11-01
**Version:** 1.12.0
**Providers à tester:** GitLab VCS, GitLab CI, OpenAI

---

## 📋 Table des Matières

1. [Prérequis](#prérequis)
2. [Setup Initial](#setup-initial)
3. [Test GitLab VCS Provider](#test-gitlab-vcs-provider)
4. [Test GitLab CI Provider](#test-gitlab-ci-provider)
5. [Test OpenAI Provider](#test-openai-provider)
6. [Test Intégration Complète](#test-intégration-complète)
7. [Troubleshooting](#troubleshooting)

---

## 1. Prérequis

### Outils Nécessaires

```bash
✅ Node.js >= 20.0.0
✅ pnpm >= 8.0.0
✅ Git
✅ Compte GitLab (gratuit)
✅ Compte OpenAI (avec crédits)
```

### Vérification

```bash
node --version    # v20.x.x ou supérieur
pnpm --version    # 8.x.x ou supérieur
git --version     # 2.x.x
```

---

## 2. Setup Initial

### Étape 1: Installer les Dépendances

```bash
cd /Users/victor/Sites/soma-squad-ai
pnpm install
```

### Étape 2: Build les Packages

```bash
# Build common
pnpm --filter @soma-squad-ai/common build

# Build SDK
pnpm --filter @soma-squad-ai/sdk build
```

### Étape 3: Créer le Fichier .env

```bash
# Copier le template
cp env.example .env

# Éditer avec vos clés
nano .env  # ou vim/code .env
```

---

## 3. Test GitLab VCS Provider

### 🔑 Étape 1: Obtenir un GitLab Token

**Option A: GitLab.com (Cloud)**

1. Aller sur: https://gitlab.com/-/profile/personal_access_tokens
2. Cliquer sur "Add new token"
3. Nom du token: `soma-squad-ai-test`
4. Sélectionner les scopes:
   - ✅ `api`
   - ✅ `read_api`
   - ✅ `write_repository`
5. Expiration: 30 jours
6. Cliquer "Create personal access token"
7. **COPIER LE TOKEN** (format: `glpat-xxxxxxxxxxxx`)

**Option B: GitLab Self-Hosted**

Si vous avez une instance GitLab self-hosted:

1. Aller sur: `https://your-gitlab.com/-/profile/personal_access_tokens`
2. Suivre les mêmes étapes que ci-dessus

### 🔐 Étape 2: Configurer le Token

```bash
# Dans votre terminal
export GITLAB_TOKEN=glpat-xxxxxxxxxxxx

# Ou ajouter au .env
echo "GITLAB_TOKEN=glpat-xxxxxxxxxxxx" >> .env
```

### 🧪 Étape 3: Exécuter le Test

```bash
cd packages/sdk

# Méthode 1: Avec ts-node (recommandé)
npx ts-node src/__manual_tests__/test-gitlab.ts

# Méthode 2: Avec Node (nécessite build)
pnpm build
node dist/__manual_tests__/test-gitlab.js
```

### ✅ Résultat Attendu

```
🦊 GitLab Provider Manual Test

================================

✅ GitLab token found

✅ GitLab provider initialized

Test 1: Get Repository
----------------------
✅ Repository retrieved:
   - Name: gitlab
   - Owner: gitlab-org
   - URL: https://gitlab.com/gitlab-org/gitlab
   - Default Branch: master

Test 2: Get Branch (main)
-------------------------
✅ Branch retrieved:
   - Name: master
   - SHA: abc12345...
   - Protected: true

Test 3: Get Commits
-------------------
✅ Retrieved 10 commits:
   1. Update documentation
      Author: john.doe
      SHA: abc12345...
   ...

Test 4: Get File Content (README.md)
------------------------------------
✅ File content retrieved:
   - Length: 5432 characters
   - Preview: # GitLab...

Test 5: Get Directory Tree
--------------------------
✅ Directory tree retrieved (50 items):
   1. .gitignore
   2. README.md
   3. package.json
   ...

================================
🎉 All tests passed!
================================

GitLab provider is working correctly! ✅
```

### ❌ Si Erreur

Voir section [Troubleshooting](#troubleshooting)

---

## 4. Test GitLab CI Provider

### 🧪 Étape 1: Exécuter le Test

**Utilise le même token que GitLab VCS**

```bash
cd packages/sdk

npx ts-node src/__manual_tests__/test-gitlab-ci.ts
```

### ✅ Résultat Attendu

```
🔄 GitLab CI Provider Manual Test

==================================

✅ GitLab token found

✅ GitLab CI provider initialized

Test 1: Get Recent Pipelines
----------------------------
✅ Retrieved 10 pipelines:

   Pipeline 1:
   - ID: 123456
   - Status: SUCCESS
   - Branch: master
   - Commit: abc12345...
   - Jobs: 15
   - Started: 2025-11-01T10:30:00Z
   - Duration: 180.5s

   ...

Test 2: Get Pipeline Details
----------------------------
✅ Pipeline details retrieved:
   - Name: Pipeline for commit abc12345
   - Status: SUCCESS
   - Jobs: 15

   Jobs:
   1. build - SUCCESS
      Duration: 45.2s
   2. test - SUCCESS
      Duration: 89.3s
   ...

Test 3: Get Job Details
-----------------------
✅ Job details retrieved:
   - Name: build
   - Status: SUCCESS
   - Stage: build
   - Started: 2025-11-01T10:30:00Z
   - Duration: 45.2s

Test 4: Get Job Logs
--------------------
✅ Job logs retrieved:
   - Length: 15234 characters

   Log preview (first 10 lines):
   --------------------------------------------------
   Running with gitlab-runner 15.0.0
   Preparing the "docker" executor
   Using Docker executor with image node:20
   ...
   --------------------------------------------------

Test 5: Get Artifacts
---------------------
✅ Retrieved 3 artifacts:
   1. coverage-report
      Path: coverage/
      Size: 256.5 KB
   ...

==================================
🎉 All tests passed!
==================================

GitLab CI provider is working correctly! ✅
```

---

## 5. Test OpenAI Provider

### 🔑 Étape 1: Obtenir une Clé API OpenAI

1. Créer un compte: https://platform.openai.com/signup
2. Aller dans: https://platform.openai.com/api-keys
3. Cliquer "Create new secret key"
4. Nom: `soma-squad-ai-test`
5. **COPIER LA CLÉ** (format: `sk-xxxxxxxxxxxx`)
6. ⚠️ **Important:** Vous devez avoir des crédits dans votre compte

### 💰 Vérifier les Crédits

1. Aller sur: https://platform.openai.com/account/billing/overview
2. Vérifier que vous avez au moins $1 de crédits
3. Si besoin, ajouter des crédits (minimum $5)

### 🔐 Étape 2: Configurer la Clé

```bash
# Dans votre terminal
export OPENAI_API_KEY=sk-xxxxxxxxxxxx

# Ou ajouter au .env
echo "OPENAI_API_KEY=sk-xxxxxxxxxxxx" >> .env
```

### 🧪 Étape 3: Exécuter le Test

```bash
cd packages/sdk

npx ts-node src/__manual_tests__/test-openai.ts
```

⚠️ **Note:** Ce test va consommer ~$0.02-0.05 de crédits OpenAI

### ✅ Résultat Attendu

```
🤖 OpenAI Provider Manual Test

================================

✅ OpenAI API key found

✅ OpenAI provider initialized (model: gpt-4-turbo-preview)

Test 1: Simple Generation
-------------------------
Prompt: "Write a hello world function in TypeScript"

✅ Response received:
   - Model: gpt-4-turbo-preview
   - Duration: 1234ms
   - Content length: 250 chars

   Content preview:
   --------------------------------------------------
   Here's a simple hello world function in TypeScript:

   ```typescript
   function helloWorld(): void {
     console.log("Hello, World!");
   }
   ```
   ...
   --------------------------------------------------

Test 2: Spec Generation
-----------------------
Task: "Create a user authentication system"

✅ Spec generated:
   - Duration: 3456ms
   - Overview: A comprehensive user authentication system...
   - Steps: 8 steps
   - Files: 5 files to create
   - Dependencies: 4 runtime, 2 dev

   Implementation steps:
   1. Create User model with fields
   2. Set up password hashing with bcrypt
   3. Implement registration endpoint
   ...

Test 3: Code Generation
-----------------------
Generating: User model class

✅ Code generated:
   - Duration: 2345ms
   - Files: 1 file(s)

   File 1: src/models/user.model.ts
   - Action: create
   - Content length: 450 chars
   - Reason: Define User model with required fields

================================
🎉 All tests passed!
================================

OpenAI provider is working correctly! ✅

Performance Summary:
  - Simple generation: 1234ms
  - Spec generation: 3456ms
  - Code generation: 2345ms
  - Total: 7035ms

Estimated cost for this test: $0.0350
```

---

## 6. Test Intégration Complète

### Scénario: Créer une Feature avec GitLab + OpenAI

```bash
cd packages/sdk
```

**Créer ce fichier:** `src/__manual_tests__/test-integration.ts`

```typescript
import 'dotenv/config';
import { GitLabProvider } from '../vcs/gitlab.provider';
import { OpenAIProvider } from '../agents/openai.provider';

async function testIntegration() {
  console.log('🚀 Integration Test: GitLab + OpenAI\n');

  const gitlab = new GitLabProvider(process.env.GITLAB_TOKEN!);
  const openai = new OpenAIProvider(process.env.OPENAI_API_KEY!);

  // 1. Generate spec with OpenAI
  console.log('Step 1: Generate spec...');
  const spec = await openai.generateSpec({
    task: {
      title: 'Add health check endpoint',
      description: 'Create a /health endpoint that returns status',
      acceptanceCriteria: ['Returns 200 OK', 'Returns {"status": "ok"}'],
    },
    project: {
      name: 'test-app',
      language: 'typescript',
      framework: 'express',
      description: 'Test app',
    },
  });
  console.log('✅ Spec generated\n');

  // 2. Generate code with OpenAI
  console.log('Step 2: Generate code...');
  const code = await openai.generateCode({
    task: {
      title: 'Add health check endpoint',
      description: 'Create a /health endpoint',
      acceptanceCriteria: ['Returns 200 OK'],
    },
    spec,
    project: {
      name: 'test-app',
      language: 'typescript',
      framework: 'express',
      description: 'Test app',
    },
  });
  console.log(`✅ Code generated (${code.files.length} files)\n`);

  // 3. Get repository info from GitLab
  console.log('Step 3: Get repository...');
  const repo = await gitlab.getRepository('your-username', 'your-repo');
  console.log(`✅ Repository: ${repo.name}\n`);

  console.log('🎉 Integration test complete!');
  console.log('\nNext steps:');
  console.log('  - Create branch on GitLab');
  console.log('  - Commit generated code');
  console.log('  - Create Merge Request');
  console.log('  - Monitor CI pipeline\n');
}

testIntegration();
```

**Exécuter:**

```bash
# Remplacer 'your-username' et 'your-repo' dans le code
npx ts-node src/__manual_tests__/test-integration.ts
```

---

## 7. Troubleshooting

### ❌ Erreur: "GITLAB_TOKEN not set"

**Solution:**
```bash
export GITLAB_TOKEN=glpat-xxxxxxxxxxxx
# Ou ajouter au .env
```

### ❌ Erreur: "Failed to get repository: 401"

**Causes possibles:**
- Token invalide
- Token expiré
- Scopes insuffisants

**Solution:**
1. Vérifier le token dans GitLab
2. Créer un nouveau token avec les bons scopes
3. Re-exporter: `export GITLAB_TOKEN=nouveau-token`

### ❌ Erreur: "Failed to get repository: 404"

**Causes possibles:**
- Repository n'existe pas
- Pas d'accès au repository
- Mauvais owner/repo

**Solution:**
1. Vérifier que le repo existe sur GitLab
2. Vérifier que vous avez accès (privé vs public)
3. Utiliser le bon format: `owner/repo`

### ❌ Erreur: "Rate limit exceeded"

**Solution:**
- Attendre quelques minutes
- GitLab: 600 requêtes/minute
- OpenAI: Selon votre tier

### ❌ Erreur: "OpenAI API error: Insufficient credits"

**Solution:**
1. Aller sur: https://platform.openai.com/account/billing
2. Ajouter des crédits (minimum $5)
3. Réessayer

### ❌ Erreur: "Cannot find module 'dotenv'"

**Solution:**
```bash
cd packages/sdk
pnpm add -D dotenv
```

### ❌ Erreur TypeScript lors du build

**Solution:**
```bash
# Rebuild common d'abord
pnpm --filter @soma-squad-ai/common build

# Puis SDK
pnpm --filter @soma-squad-ai/sdk build
```

---

## 📊 Checklist de Test

### GitLab VCS
- [ ] Token configuré
- [ ] Test get repository OK
- [ ] Test get branch OK
- [ ] Test get commits OK
- [ ] Test get file content OK
- [ ] Test directory tree OK

### GitLab CI
- [ ] Token configuré (même que VCS)
- [ ] Test get pipelines OK
- [ ] Test get pipeline details OK
- [ ] Test get job details OK
- [ ] Test get job logs OK
- [ ] Test get artifacts OK

### OpenAI
- [ ] API key configuré
- [ ] Crédits disponibles
- [ ] Test simple generation OK
- [ ] Test spec generation OK
- [ ] Test code generation OK

### Intégration
- [ ] GitLab + OpenAI workflow OK
- [ ] Génération → Commit → MR flow OK

---

## 🎯 Next Steps

Après validation des tests manuels:

1. **Écrire des tests unitaires**
   ```bash
   cd packages/sdk
   pnpm test
   ```

2. **Écrire des tests d'intégration**
   ```bash
   pnpm test:e2e
   ```

3. **Déployer en staging**
   ```bash
   pnpm build
   docker-compose up -d
   ```

4. **Tester le workflow complet**
   - Créer tâche Notion
   - Observer Soma Squad AI générer le code
   - Vérifier MR sur GitLab
   - Valider CI passing

---

## 📞 Support

Problèmes? Questions?

- 📧 Email: support@soma-squad-ai.io
- 💬 Slack: [soma-squad-ai.io/slack](https://soma-squad-ai.io/slack)
- 🐛 Issues: [github.com/soma-squad-ai/soma-squad-ai/issues](https://github.com/soma-squad-ai/soma-squad-ai/issues)

---

**Bon testing! 🚀**
