# DevFlow End-to-End Tests

Tests E2E complets qui valident le système DevFlow de bout en bout via la CLI.

## Vue d'ensemble

Ces tests valident le **workflow complet** :
```
Utilisateur → CLI → API → Services → OAuth → Providers externes
```

Contrairement aux tests SDK qui importent directement les services, ces tests E2E utilisent la CLI pour simuler l'expérience utilisateur réelle.

## Scripts disponibles

### 1. `test-integrations-e2e.sh` - Test rapide des intégrations

Teste toutes les intégrations configurées pour un projet.

**Usage:**
```bash
./tests/e2e/test-integrations-e2e.sh <project-id>
```

**Ce qui est testé:**
1. ✅ Connectivité API
2. ✅ Existence du projet
3. ✅ Status OAuth (devflow oauth:status)
4. ✅ Configuration intégrations (devflow integrations:show)
5. ✅ Test global (devflow integrations:test)
6. ✅ Tests individuels par provider

**Exemple de sortie:**
```
🧪 DevFlow End-to-End Integration Tests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project ID: indy-promocode-prod
API URL: http://localhost:3000/api/v1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Checking API connectivity...

✅ API is reachable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. Testing all integrations...

🧪 Testing Integration Connections

Project: indy-promocode-prod
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✔ Testing GitHub integration...
   Status: ✓ Connected
   Test: Successfully fetched repository information
   testRepo: facebook/react

✔ Testing Linear integration...
   Status: ✓ Connected
   Test: Successfully queried Linear issues
   issuesFound: 5

📊 Test Summary
   Total: 4
   Passed: 2
   Not Configured: 2

⚠️  Some integrations are not configured yet.
```

### 2. `test-full-project-setup.sh` - Setup complet interactif

Guide complet de création et configuration d'un projet DevFlow.

**Usage:**
```bash
./tests/e2e/test-full-project-setup.sh
```

**Workflow interactif:**
1. ✅ Vérification des prérequis (CLI, API, env vars)
2. ✅ Création ou sélection d'un projet
3. ✅ Configuration OAuth (GitHub, Linear, Figma, Sentry)
4. ✅ Configuration des intégrations
5. ✅ Setup Linear custom fields
6. ✅ Tests de validation

**Exemple de session:**
```
🚀 DevFlow Full Project Setup E2E Test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This script will guide you through the complete DevFlow setup:
  1. ✓ Check prerequisites
  2. ✓ Create a new project
  3. ✓ Register OAuth applications
  4. ✓ Connect OAuth providers
  5. ✓ Configure integrations
  6. ✓ Test all integrations

Press Enter to continue...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Checking prerequisites...

✅ devflow CLI found
✅ API is reachable at http://localhost:3000/api/v1
✅ Environment variables configured

[... suite interactive ...]
```

## Prérequis

### 1. Infrastructure démarrée

```bash
docker-compose up -d postgres redis temporal
```

### 2. API démarrée

```bash
cd packages/api
pnpm dev
```

### 3. CLI buildée et linkée

```bash
cd packages/cli
pnpm build
pnpm link --global
```

### 4. Variables d'environnement

```bash
export DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow"
export OAUTH_ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
export DEVFLOW_API_URL="http://localhost:3000/api/v1"
```

## Commandes CLI testées

### OAuth

```bash
# Enregistrer une OAuth app
devflow oauth:register

# Connecter un provider
devflow oauth:connect <project-id> github
devflow oauth:connect <project-id> linear
devflow oauth:connect <project-id> figma
devflow oauth:connect <project-id> sentry

# Vérifier le status
devflow oauth:status <project-id>

# Lister les apps
devflow oauth:list <project-id>
```

### Intégrations

```bash
# Afficher la configuration
devflow integrations:show <project-id>

# Configurer les intégrations
devflow integrations:configure <project-id>

# Setup Linear custom fields
devflow integrations:setup-linear <project-id>

# Tester les intégrations
devflow integrations:test <project-id>
devflow integrations:test <project-id> --provider github
```

### Projets

```bash
# Créer un projet
devflow project:create

# Lister les projets
devflow project:list

# Afficher un projet
devflow project:show <project-id>
```

## Architecture testée

