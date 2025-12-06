# CLAUDE.md - Soma Squad AI

**Version:** 1.13.0
**Mise à jour:** 6 décembre 2025
**Statut:** Production Ready

## Rappel agents (Claude + Cursor)
- Finir chaque tâche par une étape Documentation (code, infra, CI, scripts, data, tests).
- Mettre à jour les fichiers concernés : `DOCUMENTATION.md`, `CLAUDE.md`, README/notes du package impacté, scripts ou guides infra.
- Dans chaque PR, ajouter `Documentation: mise à jour (fichiers)` ou `Documentation: N/A (raison)`.
- Si un workflow/commande change, documenter l'usage, les prérequis et le rollback attendu.
- Si aucune doc n'est requise, l'indiquer explicitement avec justification dans la PR/Linear.

## Vue d'ensemble
Soma Squad AI est un orchestrateur DevOps universel qui transforme automatiquement les tâches Linear en code déployé.

### Workflow principal
1. Créer une tâche dans Linear avec description
2. Analyse de la codebase via GitHub API
3. Génération de la spécification technique
4. Génération de code (frontend + backend)
5. Génération des tests (unitaires + E2E)
6. Création d'une Pull Request
7. Exécution CI/CD + auto-fix en boucle si échec
8. Déploiement d'une preview app
9. Merge automatique (si configuré)

## Architecture & monorepo
- API : NestJS (REST)
- Orchestration : Temporal.io
- Base de données : PostgreSQL 16 + Prisma ORM
- Cache : Redis 7
- Node.js >= 20, pnpm workspace

```
soma-squad-ai/
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

### @soma-squad-ai/api
- Endpoints : `/health`, `/projects`, `/tasks`, `/tasks/sync/linear`, `/webhooks/linear`, `/webhooks/github`, `/workflows/:id/start`.
- Dépendances : `@nestjs/*`, `@prisma/client`, `@temporalio/client`.

### @soma-squad-ai/worker
- Workflow principal : `packages/worker/src/workflows/soma-squad-ai.workflow.ts`.
- Activities clés : `syncLinearTask`, `updateLinearTask`, `appendSpecToLinearIssue`, `appendWarningToLinearIssue`, `generateSpecification`, `generateCode`, `generateTests`, `createBranch`, `commitFiles`, `createPullRequest`, `waitForCI`, `runTests`, `analyzeTestFailures`, `mergePullRequest`, `sendNotification`.

### @soma-squad-ai/sdk
- **VCS** : GitHubProvider (13/13).
- **CI/CD** : GitHubActionsProvider (10/10).
- **Linear** : `LinearClient` - getTask, queryIssues, queryIssuesByStatus, updateStatus, updateDescription, appendToDescription, addComment.
- **AI** : AnthropicProvider, OpenAIProvider, OpenRouterProvider, Cursor (non implémenté).
- **Codebase analysis** : `structure-analyzer.ts`, `dependency-analyzer.ts`, `code-similarity.service.ts`, `documentation-scanner.ts`.
- **Gouvernance/Sécurité** : `policy.guard.ts`, `auto-merge.engine.ts`, `audit.logger.ts`, `security.scanner.ts`.

### @soma-squad-ai/cli
- Commandes : `init`, `connect linear`, `connect github`, `status <task>`, `run <task> --step dev`, `doctor`.

## Workflows Temporal
`somaSquadAIWorkflow` orchestre Linear → Spec → Code → PR → CI → Merge avec auto-fix.

### Data Flow
```
Linear Webhook → API → Temporal Workflow
        ↓
    syncLinearTask
        ↓
    generateSpecification (Claude/GPT-4)
        ↓
    appendSpecToLinearIssue + appendWarningToLinearIssue
        ↓
    generateCode + generateTests
        ↓
    createBranch → commitFiles → createPullRequest
        ↓
    waitForCI (loop with auto-fix up to 3 attempts)
        ↓
    mergePullRequest
        ↓
    updateLinearTask (Done)
```

## Configuration rapide

### Variables d'environnement essentielles
```bash
# GitHub
GITHUB_TOKEN=ghp_xxx
DEFAULT_REPO_OWNER=your-username
DEFAULT_REPO_NAME=your-repo

# Linear
LINEAR_API_KEY=lin_api_xxx
LINEAR_WEBHOOK_SECRET=xxx
LINEAR_TRIGGER_STATUS=To Spec
LINEAR_NEXT_STATUS=Spec Ready

# AI Providers
OPENROUTER_API_KEY=sk-or-xxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4

# Database
DATABASE_URL=postgresql://soma_squad_ai:changeme@localhost:5432/soma_squad_ai

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=soma-squad-ai

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
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
- `GITHUB_TOKEN not set` → exporter la variable ou compléter `.env`.
- `LINEAR_API_KEY not set` → exporter la variable ou compléter `.env`.
- `Database connection failed` → `docker-compose up -d postgres`.
- `Temporal not reachable` → `docker-compose up -d temporal`.
- Logs : `docker-compose logs -f api worker`

## Fichiers clés à consulter
- `packages/worker/src/workflows/soma-squad-ai.workflow.ts` (workflow principal)
- `packages/sdk/src/linear/linear.client.ts` (Linear client)
- `packages/sdk/src/agents/agent.interface.ts` (interface AI agents)
- `packages/api/prisma/schema.prisma` (schéma complet)
