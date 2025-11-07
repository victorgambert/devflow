# 🚀 Soma Squad AI - Guide Utilisateur

**Votre développement, de A à Z, automatisé.**

---

## 💡 Qu'est-ce que Soma Squad AI ?

**Soma Squad AI transforme vos tâches Notion en code déployé, automatiquement.**

Vous créez une tâche dans Notion avec une description et des critères de validation.  
Soma Squad AI s'occupe du reste : 
- Rédaction de la spec technique
- Écriture du code
- Création de la Pull Request
- Exécution des tests
- Correction automatique des bugs
- Déploiement d'une preview
- Merge et mise en production

**Résultat** : Vous gagnez des jours de travail sur chaque feature. Vous vous concentrez sur la stratégie, pas sur l'exécution.

---

## 🎯 À qui s'adresse Soma Squad AI ?

### Pour les équipes tech
- **Product Managers** : Décrivez vos features en langage naturel, obtenez du code fonctionnel.
- **Développeurs** : Concentrez-vous sur l'architecture et la revue, laissez l'implémentation à Soma Squad AI.
- **QA Engineers** : Tests automatiques, détection de flakiness, rapports complets.
- **Tech Leads** : Visibilité complète, SLA tracking, contrôle qualité automatique.

### Pour les organisations
- **Startups** : Livrez 3x plus vite avec la même équipe.
- **Scale-ups** : Standardisez vos pratiques de développement à travers toutes vos équipes.
- **Entreprises** : Conformité GDPR, audit complet, sécurité enterprise-grade.

---

## ✨ Ce que Soma Squad AI fait pour vous

### 🤖 Développement Autonome

**Vous écrivez** :
```
Titre : Ajouter un filtre par date sur la liste des articles
Description : L'utilisateur doit pouvoir filtrer les articles par date de publication
Critères : 
- Ajouter un date picker dans la sidebar
- Filtrer la liste en temps réel
- Afficher "Aucun résultat" si vide
```

**Soma Squad AI livre** :
- Une spec technique détaillée
- Le code frontend (React/Vue/Angular)
- Le code backend si nécessaire
- Les tests unitaires et E2E
- Une Pull Request prête à review
- Une preview app pour tester
- Les corrections si les tests échouent

**Vous validez et mergez.** C'est tout.

---

### 🧪 Qualité Garantie

Soma Squad AI ne livre pas du code "qui compile". Il livre du code **qui fonctionne**.

**Tests automatiques** :
- Tests unitaires générés pour chaque fonction
- Tests E2E qui simulent l'utilisateur final
- Tests de mutation pour vérifier la robustesse
- Détection des tests flaky (instables)

**Couverture de code** :
- Seuils configurables (ex: 80% minimum)
- Rapport détaillé par fichier
- Refus de merge si seuil non atteint

**Acceptance Criteria** :
- Vérification automatique que tous les critères sont couverts
- Mapping tests ↔ critères
- Rapport de conformité

---

### 🎨 Preview Apps Instantanées

Chaque Pull Request obtient une **URL de preview** automatiquement.

**Avantages** :
- Testez la feature avant de merger
- Partagez avec les stakeholders (PM, Design, Client)
- Validez l'UX en conditions réelles
- Pas besoin de lancer le projet en local

**Providers supportés** :
- Vercel (Next.js, React, Vue)
- Render (Node, Python, Ruby, Go)
- Fly.io (Docker, containers)
- Kubernetes (si vous hébergez vous-même)

Les previews sont **automatiquement supprimées** quand vous mergez ou fermez la PR.

---

### 📊 Visibilité Totale

**Dashboard Admin** :
- Vue d'ensemble de tous vos tickets en cours
- Temps moyen par étape (spec, dev, testing, etc.)
- Coûts LLM en temps réel
- SLA breaches (tickets qui dépassent le délai)
- Flakiness des tests

**Timeline par ticket** :
- Chaque étape avec sa durée
- Liens vers PR, CI, Preview
- Logs complets
- Traces distribuées pour debug

**Alertes Slack/Discord** :
- Workflow terminé ✅
- Workflow échoué ❌
- Tests qui fail
- PR mergée
- SLA breach

---

### 🔒 Sécurité & Conformité

**Policies automatiques** :
- Taille max de PR (ex: 500 lignes)
- Tests obligatoires
- Couverture minimum
- Pas de secrets dans le code
- Scan de vulnérabilités

**RGPD / GDPR** :
- Rétention configurable (ex: logs → 90 jours)
- Anonymisation automatique
- Export de données (JSON, CSV, PDF)
- Droit à l'oubli (suppression complète)

**Audit complet** :
- Qui a fait quoi, quand
- Historique des modifications
- Logs immuables
- Conformité SOC2/ISO27001

