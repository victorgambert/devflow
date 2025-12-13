# CLAUDE.md - DevFlow

**Version:** 2.0.0
**Mise à jour:** 13 décembre 2025
**Statut:** Three-Phase Agile System - Production Ready

## Rappel agents (Claude + Cursor)
- Finir chaque tâche par une étape Documentation (code, infra, CI, scripts, data, tests).
- Mettre à jour les fichiers concernés : `DOCUMENTATION.md`, `ARCHITECTURE.md`, `CLAUDE.md`, README/notes du package impacté, scripts ou guides infra.
- Dans chaque PR, ajouter `Documentation: mise à jour (fichiers)` ou `Documentation: N/A (raison)`.
- Si un workflow/commande change, documenter l'usage, les prérequis et le rollback attendu.
- Si aucune doc n'est requise, l'indiquer explicitement avec justification dans la PR/Linear.

## Vue d'ensemble
DevFlow est un orchestrateur DevOps universel qui transforme automatiquement les tâches Linear en code déployé.

### Three-Phase Agile Workflow (v2.0)
DevFlow implémente un workflow Agile en trois phases distinctes pour une meilleure séparation des responsabilités:

#### Phase 1: Refinement (Affinage du backlog)
**Status:** `To Refinement` → `Refinement Ready` / `Refinement Failed`

1. Détecter le type de tâche (feature, bug, enhancement, chore)
2. Clarifier le contexte métier et les objectifs
3. Identifier les ambiguïtés et questions pour le Product Owner
4. Proposer un découpage si la story est trop grosse
5. Estimer la complexité (T-shirt sizing: XS, S, M, L, XL)
6. Générer des critères d'acceptation préliminaires

**Output:** Refinement markdown dans Linear

#### Phase 2: User Story (Story détaillée)
**Status:** `Refinement Ready` → `UserStory Ready` / `UserStory Failed`

1. Transformer le besoin raffiné en user story formelle (As a, I want, So that)
2. Définir les critères d'acceptation détaillés et testables
3. Créer la Definition of Done
4. Évaluer la valeur business
5. Estimer la complexité en story points (Fibonacci: 1,2,3,5,8,13,21)

**Output:** User story markdown dans Linear

#### Phase 3: Technical Plan (Plan d'implémentation)
**Status:** `UserStory Ready` → `Plan Ready` / `Plan Failed`

1. Analyser la codebase avec RAG (Retrieval Augmented Generation)
2. Définir l'architecture et les décisions techniques
3. Lister les fichiers à modifier
4. Créer les étapes d'implémentation détaillées
5. Définir la stratégie de tests
6. Identifier les risques techniques

**Output:** Plan technique détaillé dans Linear

### Workflow Features (conservées pour référence future)
- Génération de code (frontend + backend)
- Génération des tests (unitaires + E2E)
- Création d'une Pull Request
- Exécution CI/CD + auto-fix en boucle si échec
- Déploiement d'une preview app
- Merge automatique (si configuré)

**Note:** Les phases Code/PR/CI/Merge seront ajoutées dans une version ultérieure.

## Architecture & monorepo
- API : NestJS (REST) - **NestJS only in API layer**
- Orchestration : Temporal.io
- Base de données : PostgreSQL 16 + Prisma ORM
- Cache : Redis 7
- Node.js >= 20, pnpm workspace

**⚠️ Architecture Rule:** NestJS decorators (@Injectable, @Module, @Controller) are used **only in @devflow/api**. SDK, worker, CLI and common packages are **plain TypeScript** to ensure reusability and clean builds. See [ARCHITECTURE.md](ARCHITECTURE.md) for complete guidelines.

```
devflow/
├── packages/
│   ├── api/              # API REST NestJS (port 3000)
│   ├── worker/           # Temporal workers
│   ├── sdk/              # SDK (VCS, CI, AI, Linear, codebase)
│   ├── cli/              # CLI oclif
│   ├── common/           # Types, utils, logger
│   └── observability/    # Metrics/Tracing/SLA
├── infra/                # Helm charts, manifestes K8s
├── config/               # Prometheus, Grafana, Tempo
└── docker-compose.yml    # Environnement dev
```