```
┌─────────────┐
│   Script    │  Tests E2E Shell
│   E2E       │
└──────┬──────┘
       │ devflow commands
       ↓
┌─────────────┐
│   CLI       │  packages/cli
│  (oclif)    │  - oauth:*
└──────┬──────┘  - integrations:*
       │         - project:*
       │ HTTP REST
       ↓
┌─────────────┐
│   API       │  packages/api
│  (NestJS)   │  - AuthController
└──────┬──────┘  - IntegrationsController
       │         - ProjectsController
       │
       ↓
┌─────────────┐
│  Services   │  Integration Services
│    SDK      │  - GitHubIntegrationService
└──────┬──────┘  - LinearIntegrationService
       │         - FigmaIntegrationService
       │         - SentryIntegrationService
       │
       ↓
┌─────────────┐
│   OAuth +   │  TokenRefreshService
│   Tokens    │  - Token resolution
└──────┬──────┘  - Automatic refresh
       │         - Redis cache
       │
       ↓
┌─────────────┐
│  External   │  GitHub, Linear, Figma, Sentry
│  Providers  │  APIs
└─────────────┘
```

## Cas d'usage

### Développement

```bash
# Test rapide après modifications
./tests/e2e/test-integrations-e2e.sh my-project-id
```

### CI/CD

```bash
# Dans votre pipeline CI
export PROJECT_ID="ci-test-project"
./tests/e2e/test-integrations-e2e.sh $PROJECT_ID || exit 1
```

### Validation post-déploiement

```bash
# Vérifier que tout fonctionne en production
DEVFLOW_API_URL="https://api.devflow.io/api/v1" \
./tests/e2e/test-integrations-e2e.sh prod-project-id
```

### Onboarding nouveau projet

```bash
# Guide interactif pour setup complet
./tests/e2e/test-full-project-setup.sh
```

## Debugging

### Mode verbose

Activez les logs de debug dans la CLI :

```bash
DEBUG=devflow:* devflow integrations:test <project-id>
```

### Logs API

Consultez les logs API pour voir les erreurs :

```bash
cd packages/api
pnpm dev
# Les logs s'affichent dans la console
```

### Vérification manuelle

Si un test échoue, vérifiez manuellement :

```bash
# 1. API accessible ?
curl http://localhost:3000/api/v1/health

# 2. Projet existe ?
devflow project:show <project-id>

# 3. OAuth connecté ?
devflow oauth:status <project-id>

# 4. Database accessible ?
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Project\";"
```

## Comparaison Tests SDK vs Tests E2E

| Aspect | Tests SDK | Tests E2E |
|--------|-----------|-----------|
| **Localisation** | `packages/sdk/src/__manual_tests__/` | `/tests/e2e/` |
| **Méthode** | Import direct des services | Via CLI |
| **Scope** | Tests unitaires/intégration | Tests système complet |
| **Setup** | Minimal (env vars) | Complet (CLI, API, infra) |
| **Vitesse** | Rapide | Plus lent |
| **Fiabilité** | Teste les services | Teste l'expérience utilisateur |
| **Usage** | Développement, debug | Validation, CI/CD, démo |

**Recommandation:** Utilisez les tests E2E pour valider le système complet avant un déploiement ou pour démontrer le fonctionnement à un utilisateur.

## Troubleshooting

### "devflow: command not found"

```bash
cd packages/cli
pnpm build
pnpm link --global
```

### "API is not reachable"

```bash
# Démarrer l'API
cd packages/api
pnpm dev
```

### "No OAuth connection found"

Connectez d'abord les providers :

```bash
devflow oauth:connect <project-id> github
devflow oauth:connect <project-id> linear
```

### Tests échouent avec "ECONNREFUSED"

Vérifiez que l'infrastructure est démarrée :

```bash
docker-compose ps
# Doit montrer postgres, redis, temporal en "Up"

docker-compose up -d
```

## Next Steps

Une fois les tests E2E validés, vous pouvez :

1. **Intégrer dans CI/CD** : Ajoutez les scripts dans votre pipeline
2. **Créer des Linear issues** : Testez le workflow complet de refinement
3. **Configurer les webhooks** : Activez l'automatisation complète
4. **Monitorer en production** : Utilisez les tests pour la surveillance

## Documentation

- [Integration Services Pattern](../../.docs/ARCHITECTURE.md#integration-services-pattern)
- [OAuth Multi-tenant](../../.docs/OAUTH_MULTITENANT.md)
- [CLI Commands](../../packages/cli/README.md)
- [Tests SDK](../../packages/sdk/src/__manual_tests__/README.md)
