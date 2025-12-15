# Sentry OAuth Setup Guide

**Version:** 1.0.0
**Date:** 15 décembre 2025
**Status:** Production Ready

## Vue d'ensemble

Ce guide décrit comment configurer l'intégration OAuth Sentry dans DevFlow pour permettre l'extraction automatique du contexte d'erreurs depuis vos projets Sentry.

## Architecture

DevFlow utilise OAuth 2.0 Authorization Code Flow pour se connecter à Sentry. L'intégration permet de:

- Récupérer les erreurs et événements depuis vos projets Sentry
- Extraire le contexte technique (stack traces, breadcrumbs, user context)
- Enrichir la génération de spécifications avec les informations d'erreurs réelles
- Prioriser les bugs basés sur la fréquence et l'impact dans Sentry

## Prérequis

- Un compte Sentry (sentry.io) avec accès à une organisation
- Permissions pour créer des OAuth Applications dans Sentry
- DevFlow API running (port 3001 recommandé)
- Un projet DevFlow créé (`devflow project:create`)

## Étape 1: Créer l'OAuth Application dans Sentry

### 1.1 Accéder aux Developer Settings

1. Connectez-vous à [sentry.io](https://sentry.io)
2. Allez dans **Settings** (⚙️) → **Developer Settings**
3. Cliquez sur **OAuth Applications** dans le menu latéral
4. Cliquez sur **Create New Application**

### 1.2 Configurer l'application

Remplissez les champs suivants:

**Application Name:**
```
DevFlow OAuth Integration
```

**Callback URL:**
```
http://localhost:3001/api/v1/auth/sentry/callback
```

**Note importante sur les Scopes:**
Contrairement à d'autres providers OAuth, Sentry ne configure PAS les scopes dans l'UI de l'OAuth Application. Les scopes sont passés dynamiquement dans l'URL d'autorisation via le paramètre `scope`.

**Scopes requis** (à passer dans l'URL d'autorisation):
- `org:read` - Lire les informations de l'organisation
- `project:read` - Lire les projets
- `project:write` - Écrire dans les projets (optionnel)
- `event:read` - Lire les événements et erreurs
- `member:read` - Lire les membres (optionnel)

### 1.3 Récupérer les credentials

Après création, notez:
- **Client ID**: Commence par un hash long (ex: `00ccd86b901050833512e1c0093a3d406d5b3476d3d8face4cecac42cc87fb36`)
- **Client Secret**: Également un hash long (ex: `8a4af4ef829f299f11178f15bf2ed5eb26bd4c615d5a524a63d35811726e1757`)

## Étape 2: Enregistrer l'OAuth App dans DevFlow

### Option A: Via l'API directement

```bash
curl -X POST http://localhost:3001/api/v1/auth/apps/register \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "your-project-id",
    "provider": "SENTRY",
    "clientId": "00ccd86b901050833512e1c0093a3d406d5b3476d3d8face4cecac42cc87fb36",
    "clientSecret": "8a4af4ef829f299f11178f15bf2ed5eb26bd4c615d5a524a63d35811726e1757",
    "redirectUri": "http://localhost:3001/api/v1/auth/sentry/callback",
    "scopes": ["org:read", "project:read", "project:write", "event:read", "member:read"],
    "flowType": "authorization_code"
  }'
```

### Option B: Via le CLI (à venir)

```bash
devflow oauth:register \
  --project your-project-id \
  --provider sentry \
  --client-id "00ccd86b..." \
  --client-secret "8a4af4ef..." \
  --redirect-uri "http://localhost:3001/api/v1/auth/sentry/callback" \
  --scopes "org:read,project:read,project:write,event:read,member:read"
```

### Option C: Via un fichier JSON

Créez un fichier `sentry-oauth.json`:

```json
{
  "projectId": "your-project-id",
  "provider": "SENTRY",
  "clientId": "00ccd86b901050833512e1c0093a3d406d5b3476d3d8face4cecac42cc87fb36",
  "clientSecret": "8a4af4ef829f299f11178f15bf2ed5eb26bd4c615d5a524a63d35811726e1757",
  "redirectUri": "http://localhost:3001/api/v1/auth/sentry/callback",
  "scopes": ["org:read", "project:read", "project:write", "event:read", "member:read"],
  "flowType": "authorization_code"
}
```

Puis enregistrez:

```bash
curl -X POST http://localhost:3001/api/v1/auth/apps/register \
  -H "Content-Type: application/json" \
  -d @sentry-oauth.json
```

## Étape 3: Connecter votre utilisateur

### Via le CLI

```bash
devflow oauth:connect sentry --project your-project-id
```

Cela va:
1. Ouvrir votre navigateur sur l'URL d'autorisation Sentry
2. Vous demander d'autoriser DevFlow
3. Rediriger vers le callback qui stockera les tokens
4. Afficher "OAuth connection established successfully"

### Via l'API directement

1. **Obtenir l'URL d'autorisation:**

```bash
curl -X POST http://localhost:3001/api/v1/auth/sentry/authorize \
  -H "Content-Type: application/json" \
  -d '{"projectId": "your-project-id"}'
```

Réponse:
```json
{
  "authUrl": "https://sentry.io/oauth/authorize/?client_id=...&scope=org:read+project:read+project:write+event:read+member:read&..."
}
```

2. **Visiter l'URL dans votre navigateur** et autoriser l'application

3. **Le callback est automatique** - vous serez redirigé vers `/api/v1/auth/sentry/callback` qui échangera le code contre des tokens

## Étape 4: Vérifier la connexion

```bash
# Via CLI
devflow oauth:status --project your-project-id

# Via API
curl http://localhost:3001/api/v1/auth/connections?project=your-project-id
```

Vous devriez voir:

```json
{
  "connections": [
    {
      "provider": "SENTRY",
      "status": "connected",
      "userId": "your-sentry-org-slug",
      "scopes": ["org:read", "project:read", "project:write", "event:read", "member:read"],
      "expiresAt": "2025-01-15T12:00:00Z"
    }
  ]
}
```

## Étape 5: Tester l'intégration

```bash
devflow integrations:test your-project-id
```

Vous devriez voir:

```
✅ Sentry: Connected
   OAuth token valid
   Ready to extract error context
```

## Variables d'environnement

### Variables système (DevFlow API)

Ces variables sont définies au niveau de l'API DevFlow, pas par projet:

```bash
# OAuth Token Encryption (REQUIRED)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
OAUTH_ENCRYPTION_KEY=<base64-string-32-bytes>

# Database (pour stocker les OAuth connections)
DATABASE_URL=postgresql://devflow:changeme@localhost:5432/devflow

# Redis (pour le cache des tokens)
REDIS_HOST=localhost
REDIS_PORT=6379

# API Configuration
PORT=3001
API_GLOBAL_PREFIX=api/v1
```

### Variables par projet (stockées en DB)

Ces informations sont stockées dans la table `oauth_apps` via l'API d'enregistrement:

- `projectId`: ID du projet DevFlow
- `provider`: "SENTRY"
- `clientId`: Client ID de votre OAuth App Sentry
- `clientSecret`: Client Secret (chiffré avec OAUTH_ENCRYPTION_KEY)
- `redirectUri`: URL de callback (doit matcher celle configurée dans Sentry)
- `scopes`: Liste des scopes OAuth
- `flowType`: "authorization_code"

### Exemple complet .env

```bash
# API
PORT=3001
API_GLOBAL_PREFIX=api/v1

# Database
DATABASE_URL=postgresql://devflow:changeme@localhost:5432/devflow

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# OAuth Encryption (REQUIRED)
OAUTH_ENCRYPTION_KEY=9qtS3m9XKViXxLagqeeVHdKiWgE1mLsXC6u3l9xoL6A=

# Temporal (pour les workflows)
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=devflow
```

## Architecture technique

### Flow OAuth Authorization Code

```
User → CLI → API /auth/sentry/authorize
                ↓
         Generate auth URL with scopes
                ↓
User visits Sentry OAuth URL → Authorize
                ↓
Sentry redirects to /auth/sentry/callback?code=xxx&state=xxx
                ↓
API exchanges code for access_token + refresh_token
                ↓
API calls /api/0/organizations/ to get user info
                ↓
Store tokens in DB (encrypted) + Redis cache
                ↓
Return success to user
```

### Endpoints disponibles

**Enregistrement:**
- `POST /api/v1/auth/apps/register` - Enregistrer une OAuth app

**Authorization Flow:**
- `POST /api/v1/auth/sentry/authorize` - Obtenir l'URL d'autorisation
- `GET /api/v1/auth/sentry/callback` - Callback OAuth (automatique)

**Gestion des tokens:**
- `POST /api/v1/auth/sentry/refresh` - Forcer le refresh d'un token
- `POST /api/v1/auth/sentry/disconnect` - Déconnecter Sentry
- `GET /api/v1/auth/connections` - Lister les connexions

**Utilisation:**
- `GET /api/v1/integrations/:projectId/test` - Tester toutes les intégrations

### Services impliqués

**`SentryIntegrationService`** (`packages/sdk/src/integrations/sentry.integration.ts`):
- `getIssue(projectId, issueId)` - Récupérer une erreur Sentry
- `getIssueEvents(projectId, issueId)` - Récupérer les événements d'une erreur
- `extractContext(projectId, issueId)` - Extraire le contexte complet

**`OAuthService`** (`packages/api/src/auth/services/oauth.service.ts`):
- `authorize(projectId, provider)` - Générer l'URL d'autorisation
- `handleCallback(provider, code, state)` - Traiter le callback
- `getUserInfo(provider, accessToken)` - Récupérer les infos utilisateur

**`TokenRefreshService`** (`packages/api/src/auth/services/token-refresh.service.ts`):
- `resolveToken(projectId, provider)` - Obtenir un token valide (auto-refresh)
- Implémente `ITokenResolver` pour l'injection dans les services d'intégration

## Scopes Sentry et permissions

### Scopes minimaux requis

```json
["org:read", "project:read", "event:read"]
```

### Scopes recommandés

```json
["org:read", "project:read", "project:write", "event:read", "member:read"]
```

### Description des scopes

- **`org:read`**: Lire les informations de l'organisation (requis pour `/api/0/organizations/`)
- **`project:read`**: Lire les projets et leur configuration
- **`project:write`**: Modifier les projets (utile pour créer des tags, notes)
- **`event:read`**: Lire les événements et erreurs (requis pour l'extraction de contexte)
- **`member:read`**: Lire les membres de l'équipe (utile pour l'assignation)
- **`team:read`**: Lire les équipes
- **`issue:read`**: Lire les issues (deprecated, utiliser `event:read`)

### Note importante sur les scopes Sentry

Contrairement à GitHub ou Linear, **Sentry ne stocke pas les scopes dans l'OAuth Application**. Les scopes sont passés dynamiquement dans l'URL d'autorisation via le paramètre `scope`:

```
https://sentry.io/oauth/authorize/
  ?client_id=xxx
  &scope=org:read+project:read+event:read
  &response_type=code
  &redirect_uri=...
```

Cela signifie que:
1. Vous pouvez demander différents scopes selon le contexte
2. L'utilisateur voit les permissions demandées au moment de l'autorisation
3. Les scopes accordés sont stockés avec le token dans DevFlow

## Troubleshooting

### Erreur: "403 Forbidden" sur `/api/0/users/me/`

**Cause:** L'endpoint `/users/me/` n'est pas accessible via OAuth tokens.

**Solution:** DevFlow utilise maintenant `/api/0/organizations/` qui fonctionne avec les scopes OAuth. Cette erreur ne devrait plus apparaître (fixée dans la version actuelle).

### Erreur: "No Sentry organizations found for this token"

**Cause:** Le token OAuth n'a accès à aucune organisation.

**Solutions:**
- Vérifier que le scope `org:read` est bien demandé
- Vérifier que l'utilisateur a bien autorisé l'application
- Vérifier que l'utilisateur a accès à au moins une organisation Sentry

### Erreur: "OAuth app not found for project"

**Cause:** L'OAuth app Sentry n'a pas été enregistrée pour ce projet.

**Solution:** Exécuter l'étape 2 (enregistrer l'OAuth app).