## Packages clés

### @devflow/api
- Endpoints : `/health`, `/projects`, `/projects/:id/integrations` (GET/PUT), `/projects/:id/linear/setup-custom-fields` (POST), `/projects/:id/linear/teams` (GET), `/projects/:id/link-repository` (POST), `/tasks`, `/tasks/sync/linear`, `/webhooks/linear`, `/webhooks/github`, `/workflows/:id/start`, `/auth/*` (OAuth flows).
- Dépendances : `@nestjs/*`, `@prisma/client`, `@temporalio/client`.

### @devflow/worker
- **Workflow principal** : `packages/worker/src/workflows/devflow.workflow.ts` - Router vers les sous-workflows
- **Sous-workflows (Three-Phase)** :
  - `packages/worker/src/workflows/phases/refinement.workflow.ts` - Phase 1
  - `packages/worker/src/workflows/phases/user-story.workflow.ts` - Phase 2
  - `packages/worker/src/workflows/phases/technical-plan.workflow.ts` - Phase 3
- **Activities Three-Phase** :
  - `generateRefinement`, `appendRefinementToLinearIssue`
  - `generateUserStory`, `appendUserStoryToLinearIssue`
  - `generateTechnicalPlan`, `appendTechnicalPlanToLinearIssue`
- **Activities génériques** : `syncLinearTask`, `updateLinearTask`, `retrieveContext`, `sendNotification`
- **Activities legacy** (conservées) : `generateSpecification`, `generateCode`, `generateTests`, `createBranch`, `commitFiles`, `createPullRequest`, `waitForCI`, `runTests`, `analyzeTestFailures`, `mergePullRequest`

### @devflow/sdk
- **VCS** : GitHubProvider (13/13).
- **CI/CD** : GitHubActionsProvider (10/10).
- **Linear** : `LinearClient` - getTask, queryIssues, queryIssuesByStatus, updateStatus, updateDescription, appendToDescription, addComment, getCustomFields, createCustomField, getIssueCustomFields, updateIssueCustomField.
- **LinearSetupService** : `ensureCustomFields(teamId)`, `validateSetup(teamId)`, `getDevFlowFieldValues(issueId)` - Setup automatique des custom fields DevFlow.
- **AI** : AnthropicProvider, OpenAIProvider, OpenRouterProvider, Cursor (non implémenté).
- **Codebase analysis** : `structure-analyzer.ts`, `dependency-analyzer.ts`, `code-similarity.service.ts`, `documentation-scanner.ts`.
- **Gouvernance/Sécurité** : `policy.guard.ts`, `auto-merge.engine.ts`, `audit.logger.ts`, `security.scanner.ts`.
- **Figma** : `FigmaClient` - getFile, getComments pour extraction de contexte design.
- **Sentry** : `SentryClient` - getIssue, getIssueEvents pour extraction d'erreurs.

### @devflow/cli
- Commandes : `init`, `project:create` (wizard complet), `project:list`, `project:show`, `oauth:register`, `oauth:connect` (GitHub, Linear, Figma, Sentry, GitHub Issues), `oauth:status`, `integrations:show`, `integrations:configure`, `integrations:setup-linear`, `config:linear`, `workflow:start`, `workflow:status`.

### @devflow/common
- **Configuration** : `loadConfig()`, `validateConfig()` - Gestion centralisée de la configuration avec validation Zod
- **Types** : WorkflowInput, WorkflowConfig, DEFAULT_WORKFLOW_CONFIG
- **Règle importante** : Les workflows Temporal ne peuvent PAS accéder à `process.env`. La configuration doit être passée via `WorkflowInput`.

## Gestion de la Configuration

DevFlow utilise un système de configuration à 4 couches pour gérer les contraintes des workflows Temporal:

1. **process.env** - Variables d'environnement (API, Activities uniquement)
2. **loadConfig()** - Chargeur centralisé avec validation Zod
3. **WorkflowInput.config** - Configuration passée aux workflows
4. **Extraction dans workflows** - Config extraite avec fallback sur DEFAULT_WORKFLOW_CONFIG

**Usage:**
- **API/Activities:** `const config = loadConfig();`
- **Workflows:** `const config = input.config || DEFAULT_WORKFLOW_CONFIG;`
- **Validation au démarrage:** `validateConfig()` dans `main.ts`

Voir [ARCHITECTURE.md](./ARCHITECTURE.md#configuration-management) pour les détails complets.

## Workflows Temporal (Three-Phase)
Le workflow principal `devflowWorkflow` agit comme un router qui dirige vers le sous-workflow approprié selon le status Linear.

### Three-Phase Data Flow
```
Linear Webhook → API → devflowWorkflow (router)
        ↓
    syncLinearTask (détecter le status)
        ↓
    ┌────────────────┬────────────────┬────────────────┐
    ↓                ↓                ↓                ↓
Phase 1          Phase 2          Phase 3
To Refinement    Refinement Ready UserStory Ready
    ↓                ↓                ↓
refinementWorkflow userStoryWorkflow technicalPlanWorkflow
    ↓                ↓                ↓
generateRefinement generateUserStory generateTechnicalPlan
    ↓                ↓                ↓
Refinement Ready UserStory Ready  Plan Ready
```

### Routing Logic
- `To Refinement` → `refinementWorkflow` (Phase 1)
- `Refinement Ready` → `userStoryWorkflow` (Phase 2)
- `UserStory Ready` → `technicalPlanWorkflow` (Phase 3)

Chaque phase met à jour le status Linear et ajoute son output en markdown dans la description de l'issue.

## Configuration rapide

### Variables d'environnement essentielles
```bash
# OAuth Token Encryption (REQUIRED)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
OAUTH_ENCRYPTION_KEY=<base64-string>

# Linear - Three-Phase Agile Workflow
LINEAR_WEBHOOK_SECRET=xxx

# Phase 1: Refinement
LINEAR_STATUS_TO_REFINEMENT=To Refinement
LINEAR_STATUS_REFINEMENT_IN_PROGRESS=Refinement In Progress
LINEAR_STATUS_REFINEMENT_READY=Refinement Ready
LINEAR_STATUS_REFINEMENT_FAILED=Refinement Failed

# Phase 2: User Story
LINEAR_STATUS_TO_USER_STORY=Refinement Ready
LINEAR_STATUS_USER_STORY_IN_PROGRESS=UserStory In Progress
LINEAR_STATUS_USER_STORY_READY=UserStory Ready
LINEAR_STATUS_USER_STORY_FAILED=UserStory Failed

# Phase 3: Technical Plan
LINEAR_STATUS_TO_PLAN=UserStory Ready
LINEAR_STATUS_PLAN_IN_PROGRESS=Plan In Progress
LINEAR_STATUS_PLAN_READY=Plan Ready
LINEAR_STATUS_PLAN_FAILED=Plan Failed

# AI Providers
OPENROUTER_API_KEY=sk-or-xxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4
ENABLE_MULTI_LLM=false  # Set to 'true' to use multi-LLM (Claude, GPT-4, Gemini)

# Database
DATABASE_URL=postgresql://devflow:changeme@localhost:5432/devflow

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=devflow

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional: Default project for webhooks
DEFAULT_PROJECT_ID=your-project-id
```

### Migration depuis le système legacy
Si vous utilisez l'ancien système single-phase (`To Spec` → `Spec Ready`), utilisez le script de migration:

```bash
# Dry run (preview changes)
LINEAR_API_KEY=xxx npx ts-node scripts/migrate-linear-statuses.ts --dry-run

# Execute migration
LINEAR_API_KEY=xxx npx ts-node scripts/migrate-linear-statuses.ts
```

### Configuration OAuth (par projet)

DevFlow utilise OAuth 2.0 pour se connecter à GitHub et Linear. Chaque projet peut avoir ses propres credentials OAuth.

**Documentation détaillée:**
- `.docs/LINEAR_OAUTH_SETUP.md` - Guide setup Linear OAuth
- `.docs/OAUTH_MULTITENANT.md` - Architecture multi-tenant OAuth

#### Étape 1: Enregistrer l'application OAuth

```bash
# Enregistrer une app Linear OAuth pour un projet
POST /api/v1/auth/apps/register
Content-Type: application/json

{
  "projectId": "your-project-id",
  "provider": "LINEAR",
  "clientId": "your-linear-client-id",
  "clientSecret": "your-linear-client-secret",
  "redirectUri": "http://localhost:3000/api/v1/auth/linear/callback",
  "scopes": ["read", "write", "issues:create", "comments:create"],
  "flowType": "authorization_code"
}

# Enregistrer une app GitHub OAuth (Device Flow)
POST /api/v1/auth/apps/register
Content-Type: application/json

{
  "projectId": "your-project-id",
  "provider": "GITHUB",
  "clientId": "your-github-client-id",
  "clientSecret": "your-github-client-secret",
  "redirectUri": "urn:ietf:wg:oauth:2.0:oob",
  "scopes": ["repo", "workflow", "read:user"],
  "flowType": "device"
}
```

#### Étape 2: Connecter l'utilisateur

**Linear (Authorization Code Flow):**
```bash
# 1. Obtenir l'URL d'autorisation
POST /api/v1/auth/linear/authorize
Body: {"projectId": "your-project-id"}

# 2. L'utilisateur visite l'URL et autorise

# 3. Callback automatique vers /api/v1/auth/linear/callback
```

**GitHub (Device Flow):**
```bash
# 1. Initier le Device Flow
POST /api/v1/auth/github/device/initiate
Body: {"projectId": "your-project-id"}

# Response: { "userCode": "ABCD-1234", "verificationUri": "https://github.com/login/device" }

# 2. L'utilisateur visite l'URL et entre le code

# 3. Poller pour obtenir les tokens
POST /api/v1/auth/github/device/poll
Body: {"deviceCode": "xxx", "projectId": "your-project-id"}
```

#### Étape 3: Vérifier la connexion

```bash
# Lister les connexions OAuth d'un projet
GET /api/v1/auth/connections?project=your-project-id

# Forcer le refresh d'un token
POST /api/v1/auth/linear/refresh
Body: {"projectId": "your-project-id"}

# Déconnecter un provider
POST /api/v1/auth/linear/disconnect
Body: {"projectId": "your-project-id"}
```

## Commandes utiles
- Installation : `pnpm install`
- Infra locale : `docker-compose up -d`
- Build : `pnpm build`
- API dev : `pnpm dev`
- Worker dev : `pnpm dev:worker`
- Tests : `pnpm test`
- DB : `pnpm db:migrate`

## Troubleshooting rapide
- `OAuth not configured` → Connecter OAuth pour le projet via `/api/v1/auth/{provider}/device/initiate`
- `Database connection failed` → `docker-compose up -d postgres`
- `Temporal not reachable` → `docker-compose up -d temporal`
- `Redis not connected` → `docker-compose up -d redis`
- Logs : `docker-compose logs -f api worker`

## Fichiers clés à consulter
- `.docs/ARCHITECTURE.md` (architecture & NestJS boundaries - **LIRE EN PREMIER**)
- `.docs/DOCUMENTATION.md` (documentation complète)
- `.docs/LINEAR_OAUTH_SETUP.md` (guide setup Linear OAuth)
- `.docs/OAUTH_MULTITENANT.md` (architecture multi-tenant OAuth)
- `packages/worker/src/workflows/devflow.workflow.ts` (workflow principal)
- `packages/sdk/src/linear/linear.client.ts` (Linear client)
- `packages/sdk/src/agents/agent.interface.ts` (interface AI agents)
- `packages/sdk/src/auth/` (OAuth services - token encryption, storage, refresh)
- `packages/api/src/auth/` (OAuth HTTP endpoints)
- `packages/api/prisma/schema.prisma` (schéma complet)
