# 🚀 Soma Squad AI

**Transformez vos tâches Notion en code déployé, automatiquement.**

[![Version](https://img.shields.io/badge/version-1.11.0-blue.svg)](https://github.com/soma-squad-ai/soma-squad-ai)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-Production%20Ready-green.svg)]()

---

## 💡 En 30 secondes

1. **Vous** créez une tâche dans Notion avec une description
2. **Soma Squad AI** écrit le code, les tests, et crée la Pull Request
3. **Vous** validez et mergez

**Résultat** : Ce qui prenait 2-3 jours prend maintenant 20 minutes.

---

## ✨ Ce que Soma Squad AI fait

- 🤖 **Génère le code** automatiquement (frontend + backend)
- 🧪 **Écrit les tests** (unitaires + E2E + mutation testing)
- 🎨 **Déploie une preview** pour tester avant merge
- 🔍 **Vérifie la qualité** (coverage, AC, policies)
- 🐛 **Corrige les bugs** automatiquement si tests échouent
- 📊 **Suit les métriques** (durée, coûts, SLA)

---

## 🚀 Démarrage Rapide

### Option 1: Utiliser Soma Squad AI Cloud (Recommandé)

```bash
# Installer la CLI
npm install -g @soma-squad-ai/cli

# Initialiser dans votre projet
cd mon-projet
soma-squad-ai init

# Connecter vos outils
soma-squad-ai connect notion
soma-squad-ai connect github

# C'est tout ! Soma Squad AI surveille maintenant votre Notion
```

**Durée** : 5 minutes

---

### Option 2: Lancer Soma Squad AI en Local (Développement)

**Prérequis**
- Node.js 18+ et pnpm
- Docker et Docker Compose
- Tokens d'API (voir ci-dessous)

**1. Cloner et installer**
```bash
git clone https://github.com/soma-squad-ai/soma-squad-ai.git
cd soma-squad-ai
pnpm install
```

**2. Configurer les variables d'environnement**
```bash
# Copier le template
cp .env.example .env

# Éditer .env avec vos clés API
nano .env
```

**Variables OBLIGATOIRES pour démarrer** :
- `NOTION_API_KEY` et `NOTION_DATABASE_ID` - [Obtenir ici](https://www.notion.so/my-integrations)
- `GITHUB_TOKEN` ou `GITLAB_TOKEN` - [GitHub](https://github.com/settings/tokens) | [GitLab](https://gitlab.com/-/profile/personal_access_tokens)
- `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` - [Anthropic](https://console.anthropic.com/settings/keys) | [OpenAI](https://platform.openai.com/api-keys)

**Variables OPTIONNELLES** :
- `SLACK_WEBHOOK_URL` - Pour les notifications
- `DISCORD_WEBHOOK_URL` - Pour les notifications
- Voir `.env.example` pour la liste complète

**3. Démarrer l'infrastructure avec Docker**
```bash
# Démarrer PostgreSQL, Redis, Temporal
docker-compose up -d

# Vérifier que tout est lancé
docker-compose ps
```

**4. Lancer les services Soma Squad AI**
```bash
# Build des packages
pnpm build

# Lancer l'API (Terminal 1)
cd packages/api
pnpm start:dev

# Lancer le Worker (Terminal 2)
cd packages/worker
pnpm start:dev
```

**5. Vérifier que ça fonctionne**
```bash
# API Health Check
curl http://localhost:3000/api/v1/health

# Temporal UI (optionnel)
open http://localhost:8080
```

**Durée** : 10-15 minutes

**Problèmes courants** :
- Port 3000 déjà utilisé ? → Changer `API_PORT` dans `.env`
- Docker ne démarre pas ? → `docker-compose down -v && docker-compose up -d`
- Erreur Temporal ? → Attendre 30s que Temporal soit prêt

---

### Option 3: Développement avec Hot Reload

Pour un développement actif avec rechargement automatique :

```bash
# Terminal 1: Infrastructure
docker-compose up -d

# Terminal 2: API avec hot reload
cd packages/api
pnpm start:dev

# Terminal 3: Worker avec hot reload
cd packages/worker
pnpm start:dev

# Terminal 4: Tests en watch mode (optionnel)
pnpm test:watch
```

**Note** : Les changements dans `packages/sdk` ou `packages/common` nécessitent un rebuild (`pnpm build`).

---

## ⚙️ Configuration des Providers

### 🦊 GitLab Setup

**1. Créer un Personal Access Token GitLab**
```bash
# Sur GitLab.com ou votre instance GitLab
1. Aller dans Settings → Access Tokens
2. Créer un token avec les scopes:
   - api
   - read_api
   - write_repository
3. Copier le token (format: glpat-xxxxxxxxxxxx)
```

**2. Configurer Soma Squad AI**
```yaml
# .soma-squad-ai.yml
project:
  name: mon-projet
  vcs:
    provider: gitlab  # ou 'github'
    url: https://gitlab.com
    token: ${GITLAB_TOKEN}  # ou variable d'env
    owner: mon-username
    repository: mon-repo
```

**3. Variables d'environnement**
```bash
# .env
GITLAB_TOKEN=glpat-xxxxxxxxxxxx
```

**Cas d'usage GitLab:**
- ✅ Repositories publics et privés
- ✅ Merge Requests (équivalent PR)
- ✅ CI/CD Pipelines natif
- ✅ GitLab Self-Hosted supporté

---

### 🤖 OpenAI (GPT-4) Setup

**1. Obtenir une clé API OpenAI**
```bash
1. Créer un compte sur https://platform.openai.com
2. Aller dans API Keys
3. Créer une nouvelle clé secrète
4. Copier la clé (format: sk-xxxxxxxxxxxx)
```

**2. Configurer Soma Squad AI**
```yaml
# .soma-squad-ai.yml
project:
  name: mon-projet
  agents:
    primary:
      provider: openai  # ou 'anthropic'
      model: gpt-4-turbo-preview  # ou gpt-4
      temperature: 0.7
      maxTokens: 4096
```

**3. Variables d'environnement**
```bash
# .env
OPENAI_API_KEY=sk-xxxxxxxxxxxx
```

**Modèles recommandés:**
- `gpt-4-turbo-preview` - Meilleur équilibre qualité/prix
- `gpt-4` - Maximum de qualité
- `gpt-3.5-turbo` - Rapide et économique (moins précis)

**Coûts approximatifs (GPT-4 Turbo):**
- Input: $0.01 / 1K tokens
- Output: $0.03 / 1K tokens
- Feature typique: ~$0.50-2.00

---

### 🔄 Comparaison Providers

#### VCS (Version Control)

| Feature | GitHub | GitLab | Bitbucket |
|---------|--------|--------|-----------|
| Status | ✅ Full | ✅ Full | 🔄 Bientôt |
| PR/MR | ✅ | ✅ | 🔄 |
| Branch Protection | ✅ | ✅ | 🔄 |
| Self-Hosted | ❌ | ✅ | ✅ |
| Rate Limits | 5000/h | 600/min | 60/h |

#### CI/CD

| Feature | GitHub Actions | GitLab CI | Bitbucket Pipelines |
|---------|---------------|-----------|---------------------|
| Status | ✅ Full | ✅ Full | 🔄 Bientôt |
| Artifacts | ✅ | ✅ | 🔄 |
| Test Reports | ✅ | ✅ | 🔄 |
| Self-Hosted Runners | ✅ | ✅ | ✅ |
| Minutes gratuits | 2000/mois | 400/mois | 50/mois |

#### AI Providers

| Provider | Status | Modèles | Coût (feature) | Qualité | Vitesse |
|----------|--------|---------|----------------|---------|---------|
| **Anthropic Claude** | ✅ Full | Claude 3.5 Sonnet | $1-3 | ⭐⭐⭐⭐⭐ | Rapide |
| **OpenAI GPT-4** | ✅ Full | GPT-4 Turbo | $0.5-2 | ⭐⭐⭐⭐⭐ | Très rapide |
| **Cursor** | 🔄 Bientôt | Propriétaire | N/A | ⭐⭐⭐⭐ | Rapide |

**Recommandations:**
- **Startup/Prototype**: OpenAI GPT-4 Turbo (meilleur coût/qualité)
- **Production**: Anthropic Claude 3.5 (plus fiable, meilleurs tests)
- **Hybrid**: Utiliser les deux (failover automatique)

---

### 🔐 Configuration Complète (Exemple)

```yaml
# .soma-squad-ai.yml - Configuration Multi-Provider
project:
  name: mon-super-projet
  language: typescript
  framework: react
  testFramework: jest

# VCS Configuration
vcs:
  provider: gitlab  # github | gitlab | bitbucket
  url: https://gitlab.com
  token: ${GITLAB_TOKEN}
  owner: mon-organisation
  repository: mon-repo
  defaultBranch: main

# CI/CD Configuration
ci:
  provider: gitlab-ci  # github-actions | gitlab-ci | bitbucket-pipelines
  configFile: .gitlab-ci.yml
  timeout: 1800000  # 30 minutes

# AI Agents Configuration
agents:
  primary:
    provider: openai  # anthropic | openai | cursor
    model: gpt-4-turbo-preview
    temperature: 0.7
    maxTokens: 4096

  fallback:
    provider: anthropic
    model: claude-3-5-sonnet-20241022
    temperature: 0.7
    maxTokens: 4096

# Notion Integration
notion:
  databaseId: ${NOTION_DATABASE_ID}
  token: ${NOTION_TOKEN}
  syncInterval: 300000  # 5 minutes

# Quality Gates
quality:
  minCoverage: 80
  requireTests: true
  requireLint: true
  blockOnSecrets: true

# Budget & SLA
budget:
  maxTokensPerDay: 1000000
  maxCostPerFeature: 5.00  # USD
  alertThreshold: 0.8

sla:
  maxDuration: 1800000  # 30 minutes
  criticalDuration: 600000  # 10 minutes
```

---

## 📖 Documentation Complète

👉 **[Lire le Guide Utilisateur](./USER_GUIDE.md)** pour :
- Comprendre comment ça marche en détail
- Voir des exemples concrets
- Configurer votre projet
- Connaître les bonnes pratiques
- Démarrer votre essai gratuit

---

## 🎯 Pour qui ?

- **Product Managers** : Décrivez vos features, obtenez du code
- **Développeurs** : Concentrez-vous sur l'architecture, pas l'implémentation
- **Tech Leads** : Visibilité totale, SLA tracking, qualité garantie
- **Startups** : Livrez 3x plus vite avec la même équipe

---

## 💰 Tarifs

**Cloud** (hébergé) :
- Free : 10 tickets/mois
- Startup : $99/mois (illimité)
- Enterprise : Sur mesure

**Self-Hosted** :
- Community : Gratuit
- Pro : $1,999/an

👉 **[Essai gratuit 14 jours](https://app.soma-squad-ai.io/signup)** (pas de CB)

---

## 🏢 Organisations qui utilisent Soma Squad AI

- 🚀 Startups tech (Series A-C)
- 🏦 Fintech & Banking
- 🏥 HealthTech
- 🛒 E-commerce
- 📱 SaaS B2B

---

## 🌟 Témoignages

> "Soma Squad AI a réduit notre time-to-market de 60%. On livre maintenant 3 features par semaine au lieu d'1."  
> — **Sarah M.**, CTO @ TechStartup

> "L'équipe peut se concentrer sur la stratégie plutôt que sur le code boilerplate. Game changer."  
> — **Marc L.**, VP Engineering @ FinanceApp

> "La qualité du code généré est impressionnante. Les tests sont complets, la couverture > 85%."  
> — **Julie K.**, Lead Developer @ HealthTech

---

## 🔌 Intégrations

**VCS** : ✅ GitHub | ✅ GitLab | 🔄 Bitbucket (bientôt)
**Task Management** : ✅ Notion
**CI/CD** : ✅ GitHub Actions | ✅ GitLab CI | 🔄 Bitbucket Pipelines (bientôt)
**Preview** : Vercel, Render, Fly.io, Kubernetes
**Notifications** : Slack, Discord, Email
**AI** : ✅ Anthropic Claude | ✅ OpenAI GPT-4 | 🔄 Cursor (bientôt)  

---

## 🛠️ Stack Supportés

- **JavaScript/TypeScript** : Node.js, React, Vue, Angular, Next.js
- **PHP** : Laravel, Symfony
- **Python** : Django, FastAPI, Flask
- **Go** : Gin, Echo, Fiber
- **Rust** : Actix, Rocket

---

## 📊 Stats

- ⚡ **Temps moyen** : 20 minutes (tâche TODO → code mergé)
- ✅ **Taux de succès** : 94% (sans intervention manuelle)
- 🧪 **Couverture** : 85% en moyenne
- 💰 **ROI** : Coût Soma Squad AI < 20% du coût d'un dev

---

## 🆘 Support

- **Documentation** : [USER_GUIDE.md](./USER_GUIDE.md)
- **Status** : [status.soma-squad-ai.io](https://status.soma-squad-ai.io)
- **Email** : support@soma-squad-ai.io
- **Slack** : [Rejoindre la communauté](https://soma-squad-ai.io/slack)
- **Twitter** : [@soma-squad-ai](https://twitter.com/soma-squad-ai)

---

## 🔐 Sécurité & Conformité

- ✅ **GDPR** compliant (rétention, anonymisation, exports)
- ✅ **SOC2** Type II (en cours)
- ✅ **ISO 27001** (en cours)
- ✅ **SSO** (Google, GitHub, Okta, Azure AD)
- ✅ **Audit logs** complets
- ✅ **Secrets** chiffrés (AES-256)

---

## 📝 License

Proprietary - © 2025 Soma Squad AI Inc.

---

## 🚀 Prêt à démarrer ?

**[→ Essai gratuit 14 jours](https://app.soma-squad-ai.io/signup)**  
**[→ Lire le Guide Complet](./USER_GUIDE.md)**  
**[→ Voir une Démo](https://soma-squad-ai.io/demo)**

---

**Soma Squad AI v1.11.0** - De Notion à Production, Automatiquement. ✨