### Erreur: "Invalid client credentials"

**Cause:** Client ID ou Client Secret incorrect.

**Solutions:**
- Vérifier que les credentials sont corrects dans Sentry Developer Settings
- Réenregistrer l'OAuth app avec les bons credentials

### Erreur: "Redirect URI mismatch"

**Cause:** L'URL de callback ne correspond pas à celle configurée dans Sentry.

**Solutions:**
- Vérifier que l'URL dans Sentry est exactement: `http://localhost:3001/api/v1/auth/sentry/callback`
- Vérifier que l'API tourne bien sur le port 3001
- Pas d'espace, pas de trailing slash

### Token expiré automatiquement

**Comportement normal:** Les tokens Sentry expirent après un certain temps. DevFlow gère automatiquement le refresh via `TokenRefreshService`.

Si le refresh échoue:
1. Vérifier que le `refresh_token` existe dans la DB
2. Forcer un refresh: `POST /api/v1/auth/sentry/refresh`
3. Reconnecter si nécessaire: `devflow oauth:connect sentry`

## Production Deployment

### Callback URL pour production

Lors du déploiement en production, mettre à jour:

**Dans Sentry:**
```
https://api.devflow.io/api/v1/auth/sentry/callback
```

**Dans DevFlow (OAuth app registration):**
```json
{
  "redirectUri": "https://api.devflow.io/api/v1/auth/sentry/callback"
}
```

