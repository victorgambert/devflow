# 📚 Soma Squad AI - Documentation Complète

**Version:** 1.12.1  
**Dernière mise à jour:** 6 décembre 2025  
**Statut:** Production Ready  

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [État Fonctionnel](#état-fonctionnel)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Utilisation](#utilisation)
7. [Providers Supportés](#providers-supportés)
8. [Tests](#tests)
9. [Déploiement](#déploiement)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Vue d'ensemble

### Qu'est-ce que Soma Squad AI ?

Soma Squad AI transforme vos tâches Linear en code déployé, automatiquement.

**Workflow complet :**
1. Vous créez une tâche dans Linear avec une description
2. Soma Squad AI analyse votre codebase via l'API GitHub
3. Génère une spécification technique alignée avec vos conventions
4. Écrit le code (frontend + backend si nécessaire)
5. Crée les tests (unitaires + E2E)
6. Ouvre une Pull Request sur GitHub
7. Exécute les tests CI/CD
8. Corrige automatiquement les erreurs si nécessaire
9. Déploie une preview app
10. Vous validez et mergez

**Résultat :** Ce qui prenait 2-3 jours prend maintenant 15-30 minutes.

### Fonctionnalités Principales

- 🤖 **Génération de code automatique** (frontend + backend)
- 🧪 **Tests automatiques** (unitaires + E2E + mutation testing)
- 🎨 **Preview apps** pour chaque PR
- 🔍 **Quality gates** (coverage, AC, policies)
- 🐛 **Auto-fix** des bugs si tests échouent
- 📊 **Métriques** (durée, coûts, SLA)
- 🔒 **Sécurité** (GDPR, secrets scanning, audit logs)
- 💰 **Billing** (tracking usage, quotas, facturation)

---

## 🏗️ Architecture

### Stack Technique

**Backend :**
- NestJS (API REST)
- Temporal (orchestration workflows)
- PostgreSQL (données)
- Redis (cache)
- Prisma ORM

**Frontend :**
- React/Vue/Angular (selon projet)
- Tailwind CSS
- TypeScript

**Infrastructure :**
- Docker & Docker Compose
- Kubernetes (Helm charts)
- Prometheus + Grafana (monitoring)
- OpenTelemetry (tracing)

### Packages

```
soma-squad-ai/
├── packages/
│   ├── api/              # API REST NestJS
│   ├── worker/           # Temporal workers
│   ├── sdk/              # SDK principal (VCS, AI, etc.)
│   ├── cli/              # CLI Soma Squad AI
│   ├── common/           # Types et utils partagés
│   └── observability/    # Métriques, logs, traces
├── infra/
│   ├── helm/             # Charts Kubernetes
│   └── k8s/              # Manifestes K8s
└── config/               # Configs monitoring
```

### Data Flow

```
Linear Webhook → API → Temporal Workflow
    ↓
Analyze Codebase (GitHub API)
    ↓
Generate Spec (Claude/GPT-4)
    ↓
Generate Code (Claude/GPT-4)
    ↓
Create Branch + Commit (GitHub)
    ↓
Create PR/MR
    ↓
Run CI/CD
    ↓
Deploy Preview
    ↓
Validate Quality Gates
    ↓
Auto-merge (si configuré)
```

---

## ✅ État Fonctionnel

### Providers VCS (Version Control)

| Provider | Statut | Méthodes | Testé | Production |
|----------|--------|----------|-------|------------|
| **GitHub** | ✅ Complet | 13/13 | ✅ | ✅ |

**Méthodes GitHub :**
- ✅ getRepository()
- ✅ getBranch()
- ✅ createBranch()
- ✅ deleteBranch()
- ✅ getPullRequest()
- ✅ createPullRequest()
- ✅ updatePullRequest()
- ✅ mergePullRequest()
- ✅ getFileContent()
- ✅ commitFiles()
- ✅ getCommits()
- ✅ getFileChanges()
- ✅ getDirectoryTree()

**Nouvelles méthodes GitHub (pour analyse codebase) :**
- ✅ getRepositoryTree()
- ✅ getRepositoryLanguages()
- ✅ searchCode()
- ✅ getMultipleFiles()
- ✅ fileExists()

### Providers CI/CD

| Provider | Statut | Méthodes | Testé | Production |
|----------|--------|----------|-------|------------|
| **GitHub Actions** | ✅ Complet | 10/10 | ✅ | ✅ |

**Méthodes GitHub Actions :**
- ✅ getPipeline()
- ✅ getPipelines()
- ✅ getPipelineForCommit()
- ✅ triggerPipeline()
- ✅ getJob()
- ✅ getJobLogs()
- ✅ getArtifacts()
- ✅ downloadArtifact()
- ✅ parseTestResults()
- ✅ parseCoverageReport()

### Providers AI

| Provider | Statut | Méthodes | Testé | Production |
|----------|--------|----------|-------|------------|
| **Anthropic Claude** | ✅ Complet | 6/6 | ✅ | ✅ |
| **OpenAI GPT-4** | ✅ Complet | 6/6 | ✅ | ✅ |
| **Cursor** | ❌ Non implémenté | 0/6 | ❌ | ❌ |

**Méthodes Claude/OpenAI :**
- ✅ generate()
- ✅ generateSpec()
- ✅ generateCode()
- ✅ generateFix()
- ✅ generateTests()
- ✅ analyzeTestFailures()

### Analyse de Codebase

| Fonctionnalité | Statut | Description |
|----------------|--------|-------------|
| **Repository Parsing** | ✅ | Parse URLs GitHub |
| **Structure Analysis** | ✅ | Détecte langage, framework, structure |
| **Dependency Analysis** | ✅ | 6 langages supportés |
| **Documentation Scanning** | ✅ | README, CONTRIBUTING, conventions |
| **Code Similarity** | ✅ | Recherche via GitHub Search API |
| **Context Generation** | ✅ | Format markdown pour l'IA |

**Langages supportés pour dependencies :**
- ✅ JavaScript/TypeScript (package.json)
- ✅ Python (requirements.txt, pyproject.toml)
- ✅ Rust (Cargo.toml)
- ✅ Go (go.mod)
- ✅ PHP (composer.json)
- ✅ Ruby (Gemfile)

**Frameworks détectés (15+) :**
- JavaScript/TypeScript: Next.js, Nuxt.js, React, Angular, Vue, Svelte, Remix, Gatsby, NestJS, Express, Fastify
- Backend: Rust, Go, Python, PHP

### Intégration Linear

| Fonctionnalité | Statut | Description |
|----------------|--------|-------------|
| **Sync Tasks** | ✅ | Synchronisation bidirectionnelle |
| **Status Updates** | ✅ | TODO, IN_PROGRESS, DONE, etc. |
| **Append Spec** | ✅ | Ajoute spec à l'issue Linear |
| **Warning Message** | ✅ | Commentaire après génération spec |
| **Comments** | ✅ | Commentaires sur issues |

### Services Core

| Service | Statut | Description |
|---------|--------|-------------|
| **Billing Engine** | ✅ | Facturation, invoices, line items |
| **Usage Metering** | ✅ | Tracking tokens, CI minutes, storage |
| **Compliance (GDPR)** | ✅ | Export, deletion, anonymisation |
| **Security Scanner** | ✅ | Secrets, vulnérabilités |
| **Audit Logger** | ✅ | Logs immuables, conformité |
| **Budget Manager** | ✅ | Quotas, alertes dépassement |
| **Policy Guard** | ✅ | Branch protection, merge policies |
| **Auto-Merge** | ✅ | Merge automatique si tests OK |

### Observability

| Composant | Statut | Description |
|-----------|--------|-------------|
| **Structured Logging** | ✅ | Pino + OpenTelemetry |
| **Distributed Tracing** | ✅ | OpenTelemetry + Tempo |
| **Metrics** | ✅ | Prometheus + Grafana |
| **Dashboards** | ✅ | Grafana (DevFlow Overview) |
| **Alerts** | ✅ | Alertmanager |
| **SLA Tracking** | ✅ | Durée, coûts, success rate |

### API Endpoints

| Endpoint | Méthode | Statut | Description |
|----------|---------|--------|-------------|
| `/health` | GET | ✅ | Health check |
| `/projects` | POST | ✅ | Créer projet |
| `/projects/:id` | GET | ✅ | Récupérer projet |
| `/projects/:id/link-repository` | POST | ✅ | Lier repository |
| `/tasks` | POST | ✅ | Créer task |
| `/tasks/:id` | GET | ✅ | Récupérer task |
| `/webhooks/linear` | POST | ✅ | Webhook Linear |
| `/webhooks/github` | POST | ⚠️ | Webhook GitHub (partiel) |

---

## 🚀 Installation

### Prérequis

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### Installation Rapide

```bash
# 1. Cloner le repository
git clone https://github.com/your-org/soma-squad-ai.git
cd soma-squad-ai

# 2. Installer les dépendances
pnpm install

# 3. Copier et configurer .env
cp .env.example .env
# Éditer .env avec vos clés API

# 4. Démarrer l'infrastructure (PostgreSQL, Redis, Temporal)
docker-compose up -d

# 5. Build les packages
pnpm build

# 6. Lancer l'API
cd packages/api
pnpm start:dev

# 7. Lancer le Worker (dans un autre terminal)
cd packages/worker
pnpm start:dev
```

### Installation via CLI

```bash
# Installer la CLI globalement
npm install -g @soma-squad-ai/cli

# Initialiser dans votre projet
cd mon-projet
soma-squad-ai init

# Connecter vos outils
soma-squad-ai connect linear
soma-squad-ai connect github
```

---

## ⚙️ Configuration

### Variables d'Environnement Essentielles

```bash
# ===================================
# GitHub
# ===================================
GITHUB_TOKEN=ghp_your_token_here

# Configuration repository par défaut
DEFAULT_REPO_OWNER=your-username
DEFAULT_REPO_NAME=your-repo
DEFAULT_REPO_URL=https://github.com/your-username/your-repo

# ===================================
# AI Providers (au moins un requis)
# ===================================
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-proj-xxx

# ===================================
# Linear
# ===================================
LINEAR_API_KEY=lin_api_xxx
LINEAR_WEBHOOK_SECRET=xxx

# Status que Linear doit avoir pour déclencher le workflow (optionnel)
LINEAR_TRIGGER_STATUS=Specification
LINEAR_NEXT_STATUS=In Progress

# ===================================
# Database
# ===================================
DATABASE_URL=postgresql://soma_squad_ai:changeme@localhost:5432/soma_squad_ai?schema=public

# ===================================
# Temporal
# ===================================
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=soma-squad-ai
```

### Fichier .soma-squad-ai.yml

À la racine de votre projet :

```yaml
project:
  name: mon-app
  language: typescript
  framework: nextjs

repository:
  vcs_provider: github
  owner: mon-org
  name: mon-repo

commands:
  setup: "npm install"
  build: "npm run build"
  lint: "npm run lint"
  unit: "npm run test:unit"
  e2e: "npm run test:e2e"

testing:
  unit_coverage_threshold: 80
  e2e_required: true

preview:
  enabled: true
  provider: vercel

guardrails:
  max_pr_size: 500
  require_tests: true
  require_ac_coverage: true

notifications:
  slack:
    enabled: true
    channel: "#dev-notifications"
```

---

## 📖 Utilisation

### Workflow Standard

**1. Créer une tâche Linear :**

```
Titre: Ajouter export CSV
Description: Les utilisateurs doivent pouvoir exporter leurs données en CSV
Acceptance Criteria:
- [ ] Bouton "Export CSV" visible
- [ ] Télécharge fichier .csv avec colonnes: nom, email, date
- [ ] Message de succès après export
```

**2. Déplacer en status "Specification" dans Linear**

**3. Soma Squad AI démarre automatiquement :**
- Analyse votre codebase
- Génère la spec technique
- Ajoute un commentaire warning sur l'issue Linear
- Génère le code
- Crée une PR
- Exécute les tests
- Déploie une preview

**4. Vous reviewez la PR et mergez**

### Utilisation via CLI

```bash
# Voir le statut d'un ticket
soma-squad-ai status TASK-123

# Relancer une étape
soma-squad-ai run TASK-123 --step dev

# Vérifier la santé du système
soma-squad-ai doctor

# Générer template CI
soma-squad-ai templates ci --provider github
```

### Utilisation via API

```bash
# Créer un projet
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Project",
    "description": "Description",
    "repository": "",
    "config": {...}
  }'

# Lier un repository
curl -X POST http://localhost:3000/projects/PROJECT_ID/link-repository \
  -H "Content-Type: application/json" \
  -d '{"repositoryUrl": "https://github.com/owner/repo"}'
```

---

## 🧭 Règles agents & documentation (Claude/Cursor)

Checklist fin de tâche :
- Toujours terminer par une étape «Documentation» après toute évolution (code, infra, CI, scripts, data, tests).
- Mettre à jour les fichiers concernés : `DOCUMENTATION.md`, `CLAUDE.md`, README/notes du package impacté, scripts ou guides infra.
- Dans la PR, ajouter `Documentation: mise à jour (fichiers)` ou `Documentation: N/A (raison)` en justifiant.
- Pour tout nouveau workflow/commande, documenter l’usage attendu, les prérequis et les points de rollback.
- Si aucune mise à jour n’est nécessaire, expliquer explicitement pourquoi (ex.: refactor purement interne).

---

## 🔌 Providers Supportés

### GitHub (✅ Production Ready)

**Setup :**
1. Générer un Personal Access Token : https://github.com/settings/tokens
2. Scopes requis : `repo` (all)
3. Ajouter à `.env` : `GITHUB_TOKEN=ghp_xxx`

**Ou GitHub App (recommandé production) :**
- Voir `GITHUB_APP_SETUP.md` (maintenant supprimé, infos ci-dessous)
- Permissions : Contents (Read & Write), Pull Requests (Read & Write)

### Anthropic Claude (✅ Production Ready)

**Setup :**
1. Créer un compte : https://console.anthropic.com
2. Générer une API key : https://console.anthropic.com/settings/keys
3. Ajouter à `.env` : `ANTHROPIC_API_KEY=sk-ant-xxx`

**Modèle recommandé :** `claude-3-5-sonnet-20241022`

**Coûts :**
- Input : $3/million tokens
- Output : $15/million tokens
- Feature typique : $1-3

### OpenAI GPT-4 (✅ Production Ready)

**Setup :**
1. Créer un compte : https://platform.openai.com
2. Générer une API key : https://platform.openai.com/api-keys
3. Ajouter à `.env` : `OPENAI_API_KEY=sk-proj-xxx`

**Modèle recommandé :** `gpt-4-turbo-preview`

**Coûts :**
- Input : $10/million tokens
- Output : $30/million tokens
- Feature typique : $0.5-2

**Performance :**
- Simple generation : ~2.4s
- Spec generation : ~13.2s
- Code generation : ~10.3s

---

## 🧪 Tests

### Tests Unitaires

```bash
# Tous les packages
pnpm test

# Package spécifique
pnpm --filter @soma-squad-ai/sdk test

# Avec coverage
pnpm test:coverage
```

### Tests d'Intégration

```bash
# Test complet GitHub integration
cd packages/sdk
GITHUB_TOKEN="ghp_xxx" npx ts-node src/__manual_tests__/test-integration-e2e.ts facebook/react

# Test OpenAI
OPENAI_API_KEY="sk-proj-xxx" npx ts-node src/__manual_tests__/test-openai-simple.ts
```

### Tests Manuels Disponibles

| Script | Description | Variables requises |
|--------|-------------|-------------------|
| `test-integration-e2e.ts` | Test complet analyse codebase | GITHUB_TOKEN |
| `test-codebase-modules.ts` | Test exports modules | Aucune |
| `test-openai-simple.ts` | Test OpenAI | OPENAI_API_KEY |
| `test-linear-*.ts` | Tests Linear SDK | LINEAR_API_KEY |

### Build Status

| Package | TypeScript | Build | Tests |
|---------|-----------|-------|-------|
| @soma-squad-ai/common | ✅ 0 errors | ✅ | ✅ |
| @soma-squad-ai/sdk | ✅ 0 errors | ✅ | ✅ 12/12 |
| @soma-squad-ai/api | ✅ 0 errors | ✅ | ⚠️ |
| @soma-squad-ai/worker | ✅ 0 errors | ✅ | ⚠️ |
| @soma-squad-ai/cli | ✅ 0 errors | ✅ | ⚠️ |

---

## 🚀 Déploiement

### Docker Compose (Local/Staging)

```bash
# Démarrer tous les services
docker-compose up -d

# Vérifier les services
docker-compose ps

# Voir les logs
docker-compose logs -f api worker

# Arrêter
docker-compose down
```

### Kubernetes (Production)

```bash
# Installer via Helm
cd infra/helm/soma-squad-ai

# Development
helm install soma-squad-ai . -f values.yaml

# Production
helm install soma-squad-ai . -f values-prod.yaml \
  --namespace soma-squad-ai \
  --create-namespace

# Vérifier le déploiement
kubectl get pods -n soma-squad-ai
```

### Services Déployés

```
API:
  - Port: 3000
  - Health: /health
  - Metrics: /metrics

Worker:
  - Temporal workers
  - Connexion: localhost:7233

PostgreSQL:
  - Port: 5432
  - Database: soma_squad_ai
  - User: soma_squad_ai

Redis:
  - Port: 6379

Temporal:
  - Port: 7233
  - UI: http://localhost:8080

Observability:
  - Prometheus: http://localhost:9090
  - Grafana: http://localhost:3001
  - Tempo: http://localhost:3200
```

---

## 🚨 Troubleshooting

### Erreurs Courantes

#### "GITHUB_TOKEN not set"

**Cause :** Variable d'environnement manquante

**Solution :**
```bash
export GITHUB_TOKEN=ghp_your_token
# ou ajouter au .env
```

#### "Bad credentials" (GitHub)

**Cause :** Token invalide ou expiré

**Solution :**
1. Régénérer le token
2. Vérifier les scopes (repo pour GitHub)
3. Mettre à jour .env

#### "Repository not configured"

**Cause :** Variables DEFAULT_REPO_* manquantes

**Solution :**
```bash
echo "DEFAULT_REPO_OWNER=your-username" >> .env
echo "DEFAULT_REPO_NAME=your-repo" >> .env
echo "DEFAULT_REPO_URL=https://github.com/your-username/your-repo" >> .env
```

#### "Rate limit exceeded"

**Cause :** Trop de requêtes API

**Solution :**
- GitHub : 5000/heure (authentifié)
- Attendre ou utiliser GitHub App

#### "Database connection failed"

**Cause :** PostgreSQL non démarré ou mauvaise config

**Solution :**
```bash
# Démarrer PostgreSQL
docker-compose up -d postgres

# Vérifier connexion
psql $DATABASE_URL -c "SELECT 1"
```

#### "Temporal not reachable"

**Cause :** Temporal pas démarré

**Solution :**
```bash
docker-compose up -d temporal
# Attendre 30s que Temporal soit prêt
curl http://localhost:8080
```

#### "OpenAI insufficient credits"

**Cause :** Pas assez de crédits API

**Solution :**
1. Aller sur https://platform.openai.com/account/billing
2. Ajouter des crédits (minimum $5)
3. Réessayer

### Logs

```bash
# API logs
cd packages/api
tail -f logs/app.log

# Worker logs
cd packages/worker
tail -f logs/worker.log

# Docker logs
docker-compose logs -f

# Specific service
docker-compose logs -f api
```

### Debug Mode

```bash
# Activer debug logs
export LOG_LEVEL=debug

# Relancer avec debug
pnpm start:dev
```

---

## 📊 Métriques et Monitoring

### Prometheus Metrics

Disponibles sur `/metrics` :

```
# Workflow metrics
soma_squad_ai_workflow_duration_seconds
soma_squad_ai_workflow_errors_total
soma_squad_ai_workflow_success_total

# API metrics
soma_squad_ai_api_requests_total
soma_squad_ai_api_response_time_seconds

# Billing metrics
soma_squad_ai_tokens_consumed_total
soma_squad_ai_cost_usd_total
```

### Grafana Dashboards

Accès : http://localhost:3001 (admin/admin)

**DevFlow Overview Dashboard :**
- Active workflows
- Success rate
- Average duration
- Cost tracking
- SLA compliance

### SLA Tracking

```yaml
# Configuration SLA
sla:
  maxDuration: 1800000  # 30 minutes
  criticalDuration: 600000  # 10 minutes
  targetSuccessRate: 0.95  # 95%
```

**Métriques SLA :**
- Temps moyen : 15-30 minutes
- Taux de succès : 94%
- Coverage tests : 85% moyenne

---

## 🔒 Sécurité

### Bonnes Pratiques

1. **Tokens :**
   - Ne jamais commiter dans git
   - Utiliser .env (dans .gitignore)
   - Rotation tous les 90 jours
   - GitHub App pour production

2. **Secrets :**
   - Utiliser secrets manager (AWS, Vault)
   - Chiffrement AES-256 au repos
   - Pas de logs de secrets

3. **API Keys :**
   - Scopes minimum requis
   - Surveillance usage
   - Alertes sur dépassements

4. **GDPR :**
   - Export données disponible
   - Suppression complète possible
   - Anonymisation après rétention
   - Audit logs complets

### Permissions GitHub Token

**Minimum requis :**
- `repo` (all) - Accès repositories

**GitHub App (production) :**
- Contents: Read & Write
- Pull requests: Read & Write
- Metadata: Read-only (auto)

---

## 💰 Coûts

### Structure Tarifaire

**Cloud (hébergé) :**
- Free : 10 tickets/mois
- Startup : $99/mois (illimité)
- Business : $499/mois + support
- Enterprise : Sur mesure

**Self-Hosted :**
- Community : Gratuit
- Pro : $1,999/an
- Enterprise : Sur mesure

### Coûts Variables

**LLM (par feature) :**
- Anthropic Claude : $1-3
- OpenAI GPT-4 : $0.5-2

**Infrastructure (self-hosted) :**
- PostgreSQL : inclus
- Redis : inclus
- Temporal : inclus
- Monitoring : inclus

---

## 📞 Support

**Documentation :**
- Ce fichier
- Code inline comments
- Types TypeScript

**Resources :**
- GitHub : https://github.com/your-org/soma-squad-ai
- Email : support@soma-squad-ai.io

**Tools :**
```bash
# Health check
soma-squad-ai doctor

# Status d'un ticket
soma-squad-ai status TASK-123

# Logs
docker-compose logs -f
```

---

## 🔄 Changelog

Le changelog est désormais maintenu dans `CHANGELOG.md`.

---

## 🎯 Roadmap

### Q1 2025

- [ ] Cursor AI provider (si API dispo)
- [ ] Azure DevOps support
- [ ] Preview deployments (Vercel, Render, Fly.io)

### Q2 2025

- [ ] GitHub App production setup
- [ ] Multi-tenancy complet
- [ ] SSO (Google, GitHub, Okta)
- [ ] Advanced caching
- [ ] Monorepo support

### Q3 2025

- [ ] ML pattern detection
- [ ] Automatic dependency updates
- [ ] Performance profiling
- [ ] Security scanning avancé

---

## 📝 Notes Importantes

### Limitations Connues

1. **Cursor AI :** Pas d'API publique
2. **Linear Comments :** Commentaire warning ajouté après génération spec
3. **Duplicate warnings :** Pas de détection de duplicates
4. **Cache :** Pas de cache des analyses codebase

### Compatibilité

**Node.js :** >= 20.0.0  
**pnpm :** >= 8.0.0  
**Docker :** >= 20.10  
**PostgreSQL :** >= 15  
**Redis :** >= 7

**OS :**
- ✅ macOS (Darwin)
- ✅ Linux
- ⚠️ Windows (via WSL2)

---

## 🏆 Succès Récents

- ✅ **12/12 tests** unitaires passent
- ✅ **4/4 packages** buildent sans erreurs
- ✅ **0 erreurs** TypeScript
- ✅ **Integration GitHub** complète et testée
- ✅ **MVP** Production Ready

---

## 📚 Fichiers Importants

```
soma-squad-ai/
├── DOCUMENTATION.md          # ← Ce fichier (consolidé)
├── .env.example              # Template configuration
├── docker-compose.yml        # Services Docker
├── soma-squad-ai.yml.example # Config projet
├── LICENSE                   # Licence propriétaire
└── packages/
    ├── api/
    │   └── src/
    │       └── projects/
    │           └── projects.service.ts  # Link repository
    ├── worker/
    │   └── src/
    │       ├── activities/
    │       │   ├── codebase.activities.ts  # Analyse repo
    │       │   └── linear.activities.ts    # Linear integration
    │       └── workflows/
    │           └── soma-squad-ai.workflow.ts  # Workflow principal
    └── sdk/
        └── src/
            ├── vcs/
            │   ├── github.provider.ts    # GitHub
            │   └── repository-utils.ts   # Utils parsing
            ├── codebase/
            │   ├── structure-analyzer.ts
            │   ├── dependency-analyzer.ts
            │   ├── code-similarity.service.ts
            │   └── documentation-scanner.ts
            └── agents/
                ├── anthropic.provider.ts  # Claude
                └── openai.provider.ts     # GPT-4
```

---

**Soma Squad AI v1.12.1** - De Linear à Production, Automatiquement. ✨

**Dernière mise à jour :** 6 décembre 2025  
**Status :** ✅ Production Ready  
**Prochaine version :** v1.13.0 (Q1 2025)

