# DevFlow Integration Tests

Scripts de test pour vérifier les connexions OAuth et l'extraction de contexte pour tous les services d'intégration.

## Vue d'ensemble

Ces scripts testent le nouveau **Integration Services Pattern** introduit dans la v1.1.0 :
- ✅ Vérification de la connexion OAuth
- ✅ Validation des tokens (refresh automatique si nécessaire)
- ✅ Extraction de contexte depuis chaque source
- ✅ Tests end-to-end des services d'intégration

## Types de tests

### 1. Tests SDK (Unitaires)
Tests directs des services d'intégration en important les modules SDK. Utiles pour le développement.

**Localisation:** `packages/sdk/src/__manual_tests__/test-*-integration.ts`

### 2. Tests E2E (CLI)
Tests complets utilisant la CLI DevFlow. **Recommandés pour valider le système complet.**

**Localisation:** `/tests/e2e/test-integrations-e2e.sh`

## Scripts disponibles

### 1. Test Global - `test-all-integrations.ts`

Vérifie toutes les intégrations en une seule commande.

```bash
DATABASE_URL="postgresql://..." \
PROJECT_ID="your-project-id" \
npx tsx src/__manual_tests__/test-all-integrations.ts
```

**Résultat attendu :**
```
🔌 DevFlow Integration Status Check

🔗 Testing GitHub Integration...
   ✅ Connected and working
   📦 Test: Fetched repository facebook/react

📋 Testing Linear Integration...
   ✅ Connected and working
   📋 Test: Found 5 issues with status "To Refinement"

🎨 Testing Figma Integration...
   ✅ Connected and working
   🎨 Test: Fetched file "Design System" (3 comments)

🐛 Testing Sentry Integration...
   ✅ Connected and working
   🐛 Test: Fetched issue "TypeError: Cannot read..." (resolved)

📊 Summary
Total Integrations: 4
Connected: 4/4
Active: 4/4
Working: 4/4
```

### 2. GitHub - `test-github-integration.ts`

Teste la connexion GitHub et l'extraction de contexte d'issues.

```bash
DATABASE_URL="postgresql://..." \
PROJECT_ID="your-project-id" \
GITHUB_OWNER="facebook" \
GITHUB_REPO="react" \
GITHUB_ISSUE="1" \
npx tsx src/__manual_tests__/test-github-integration.ts
```

**Ce qui est testé :**
- ✅ OAuth connection status
- ✅ Repository access
- ✅ Issue context extraction (title, body, author, dates)
- ✅ Comments extraction

### 3. Linear - `test-linear-integration.ts`

Teste la connexion Linear et l'extraction de tasks/issues.

```bash
DATABASE_URL="postgresql://..." \
PROJECT_ID="your-project-id" \
LINEAR_ISSUE_ID="DEV-123" \
LINEAR_STATUS="To Refinement" \
npx tsx src/__manual_tests__/test-linear-integration.ts
```

**Ce qui est testé :**
- ✅ OAuth connection status
- ✅ Task access by ID
- ✅ Query issues by status
- ✅ Comments extraction
- ✅ Query with filters

### 4. Figma - `test-figma-integration.ts`

Teste la connexion Figma et l'extraction de contexte design.

```bash
DATABASE_URL="postgresql://..." \
PROJECT_ID="your-project-id" \
FIGMA_FILE_KEY="TfJw2zsGB11mbievCt5c3n" \
FIGMA_NODE_ID="12252-33902" \
npx tsx src/__manual_tests__/test-figma-integration.ts
```

**Ce qui est testé :**
- ✅ OAuth connection status
- ✅ File metadata extraction
- ✅ Comments extraction
- ✅ Design context (metadata + comments + screenshots)
- ✅ Node images rendering
- ✅ Screenshot capture

### 5. Sentry - `test-sentry-integration.ts`

Teste la connexion Sentry et l'extraction de contexte d'erreurs.

```bash
DATABASE_URL="postgresql://..." \
PROJECT_ID="your-project-id" \
SENTRY_ISSUE_ID="1234567890" \
npx tsx src/__manual_tests__/test-sentry-integration.ts
```

**Ce qui est testé :**
- ✅ OAuth connection status
- ✅ Issue details extraction
- ✅ Latest event with stacktrace
- ✅ Full issue context

## Configuration OAuth requise

Avant d'exécuter les tests, assurez-vous que les OAuth apps sont configurées :

### GitHub (Device Flow)
```bash
POST /api/v1/auth/apps/register
{
  "projectId": "your-project-id",
  "provider": "GITHUB",
  "clientId": "your-github-client-id",
  "clientSecret": "your-github-client-secret",
  "flowType": "device"
}

# Puis connecter l'utilisateur
POST /api/v1/auth/github/device/initiate
{"projectId": "your-project-id"}
```

### Linear (Authorization Code)
```bash
POST /api/v1/auth/apps/register
{
  "projectId": "your-project-id",
  "provider": "LINEAR",
  "clientId": "your-linear-client-id",
  "clientSecret": "your-linear-client-secret",
  "flowType": "authorization_code"
}

# Puis connecter l'utilisateur
POST /api/v1/auth/linear/authorize
{"projectId": "your-project-id"}
```

### Figma (Authorization Code)
```bash
POST /api/v1/auth/apps/register
{
  "projectId": "your-project-id",
  "provider": "FIGMA",
  "clientId": "your-figma-client-id",
  "clientSecret": "your-figma-client-secret",
  "flowType": "authorization_code"
}

POST /api/v1/auth/figma/authorize
{"projectId": "your-project-id"}
```