### Variables d'environnement production

```bash
# API publique
API_URL=https://api.devflow.io

# OAuth Encryption (générer un nouveau pour la prod)
OAUTH_ENCRYPTION_KEY=<nouveau-secret-32-bytes-base64>

# Database (managed PostgreSQL)
DATABASE_URL=postgresql://user:pass@prod-postgres.example.com:5432/devflow

# Redis (managed Redis)
REDIS_HOST=prod-redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=<redis-password>
```

### Sécurité

1. **OAUTH_ENCRYPTION_KEY:** Générer une clé unique pour chaque environnement (dev/staging/prod)
2. **Client Secret:** Ne jamais commiter dans le code, utiliser des secrets managers
3. **HTTPS:** Utiliser HTTPS en production pour les callbacks OAuth
4. **Rate Limiting:** Activer le rate limiting sur les endpoints OAuth
5. **CORS:** Configurer CORS pour autoriser uniquement votre domaine

## Intégration avec les workflows

Une fois Sentry connecté, les workflows DevFlow peuvent automatiquement:

1. **Enrichir les spécifications:**
   - Extraire le contexte d'erreur depuis Sentry
   - Ajouter les stack traces et breadcrumbs dans le markdown de spec
   - Identifier les patterns d'erreurs récurrents

2. **Prioriser les bugs:**
   - Analyser la fréquence des erreurs
   - Évaluer l'impact (nombre d'utilisateurs affectés)
   - Suggérer une priorité basée sur les métriques Sentry

3. **Générer des tests:**
   - Créer des tests de régression basés sur les erreurs Sentry
   - Reproduire les conditions qui ont causé l'erreur

4. **Créer des issues Linear:**
   - Créer automatiquement des issues Linear pour les erreurs critiques
   - Lier l'issue Linear à l'erreur Sentry

## Ressources

- [Sentry OAuth Documentation](https://docs.sentry.io/api/auth/)
- [Sentry API Reference](https://docs.sentry.io/api/)
- [DevFlow OAuth Architecture](./.docs/OAUTH_MULTITENANT.md)
- [DevFlow Documentation](./.docs/DOCUMENTATION.md)

## Support

Pour toute question ou problème:
1. Vérifier cette documentation
2. Consulter les logs: `docker-compose logs -f api`
3. Tester avec: `devflow integrations:test`
4. Créer une issue GitHub avec les détails

---

**Changelog:**
- **v1.0.0** (2025-12-15): Version initiale avec Authorization Code Flow et support multi-scopes
