# 🔗 Configuration du Repository Soma Squad AI

Ce guide explique comment connecter votre repository à Soma Squad AI pour la génération automatique de specs et de code.

---

## 🎯 Objectif

Configurer Soma Squad AI pour qu'il utilise automatiquement votre repository GitHub lors de :
- ✅ La génération de spécifications techniques
- ✅ La génération de code
- ✅ L'analyse du contexte de codebase
- ✅ La création de branches et PRs

---

## 🚀 Configuration Rapide (2 minutes)

### Étape 1 : Copier le fichier d'exemple

```bash
cd /Users/victor/Sites/soma-squad-ai
cp .env.example .env
```

### Étape 2 : Configurer votre repository

Éditez le fichier `.env` et ajoutez :

```bash
# 🐙 GitHub Token (REQUIS)
GITHUB_TOKEN=ghp_your_token_here

# 📦 Votre Repository (REQUIS pour auto-génération)
DEFAULT_REPO_OWNER=votre-username-github
DEFAULT_REPO_NAME=votre-nom-de-repo
DEFAULT_REPO_URL=https://github.com/votre-username/votre-repo
```

### Étape 3 : Exemples concrets

```bash
# Exemple 1 : Repo personnel
DEFAULT_REPO_OWNER=victor
DEFAULT_REPO_NAME=my-saas-app
DEFAULT_REPO_URL=https://github.com/victor/my-saas-app

# Exemple 2 : Repo d'organisation
DEFAULT_REPO_OWNER=acme-corp
DEFAULT_REPO_NAME=api-backend
DEFAULT_REPO_URL=https://github.com/acme-corp/api-backend

# Exemple 3 : Soma Squad AI lui-même
DEFAULT_REPO_OWNER=victor
DEFAULT_REPO_NAME=soma-squad-ai
DEFAULT_REPO_URL=https://github.com/victor/soma-squad-ai
```

---

## 📋 Configuration Complète

### Fichier .env complet pour Soma Squad AI

```bash
# =====================================================
# 🔐 GitHub Authentication
# =====================================================
# Get token from: https://github.com/settings/tokens
# Required scopes: repo (all)
GITHUB_TOKEN=ghp_your_actual_token_here

# =====================================================
# 📦 Default Repository Configuration
# =====================================================
# This repository will be used for:
# - Codebase analysis
# - Spec generation with context
# - Code generation
# - Branch/PR creation

DEFAULT_REPO_OWNER=victor
DEFAULT_REPO_NAME=my-project
DEFAULT_REPO_URL=https://github.com/victor/my-project

# =====================================================
# 🤖 AI Providers (at least one required)
# =====================================================
# Anthropic Claude (Recommended)
ANTHROPIC_API_KEY=sk-ant-your_key_here

# OpenAI GPT-4 (Alternative)
OPENAI_API_KEY=sk-proj-your_key_here

# =====================================================
# 📋 Notion Integration (Optional but recommended)
# =====================================================
NOTION_API_KEY=secret_your_key_here
NOTION_DATABASE_ID=your_database_id_here

# =====================================================
# 🗄️ Database
# =====================================================
DATABASE_URL=postgresql://soma-squad-ai:changeme@localhost:5432/soma-squad-ai?schema=public

# =====================================================
# ⏱️ Temporal (Workflow Engine)
# =====================================================
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=soma-squad-ai
```

---

## 🔄 Flux de Travail avec Repository Configuré

### Sans configuration (ancien comportement)

```
Notion Task → SPECIFICATION status
    ↓
⚠️  Error: Repository not configured
```

### Avec configuration (nouveau comportement)

```
Notion Task → SPECIFICATION status
    ↓
Soma Squad AI lit DEFAULT_REPO_* depuis .env
    ↓
Analyse automatique du repository via GitHub API
    ↓
Extraction de:
  - Structure du projet (TypeScript, Next.js, etc.)
  - Dépendances (package.json)
  - Conventions de code (README, docs/)
  - Patterns existants
    ↓
Génération de spec avec contexte complet
    ↓
Génération de code aligné avec votre codebase
    ↓
Création de branche + commits + PR
    ↓
✅ Ready for review!
```