### Sentry (Authorization Code)
```bash
POST /api/v1/auth/apps/register
{
  "projectId": "your-project-id",
  "provider": "SENTRY",
  "clientId": "your-sentry-client-id",
  "clientSecret": "your-sentry-client-secret",
  "flowType": "authorization_code"
}

POST /api/v1/auth/sentry/authorize
{"projectId": "your-project-id"}
```

## Variables d'environnement

### Requises pour tous les tests
- `DATABASE_URL` - URL de connexion PostgreSQL
- `PROJECT_ID` - ID du projet DevFlow à tester
- `OAUTH_ENCRYPTION_KEY` - Clé de chiffrement des tokens OAuth (32 bytes base64)

### Optionnelles (avec valeurs par défaut)
- `GITHUB_OWNER` - Propriétaire du repository GitHub (défaut: "facebook")
- `GITHUB_REPO` - Nom du repository GitHub (défaut: "react")
- `GITHUB_ISSUE` - Numéro de l'issue GitHub (défaut: "1")
- `LINEAR_ISSUE_ID` - ID de l'issue Linear (défaut: "DEV-1")
- `LINEAR_STATUS` - Status Linear à tester (défaut: "To Refinement")
- `FIGMA_FILE_KEY` - Clé du fichier Figma (défaut: "TfJw2zsGB11mbievCt5c3n")
- `FIGMA_NODE_ID` - ID du noeud Figma (défaut: "12252-33902")
- `SENTRY_ISSUE_ID` - ID de l'issue Sentry (optionnel)

## Script helper

Un script shell `run-integration-tests.sh` est fourni pour simplifier l'exécution :

```bash
# Tester toutes les intégrations
./run-integration-tests.sh all

# Tester une intégration spécifique
./run-integration-tests.sh github
./run-integration-tests.sh linear
./run-integration-tests.sh figma
./run-integration-tests.sh sentry
```

## Troubleshooting

### "No OAuth connection found"
Vérifiez que :
1. L'OAuth app est enregistrée via `/api/v1/auth/apps/register`
2. L'utilisateur a autorisé la connexion via le flow OAuth
3. Le `projectId` est correct

### "OAuth connection is inactive"
La connexion existe mais n'est pas active. Causes possibles :
- Token refresh a échoué
- L'utilisateur a révoqué l'accès
- L'OAuth app a été supprimée côté provider

Solution : Reconnecter via le flow OAuth.

### "Failed to refresh OAuth token"
Le refresh token est invalide ou expiré. Solution :
1. Vérifier les credentials de l'OAuth app
2. Reconnecter via le flow OAuth

## Architecture

Ces tests utilisent le pattern d'intégration unifié :

```typescript
// 1. Setup TokenResolver
const tokenRefresh = new TokenRefreshService(
  prisma, tokenEncryption, tokenStorage, oauthService
);

// 2. Create Integration Service
const githubService = new GitHubIntegrationService(tokenRefresh);

// 3. Use service (token resolution is automatic)
const repository = await githubService.getRepository(
  projectId, owner, repo
);
```

Ce pattern offre :
- ✅ **Testabilité** : Mock du TokenResolver pour les tests unitaires
- ✅ **Réutilisabilité** : Services utilisables dans API, Worker, CLI
- ✅ **Sécurité** : Gestion automatique du refresh et du chiffrement
- ✅ **Simplicité** : API claire et cohérente entre services

## Tests E2E avec CLI (Recommandé)

Pour tester le système complet de bout en bout, utilisez les scripts E2E qui passent par la CLI :

### Test rapide des intégrations

```bash
# Depuis la racine du projet
./tests/e2e/test-integrations-e2e.sh <project-id>
```

Ce script teste :
- ✅ Connectivité API
- ✅ Existence du projet
- ✅ Status OAuth de chaque provider
- ✅ Configuration des intégrations
- ✅ Fonctionnement de chaque intégration via CLI

### Setup complet d'un projet

```bash
# Depuis la racine du projet
./tests/e2e/test-full-project-setup.sh
```

Ce script interactif guide à travers :
1. Création de projet
2. Enregistrement des OAuth apps
3. Connexion des providers OAuth
4. Configuration des intégrations
5. Tests de toutes les intégrations

**Avantages des tests E2E :**
- ✅ Teste le flow complet CLI → API → Services → Providers
- ✅ Valide l'expérience utilisateur réelle
- ✅ Détecte les problèmes de configuration
- ✅ Scripts reproductibles

### Commandes CLI disponibles

```bash
# Tester toutes les intégrations
devflow integrations:test <project-id>

# Tester une intégration spécifique
devflow integrations:test <project-id> --provider github
devflow integrations:test <project-id> --provider linear
devflow integrations:test <project-id> --provider figma
devflow integrations:test <project-id> --provider sentry

# Status OAuth
devflow oauth:status <project-id>

# Configuration intégrations
devflow integrations:show <project-id>
devflow integrations:configure <project-id>
```

## Documentation

Pour plus d'informations :
- `.docs/ARCHITECTURE.md` - Architecture des services d'intégration
- `.docs/OAUTH_SECURITY_SCALABILITY.md` - Sécurité et scalabilité OAuth
- `.docs/OAUTH_MULTITENANT.md` - Architecture multi-tenant OAuth
- `/tests/e2e/` - Scripts de tests E2E complets