---

### 💰 Coûts Maîtrisés

Soma Squad AI utilise des modèles LLM (Claude, GPT-4) pour générer le code. Ces API sont payantes.

**Optimisation automatique** :
- Routage intelligent vers le provider le moins cher
- Utilisation de modèles légers pour les tâches simples
- Caching des réponses fréquentes
- Quotas configurables par organisation

**Facturation transparente** :
- Tickets traités : $0.50/ticket
- Minutes CI orchestrées : $0.01/minute
- Tokens LLM (input) : $3/million
- Tokens LLM (output) : $15/million
- Preview deploys : $0.10/deploy
- Preview hours : $0.05/heure

**Tableau de bord** :
- Usage en temps réel
- Prévision du coût du mois
- Historique des factures
- Alertes si dépassement

---

## 🚦 Comment ça marche ?

### 1️⃣ Connectez vos outils (une seule fois)

```bash
# Installer la CLI
npm install -g @soma-squad-ai/cli

# Initialiser dans votre projet
cd mon-projet
soma-squad-ai init

# Connecter Notion
soma-squad-ai connect notion

# Connecter GitHub (ou GitLab/Bitbucket)
soma-squad-ai connect github
```

✅ **Configuration terminée !** Soma Squad AI surveille maintenant votre base Notion.

---

### 2️⃣ Créez des tâches dans Notion

Dans votre base Notion, créez une tâche avec :

**Titre** : Court et clair (ex: "Ajouter export CSV")

**Description** : Contexte et objectif
```
Actuellement, les utilisateurs ne peuvent pas exporter leurs données.
Ils aimeraient un bouton "Export CSV" sur la page liste.
Le CSV doit contenir : nom, email, date d'inscription, statut.
```

**Acceptance Criteria** (Critères de validation)
```
- [ ] Bouton "Export CSV" visible en haut de la liste
- [ ] Clic sur le bouton télécharge un fichier .csv
- [ ] Le CSV contient les colonnes : nom, email, date, statut
- [ ] Le nom du fichier inclut la date (ex: export-2025-11-01.csv)
- [ ] Message de succès après téléchargement
```

**Status** : TODO → Soma Squad AI détecte et démarre

---

### 3️⃣ Soma Squad AI prend le relais