---

## 🧪 Tester Votre Configuration

### Test 1 : Vérifier les variables d'environnement

```bash
cd /Users/victor/Sites/soma-squad-ai

# Vérifier que GITHUB_TOKEN est défini
grep GITHUB_TOKEN .env

# Vérifier que DEFAULT_REPO_* est défini
grep DEFAULT_REPO .env
```

**Résultat attendu :**
```
GITHUB_TOKEN=ghp_xxxxx
DEFAULT_REPO_OWNER=victor
DEFAULT_REPO_NAME=my-project
DEFAULT_REPO_URL=https://github.com/victor/my-project
```

### Test 2 : Tester l'accès au repository

```bash
cd packages/sdk

# Créer un fichier de test
cat > test-my-repo.ts << 'EOF'
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { GitHubProvider } from './src/vcs/github.provider';

async function test() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.DEFAULT_REPO_OWNER;
  const repo = process.env.DEFAULT_REPO_NAME;

  console.log('🔍 Testing repository access...');
  console.log(`   Repository: ${owner}/${repo}`);

  const github = new GitHubProvider(token!);

  try {
    const repoData = await github.getRepository(owner!, repo!);
    console.log('\n✅ SUCCESS!');
    console.log(`   Name: ${repoData.name}`);
    console.log(`   URL: ${repoData.url}`);
    console.log(`   Default Branch: ${repoData.defaultBranch}`);
  } catch (error) {
    console.error('\n❌ ERROR:', (error as Error).message);
  }
}

test();
EOF

# Lancer le test
npx ts-node test-my-repo.ts
```

**Résultat attendu :**
```
🔍 Testing repository access...
   Repository: victor/my-project

✅ SUCCESS!
   Name: my-project
   URL: https://github.com/victor/my-project
   Default Branch: main
```

### Test 3 : Analyse complète du codebase

```bash
cd /Users/victor/Sites/soma-squad-ai/packages/sdk

# Utiliser les variables d'environnement automatiquement
npx ts-node -e "
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import { GitHubProvider, analyzeRepository } from './src/index';

(async () => {
  const github = new GitHubProvider(process.env.GITHUB_TOKEN!);
  const context = await analyzeRepository(
    github,
    process.env.DEFAULT_REPO_OWNER!,
    process.env.DEFAULT_REPO_NAME!,
    'Test analysis'
  );
  console.log('✅ Codebase analyzed successfully!');
  console.log('Language:', context.structure.language);
  console.log('Framework:', context.structure.framework);
  console.log('Files:', context.structure.fileCount);
})();
"
```

---

## 🏗️ Utilisation avec l'API Soma Squad AI

### Créer un projet avec le repository par défaut

```bash
# Démarrer l'API
cd /Users/victor/Sites/soma-squad-ai/packages/api
npm run start:dev

# Dans un autre terminal, créer un projet
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mon Projet",
    "description": "Description du projet",
    "repository": "",
    "config": {
      "version": "1.0",
      "project": {},
      "vcs": {},
      "commands": {},
      "ci": {},
      "code_agent": {},
      "quality_gates": {},
      "notifications": {},
      "files": {}
    }
  }'

# Récupérer l'ID du projet créé
PROJECT_ID="xxxx"

# Lier le repository (utilise DEFAULT_REPO_* automatiquement)
curl -X POST http://localhost:3000/projects/$PROJECT_ID/link-repository \
  -H "Content-Type: application/json" \
  -d "{
    \"repositoryUrl\": \"$DEFAULT_REPO_URL\"
  }"
```

---

## 📦 Structure des Fichiers .env

### Où placer les .env ?

```
soma-squad-ai/
├── .env                           # ← Configuration globale (ROOT)
│   └── DEFAULT_REPO_*, GITHUB_TOKEN, etc.
│
├── packages/
│   ├── api/
│   │   └── .env                   # ← Hérite de la racine
│   │
│   ├── worker/
│   │   └── .env                   # ← Hérite de la racine
│   │
│   └── sdk/
│       └── .env                   # ← Pour les tests locaux
│           └── GITHUB_TOKEN uniquement
```

### Recommandation

**Option 1 : Fichier unique à la racine (recommandé)**
```bash
# Éditer une seule fois
/Users/victor/Sites/soma-squad-ai/.env

# Tous les packages l'utilisent
```

**Option 2 : Fichiers par package (pour tests isolés)**
```bash
# Pour tester SDK indépendamment
/Users/victor/Sites/soma-squad-ai/packages/sdk/.env

# Pour tester API indépendamment
/Users/victor/Sites/soma-squad-ai/packages/api/.env
```

---

## 🔐 Sécurité

### ✅ Ce qui est sécurisé

- `.env` est dans `.gitignore` - ne sera jamais commité
- Les tokens restent sur votre machine locale
- Chaque développeur a son propre `.env`

### ⚠️ Bonnes pratiques

```bash
# 1. Toujours vérifier avant commit
git status
# .env ne doit PAS apparaître

# 2. Utiliser des tokens à expiration courte
# Régénérer tous les 90 jours

# 3. Différents .env par environnement
.env.development
.env.staging
.env.production

# 4. Ne jamais partager les tokens
# Utiliser un gestionnaire de mots de passe
```

---

## 🚨 Troubleshooting

### "Repository not configured"

**Cause :** Variables DEFAULT_REPO_* manquantes

**Solution :**
```bash
# Vérifier le .env
cat .env | grep DEFAULT_REPO

# Si vide, ajouter :
echo "DEFAULT_REPO_OWNER=votre-username" >> .env
echo "DEFAULT_REPO_NAME=votre-repo" >> .env
echo "DEFAULT_REPO_URL=https://github.com/votre-username/votre-repo" >> .env
```

### "Bad credentials"

**Cause :** GITHUB_TOKEN invalide ou expiré

**Solution :**
```bash
# Régénérer le token
# https://github.com/settings/tokens

# Mettre à jour .env
nano .env
# Changer GITHUB_TOKEN=ghp_nouveau_token
```

### "Not Found" (404)

**Cause :** Erreur dans owner/repo ou token sans accès

**Solution :**
```bash
# Vérifier l'orthographe exacte
# Aller sur GitHub et copier l'URL exacte
# Format : https://github.com/OWNER/REPO

# Vérifier le token a accès au repo
# Si privé, le token doit avoir scope 'repo'
```

---

## 📚 Ressources

- **Générer GitHub Token :** https://github.com/settings/tokens
- **Notion Integrations :** https://www.notion.so/my-integrations
- **Anthropic API Keys :** https://console.anthropic.com/settings/keys
- **Guide GitHub App :** `/Users/victor/Sites/soma-squad-ai/GITHUB_APP_SETUP.md`

---

## 🎯 Checklist de Configuration

- [ ] Copié `.env.example` vers `.env`
- [ ] Ajouté `GITHUB_TOKEN`
- [ ] Configuré `DEFAULT_REPO_OWNER`
- [ ] Configuré `DEFAULT_REPO_NAME`
- [ ] Configuré `DEFAULT_REPO_URL`
- [ ] Ajouté au moins une clé AI (`ANTHROPIC_API_KEY` ou `OPENAI_API_KEY`)
- [ ] Testé l'accès au repository
- [ ] Vérifié que `.env` est dans `.gitignore`
- [ ] Démarré l'API et le worker
- [ ] Créé un projet de test
- [ ] Testé la génération de spec

---

**C'est tout ! Votre repository est maintenant connecté à Soma Squad AI.** 🎉

Quand une tâche Notion passera en statut "SPECIFICATION", Soma Squad AI :
1. Analysera automatiquement votre repository
2. Générera une spec avec le contexte de votre codebase
3. Générera du code aligné avec vos conventions
4. Créera une PR prête à review

**Questions ?** Voir les autres guides :
- `QUICK_TEST_GUIDE.md` - Tester rapidement
- `GITHUB_APP_SETUP.md` - Configuration GitHub App
- `INTEGRATION_COMPLETE.md` - Vue d'ensemble complète