**Ce qui se passe (vous n'avez rien à faire)** :

1. **Spec** (2-5 min) : Soma Squad AI génère une spec technique détaillée
2. **Code** (5-15 min) : Le code est écrit (frontend + backend si besoin)
3. **PR** (30 sec) : Une Pull Request est créée sur GitHub
4. **CI** (5-10 min) : Vos tests CI tournent (lint, unit, e2e)
5. **Preview** (2-5 min) : Une URL de preview est générée
6. **QA** (3-5 min) : Soma Squad AI vérifie les acceptance criteria
7. **Fix** (si nécessaire) : Si des tests échouent, Soma Squad AI corrige
8. **Notification** : Slack vous informe "✅ TASK-123 prête à review"

**Durée totale** : 15-30 minutes en moyenne (vs plusieurs heures/jours manuellement)

---

### 4️⃣ Vous validez et mergez

**Review la Pull Request** :
- Code propre et bien commenté
- Tests inclus
- Preview app fonctionnelle
- Acceptance criteria validés ✅

**Option 1 : Merge manuel**
- Vous reviewez
- Vous approuvez
- Vous mergez

**Option 2 : Auto-merge** (si configuré)
- Si tous les tests passent
- Si tous les AC sont validés
- Soma Squad AI merge automatiquement

---

### 5️⃣ Le ticket passe à "Done"

- Status Notion → **Done** ✅
- Notification Slack → "🎉 TASK-123 mergée et déployée"
- Preview app → supprimée automatiquement
- Metrics → mises à jour (durée, coût, etc.)

---

## 💬 Commandes Utiles

### Via CLI

```bash
# Voir le statut d'un ticket
soma-squad-ai status TASK-123

# Relancer une étape spécifique
soma-squad-ai run TASK-123 --step dev

# Vérifier la santé du système
soma-squad-ai doctor

# Générer un template CI pour votre projet
soma-squad-ai templates ci --provider github
```

### Via Slack

```bash
# Voir le statut
/soma-squad-ai status TASK-123

# Relancer un workflow
/soma-squad-ai retry TASK-123

# Assigner à quelqu'un
/soma-squad-ai assign TASK-123 @john.doe
```

### Via l'Admin UI

Accédez à `https://admin.soma-squad-ai.io` :
- **Dashboard** : Vue d'ensemble (tickets actifs, durées, coûts)
- **Tickets** : Liste filtrable + détails par ticket
- **Billing** : Usage, factures, paiements
- **Settings** : Intégrations, feature flags, policies

---

## ⚙️ Configuration (fichier `.soma-squad-ai.yml`)

À la racine de votre projet, créez `.soma-squad-ai.yml` :

```yaml
project:
  name: mon-app
  type: node  # ou php, python, go, rust

repository:
  vcs_provider: github  # ou gitlab, bitbucket
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
  provider: vercel  # ou render, fly, k8s

guardrails:
  max_pr_size: 500  # lignes
  require_tests: true
  require_ac_coverage: true

notifications:
  slack:
    enabled: true
    channel: "#dev-notifications"
```

**C'est tout !** Soma Squad AI adapte son comportement à votre projet.

---

## 🎓 Exemples Concrets

### Exemple 1 : Feature Simple

**Tâche Notion** :
```
Titre: Ajouter un bouton "Partager" sur les articles
Description: Les utilisateurs veulent partager les articles sur Twitter/LinkedIn
AC:
- [ ] Bouton "Partager" sous chaque article
- [ ] Menu déroulant : Twitter, LinkedIn, Copy link
- [ ] Ouverture dans nouvel onglet
- [ ] Toast "Lien copié" si Copy link
```

**Résultat Soma Squad AI (20 minutes)** :
- Composant `ShareButton.tsx` créé
- Icons Twitter/LinkedIn ajoutés
- Tests unitaires du composant
- Test E2E du flow de partage
- Preview app avec le bouton fonctionnel

---

### Exemple 2 : Feature Complexe

**Tâche Notion** :
```
Titre: Dashboard analytics pour les admins
Description: Les admins doivent voir les stats (users actifs, revenus, taux de conversion)
AC:
- [ ] Page /admin/analytics protégée (rôle admin uniquement)
- [ ] 3 cartes : Users actifs (30j), Revenus (30j), Conversion
- [ ] Graphique ligne : évolution des users sur 6 mois
- [ ] Filtres : période (7j, 30j, 90j, 1an)
- [ ] Export CSV
- [ ] Responsive (mobile + desktop)
```

**Résultat Soma Squad AI (45 minutes)** :
- Route backend `/api/analytics` avec auth admin
- Requêtes SQL optimisées
- Page React avec 3 cartes + graphique (Recharts)
- Logique de filtres
- Endpoint `/api/analytics/export` pour CSV
- Tests unitaires backend (API + auth)
- Tests E2E (navigation, affichage, filtres, export)
- Preview app avec données de test

---

### Exemple 3 : Bug Fix

**Tâche Notion** :
```
Titre: Fix - La pagination ne fonctionne pas sur mobile
Description: Sur mobile, les boutons page suivante/précédente ne sont pas cliquables
AC:
- [ ] Boutons cliquables sur mobile (iOS + Android)
- [ ] Pas de régression sur desktop
- [ ] Taille des boutons suffisante (44x44px min)
```

**Résultat Soma Squad AI (15 minutes)** :
- Analyse du code existant (`Pagination.tsx`)
- Correction CSS (touch-action, min-height)
- Tests E2E mobile (viewport 375px)
- Tests E2E desktop (régression)
- Preview app testable sur mobile

---

## 🏢 Gestion Multi-Tenant (Organisations)

Soma Squad AI supporte plusieurs organisations avec :

**Isolation complète** :
- Chaque org a ses propres projets
- Chaque org a ses quotas (tokens, coûts)
- Chaque org a ses membres avec rôles (Owner, Admin, Maintainer, Viewer)

**Rôles** :
- **Owner** : Accès total (billing, suppression, membres)
- **Admin** : Gestion projets, quotas, membres (pas de billing)
- **Maintainer** : Relancer workflows, retry, merge policies
- **Viewer** : Lecture seule (tickets, métriques, rapports)

**Facturation séparée** :
- Chaque org reçoit sa propre facture
- Usage détaillé par projet
- Quotas configurables

---

## 🔐 Connexion & Sécurité

**Authentification** :
- **SSO** : Google, GitHub, Okta, Azure AD, Auth0
- **API Keys** : Pour intégrations (CI/CD, scripts)
- **2FA** : Authentification à deux facteurs (optionnel)

**Permissions granulaires** :
- Par rôle (Owner, Admin, Maintainer, Viewer)
- Par organisation
- Audit de tous les accès

---

## 📈 Métriques & SLA

Soma Squad AI suit automatiquement :

**Métriques par ticket** :
- Temps total (de TODO à Done)
- Temps par étape (spec, dev, testing, etc.)
- Nombre de retries
- Coût LLM
- Couverture de tests

**Métriques globales** :
- Tickets traités / jour
- Temps moyen de cycle
- Taux de succès (sans retry)
- Coût moyen par ticket
- Top consumers (projets/devs qui consomment le plus)

**SLA (Service Level Agreement)** :
- Définissez vos cibles (ex: "95% des tickets < 30 min")
- Alertes si breach (dépassement)
- Dashboard dédié

---

## 🆘 Support & Assistance

**Besoin d'aide ?**

- **Documentation** : Ce guide
- **Status d'un ticket** : `soma-squad-ai status TASK-123`
- **Health check** : `soma-squad-ai doctor`
- **Slack/Discord** : Rejoignez notre communauté
- **Email** : support@soma-squad-ai.io
- **Admin UI** : Live chat intégré

**Incident ?**
- Dashboard status : status.soma-squad-ai.io
- Uptime : 99.9% garanti
- Alertes automatiques si downtime

---

## 💡 Bonnes Pratiques

### ✅ Faire

**Écrire des critères de validation clairs** :
```
✅ Bon:
- [ ] Le bouton "Save" est désactivé si le formulaire est invalide
- [ ] Message d'erreur "Email invalide" sous le champ email
- [ ] Redirection vers /dashboard après succès

❌ Mauvais:
- [ ] Le formulaire doit fonctionner
```

**Décrire le contexte** :
```
✅ Bon:
Actuellement, les utilisateurs se plaignent que le formulaire 
n'affiche pas de feedback en cas d'erreur. Ils ne savent pas 
pourquoi le submit ne fonctionne pas.

❌ Mauvais:
Corriger le formulaire.
```

**Tester la preview** :
- Toujours vérifier la preview app avant de merger
- Partager avec PM/Design pour validation
- Tester sur mobile ET desktop

### ❌ Éviter

**Tâches trop vagues** :
```
❌ "Améliorer les performances"
✅ "Réduire le temps de chargement de la page /dashboard à < 2s"
```

**Tâches trop larges** :
```
❌ "Refonte complète du dashboard" (500+ lignes)
✅ Découper en plusieurs tâches (une par section)
```

**Oublier les cas edge** :
```
❌ "Ajouter un filtre par date"
✅ "Ajouter un filtre par date (avec gestion de dates invalides, 
    format DD/MM/YYYY, range picker)"
```

---

## 🎁 Avantages Concrets

### Avant Soma Squad AI

- ⏱️ **2-3 jours** pour livrer une feature simple
- 🐛 **Bugs fréquents** en production (manque de tests)
- 😰 **Stress** : Deadlines serrées, heures sup
- 💸 **Coût élevé** : Plus de devs nécessaires
- 🤷 **Manque de visibilité** : "C'est où cette feature ?"

### Après Soma Squad AI

- ⚡ **15-30 minutes** pour livrer une feature simple
- ✅ **Qualité garantie** : Tests auto, couverture 80%+
- 😌 **Sérénité** : Soma Squad AI livre à temps, vous validez
- 💰 **ROI positif** : Coût Soma Squad AI < coût d'un dev
- 📊 **Visibilité totale** : Dashboard, metrics, SLA

---

## 🚀 Prêt à démarrer ?

### Essai gratuit (14 jours)

1. **Créez un compte** : https://app.soma-squad-ai.io/signup
2. **Connectez vos outils** : Notion + GitHub (5 minutes)
3. **Créez une tâche test** : Feature simple pour tester
4. **Observez la magie** : Soma Squad AI livre en 20 minutes
5. **Décidez** : Continuez ou annulez (pas de CB requise)

### Installation Self-Hosted

Si vous préférez héberger Soma Squad AI vous-même :

```bash
# Via Docker Compose
git clone https://github.com/soma-squad-ai/soma-squad-ai.git
cd soma-squad-ai
cp env.example .env
docker-compose up -d

# Via Kubernetes
helm install soma-squad-ai ./helm/soma-squad-ai \
  --namespace=soma-squad-ai \
  --values=values.yaml
```

### Tarifs

**Cloud** (hébergé par nous) :
- Free : 10 tickets/mois
- Startup : $99/mois (illimité)
- Business : $499/mois (+ support prioritaire)
- Enterprise : Sur mesure

**Self-Hosted** (vous hébergez) :
- Community : Gratuit (features limitées)
- Pro : $1,999/an
- Enterprise : Sur mesure

👉 **Essayez gratuitement** : https://app.soma-squad-ai.io/signup

---

## 📞 Contact

- **Site** : https://soma-squad-ai.io
- **Email** : hello@soma-squad-ai.io
- **Slack** : [Rejoindre la communauté](https://soma-squad-ai.io/slack)
- **Twitter** : [@soma-squad-ai](https://twitter.com/soma-squad-ai)

---

**Soma Squad AI** - De Notion à Production, Automatiquement. 🚀



