# Configuration de l'Intégration Figma

**Version:** 2.1.0
**Dernière mise à jour:** 15 décembre 2025

## Vue d'ensemble

DevFlow extrait automatiquement le contexte design de Figma pendant le workflow de refinement. Cette intégration inclut :

- ✅ Métadonnées de fichier (nom, dernière modification)
- ✅ Commentaires de design non résolus
- ✅ Screenshots de frames/composants
- ✅ Analyse AI des screenshots (Claude Sonnet 4)

---

## Activation de l'Intégration

### Étape 1: Connecter OAuth Figma

```bash
# Via la CLI
devflow oauth:connect <project-id> figma

# Ou via l'API
curl -X POST http://localhost:3000/api/v1/auth/figma/authorize \
  -H "Content-Type: application/json" \
  -d '{"projectId": "your-project-id"}'
```

### Étape 2: Tester la Connexion

```bash
# Via la CLI
devflow integrations:test <project-id> --provider figma

# Via l'API
curl -X POST http://localhost:3000/api/v1/integrations/test/figma \
  -H "Content-Type: application/json" \
  -d '{"projectId": "your-project-id"}'
```

**Résultat attendu:**
```
✔ Testing Figma integration...
   Status: ✓ Connected
   User: victor@example.com (@victortest)
   Test: Successfully fetched file metadata
```

### Étape 3: Ajouter un Lien Figma dans Linear

Dans votre issue Linear, ajoutez l'URL Figma dans la description ou le custom field "Figma URL" :

```
https://www.figma.com/file/TfJw2zsGB11mbievCt5c3n/My-Design?node-id=1-2
```

DevFlow extraira automatiquement le contexte lors du refinement.

---

## Vision Analysis (Analyse AI des Screenshots)

La vision analysis utilise un modèle AI (par défaut Claude Sonnet 4) pour analyser les screenshots et générer des descriptions détaillées pour les développeurs.

### Activer/Désactiver

```bash
FIGMA_VISION_ENABLED=true  # true = actif (défaut), false = désactivé
```

**Quand désactiver:**
- Pour réduire les coûts d'API AI
- Si les screenshots ne sont pas nécessaires pour votre workflow
- En développement/test

**Impact du désactiver:**
- Pas d'analyse AI des designs
- Temps de refinement réduit de ~30-60 secondes
- Coût réduit (~$0.01-0.05 par screenshot)

### Choisir le Modèle AI

```bash
FIGMA_VISION_MODEL=anthropic/claude-sonnet-4
```

**Modèles supportés:**

| Modèle | Qualité | Vitesse | Coût | Recommandé pour |
|--------|---------|---------|------|-----------------|
| `anthropic/claude-sonnet-4` | ⭐⭐⭐⭐⭐ | Moyen | $$$ | Production (défaut) |
| `anthropic/claude-3.5-sonnet` | ⭐⭐⭐⭐ | Rapide | $$ | Dev/test, coûts réduits |
| `openai/gpt-4-turbo` | ⭐⭐⭐⭐ | Moyen | $$ | Alternative à Claude |

### Limiter le Nombre de Screenshots

```bash
FIGMA_VISION_MAX_SCREENSHOTS=3  # 1-10, défaut: 3
```

**Impact:**
- Plus de screenshots = plus de contexte mais plus lent et plus coûteux
- **Recommandé:** 3 pour un bon équilibre coût/qualité
- **Développement:** 1 pour tests rapides
- **Production critique:** 5-10 pour contexte maximum

### Timeout

```bash
FIGMA_VISION_TIMEOUT=30000  # millisecondes, défaut: 30 secondes
```

**Quand augmenter:**
- Connexions internet lentes
- Screenshots très complexes (>5MB)
- Modèles AI plus lents

**Impact:**
- Timeout plus court = échecs possibles sur connexions lentes
- Timeout plus long = refinements plus lents

---

## Trouver les Clés de Fichier Figma

L'API Figma nécessite une **file key** pour accéder aux fichiers.

### Depuis l'URL Figma

1. Ouvrez votre fichier sur Figma : https://www.figma.com/files
2. Copiez l'URL du fichier :

```
https://www.figma.com/file/TfJw2zsGB11mbievCt5c3n/Design-System
                             ^^^^^^^^^^^^^^^^^^^^^^^^
                             Cette partie est la file key
```

**Format valide:** 20-30 caractères alphanumériques (avec - ou _)

**Exemples:**
- ✅ Valide: `TfJw2zsGB11mbievCt5c3n`
- ✅ Valide: `abc123def456ghi789jkl0`
- ❌ Invalide: `invalid-key!` (caractères spéciaux)
- ❌ Invalide: `short` (trop court)

### Node ID (Optionnel)

Pour capturer un frame ou composant spécifique :

```
https://www.figma.com/file/TfJw2zsGB11mbievCt5c3n/Design?node-id=1-2
                                                                ^^^
                                                                Node ID
```

**Node ID** identifie un élément spécifique dans le fichier (page, frame, composant).

---

## Utilisation dans le Refinement

### Workflow Automatique

1. **Créer une issue Linear** avec status "To Refinement"
2. **Ajouter le lien Figma** dans la description ou le custom field "Figma URL"
3. **DevFlow extrait automatiquement:**
   - ✅ Nom du fichier et date de modification
   - ✅ Commentaires de design non résolus (max 10)
   - ✅ Screenshots du node (si spécifié)
   - ✅ Analyse AI des screenshots (si activée)
4. **Le contexte est injecté** dans le prompt de refinement

### Exemple de Contexte Extrait

```markdown
## Figma Design Context

**File:** Mobile App Redesign
**Last Modified:** 2025-12-14T10:30:00Z

### Design Comments (3)

1. **@designer**: Update button colors to match new brand guidelines
2. **@pm**: Need to add error states for all forms
3. **@eng**: Spacing between cards should be 16px, not 12px

### Screenshots & Design Analysis

#### Home Screen

**AI Design Analysis:**

This design represents a mobile app home screen with a modern, card-based layout.

**Key UI Components:**
- Navigation bar with profile avatar and notification bell
- Search bar with filter icon
- Grid of product cards (2x3 layout)
- Bottom navigation bar with 5 tabs

**Layout Structure:**
- Vertical scroll layout
- 16px padding on sides
- Cards have 12px spacing
- Rounded corners (8px radius)

**Notable Styling:**
- Primary color: #007AFF (blue)
- Card shadows: 0 2px 8px rgba(0,0,0,0.1)
- Typography: SF Pro Display
```

---

## Dépannage

### "OAuth connection inactive"

**Problème:** Token Figma expiré ou révoqué

**Diagnostic:**
```bash
devflow integrations:test <project-id> --provider figma
```

**Solution:**
```bash
devflow oauth:connect <project-id> figma
```

**Causes possibles:**
- Token expiré (durée de vie: 90 jours)
- Token révoqué manuellement sur Figma
- Permissions insuffisantes

---

### "Invalid Figma file key"

**Problème:** Format de clé incorrect

**Message d'erreur:**
```
Invalid Figma file key format: "invalid-key!".
Expected 20-30 alphanumeric characters (with - or _).
Example: TfJw2zsGB11mbievCt5c3n.
Find your file key in the URL: figma.com/file/<FILE_KEY>/...
```

**Solution:**
1. Vérifiez le format de la file key (20-30 caractères alphanumériques)
2. Copiez la file key depuis l'URL Figma (entre `/file/` et `/`)
3. Assurez-vous qu'il n'y a pas de caractères spéciaux

**Exemples valides:**
- `TfJw2zsGB11mbievCt5c3n`
- `abc123def456ghi789jkl0`
- `my-design-file-key-2024`

---

### "Figma authentication failed"

**Problème:** Token OAuth invalide ou expirant

**Message d'erreur:**
```
Figma authentication failed (403).
OAuth token may be expired or invalid.
Reconnect via: devflow oauth:connect <project-id> figma
```

**Solution:**
```bash
# 1. Vérifier la connexion
devflow integrations:test <project-id> --provider figma

# 2. Reconnecter si nécessaire
devflow oauth:connect <project-id> figma
```

**Prévention:**
- Les tokens Figma ont une durée de vie de 90 jours
- DevFlow rafraîchit automatiquement les tokens via refresh tokens
- Si le refresh échoue, vous devrez reconnecter manuellement

---

### "Vision analysis failed"

**Problème:** Timeout ou erreur du modèle AI

**Diagnostic:**
Vérifiez les logs de l'API :
```bash
docker-compose logs -f api | grep "Vision analysis"
```

**Solutions:**

1. **Augmenter le timeout:**
   ```bash
   FIGMA_VISION_TIMEOUT=60000  # 60 secondes au lieu de 30
   ```

2. **Essayer un autre modèle:**
   ```bash
   FIGMA_VISION_MODEL=anthropic/claude-3.5-sonnet  # Plus rapide
   ```

3. **Désactiver temporairement:**
   ```bash
   FIGMA_VISION_ENABLED=false
   ```

4. **Vérifier la clé API OpenRouter:**
   ```bash
   echo $OPENROUTER_API_KEY
   ```

**Causes possibles:**
- Connexion internet lente
- Screenshot trop volumineux (>10MB)
- Quota API dépassé
- Modèle AI indisponible

---

### "File not found"

**Problème:** File key incorrecte ou pas d'accès

**Message d'erreur:**
```
Figma file not found.
Check that the file key is correct and you have access to the file.
```

**Solution:**
1. Vérifier la file key dans l'URL Figma
2. S'assurer d'avoir accès au fichier (viewer minimum)
3. Vérifier que le fichier n'a pas été supprimé ou déplacé
4. Tester avec un autre fichier :
   ```bash
   devflow integrations:test <project-id> --provider figma
   ```

**Permissions Figma requises:**
- **Can view** : Minimum pour DevFlow
- **Can edit** : Non requis
- **Can admin** : Non requis

---

### "Figma API rate limit exceeded"

**Problème:** Trop de requêtes API

**Message d'erreur:**
```
Figma API rate limit exceeded. Try again in a few minutes.
```

**Limites Figma:**
- **150 requêtes par minute** par token OAuth
- **30,000 requêtes par heure** par token OAuth

**Solution immédiate:**
Attendre 1 minute pour que la limite se réinitialise.

**Prévention future:**
1. Réduire la fréquence des refinements
2. Activer le caching (à venir dans v2.2.0)
3. Utiliser des webhooks Figma au lieu de polling

---

## Configuration Complète

```bash
# =====================================
# Figma Integration
# =====================================

# OAuth (connecté par projet via CLI ou API)
# Pas de configuration requise ici

# Vision Analysis
FIGMA_VISION_ENABLED=true                      # Activer l'analyse AI
FIGMA_VISION_MODEL=anthropic/claude-sonnet-4   # Modèle AI
FIGMA_VISION_MAX_SCREENSHOTS=3                 # Nombre max de screenshots
FIGMA_VISION_TIMEOUT=30000                     # Timeout (ms)
```

---

## Exemples d'Utilisation

### Exemple 1: Issue Linear avec Design Simple

**Issue Linear:**
```
Title: Update homepage hero section
Description: Need to update the hero section based on new design.

Design: https://www.figma.com/file/abc123/Homepage?node-id=1-2
```

**Contexte Extrait:**
- Fichier: Homepage
- Node: Hero Section (1-2)
- 2 commentaires non résolus
- 1 screenshot avec analyse AI

**Temps d'exécution:** ~15-20 secondes

---

### Exemple 2: Issue avec Design Complexe

**Issue Linear:**
```
Title: Redesign checkout flow
Description: Complete checkout flow redesign with 5 screens.

Design: https://www.figma.com/file/xyz789/Checkout-Flow
```

**Contexte Extrait:**
- Fichier: Checkout Flow
- 12 commentaires non résolus (limité à 10)
- Pas de node-id → pas de screenshots
- Seulement métadonnées et commentaires

**Temps d'exécution:** ~5-10 secondes

---

### Exemple 3: Vision Analysis Désactivée

**Configuration:**
```bash
FIGMA_VISION_ENABLED=false
```

**Contexte Extrait:**
- Fichier: Mobile App
- Node: Login Screen
- 3 commentaires
- ❌ Pas d'analyse AI des screenshots

**Temps d'exécution:** ~5 secondes
**Coût:** $0 (pas d'API AI)

---

## Coûts et Performance

### Coûts Estimés (par refinement)

| Configuration | Coût AI | Temps | Qualité |
|---------------|---------|-------|---------|
| Vision désactivée | $0 | 5s | ⭐⭐⭐ |
| 1 screenshot (Sonnet 4) | $0.01-0.02 | 15s | ⭐⭐⭐⭐ |
| 3 screenshots (Sonnet 4) | $0.03-0.06 | 30s | ⭐⭐⭐⭐⭐ |
| 3 screenshots (3.5) | $0.02-0.04 | 20s | ⭐⭐⭐⭐ |

### Performance

**Extraction Figma seule:**
- Métadonnées: ~1-2 secondes
- Commentaires: ~1-2 secondes
- Screenshots: ~3-5 secondes par image

**Vision Analysis:**
- Claude Sonnet 4: ~8-12 secondes par screenshot
- Claude 3.5 Sonnet: ~5-8 secondes par screenshot
- GPT-4 Turbo: ~6-10 secondes par screenshot

**Total pour 3 screenshots (défaut):**
- Sans vision: ~10-15 secondes
- Avec vision: ~30-45 secondes

---

## Ressources

### Documentation Officielle

- [API Figma Documentation](https://www.figma.com/developers/api)
- [OAuth Figma Guide](https://www.figma.com/developers/api#oauth2)
- [DevFlow OAuth Setup](.docs/OAUTH_MULTITENANT.md)

### Support DevFlow

- GitHub Issues: https://github.com/devflow/devflow/issues
- Documentation: https://docs.devflow.ai
- Slack Community: https://devflow.slack.com

### Exemples de Code

**SDK Usage:**
```typescript
import { FigmaIntegrationService } from '@devflow/sdk';
import { TokenRefreshService } from '@devflow/sdk';

const tokenRefresh = new TokenRefreshService(redis, oauthService);
const figmaService = new FigmaIntegrationService(tokenRefresh);

// Get file metadata
const metadata = await figmaService.getFileMetadata(projectId, 'abc123');

// Get design context with screenshots
const context = await figmaService.getDesignContext(
  projectId,
  'abc123',
  '1-2' // node-id
);

// Test OAuth connection
const user = await figmaService.getUserInfo(projectId);
console.log(`Connected as: ${user.email}`);
```

---

## Changelog

### v2.1.0 (Décembre 2025)

**✨ Nouvelles fonctionnalités:**
- ✅ Configuration de la vision analysis (activer/désactiver, modèle, limites)
- ✅ Validation des file keys avec messages d'erreur clairs
- ✅ Gestion d'erreurs améliorée (404, 401, 429)
- ✅ Méthode `getUserInfo()` pour tester les connexions OAuth
- ✅ Documentation complète des variables d'environnement

**🐛 Corrections:**
- Fix: Messages d'erreur plus explicites pour tous les codes HTTP
- Fix: Validation file key accepte maintenant les tirets et underscores

**📚 Documentation:**
- Ajout: Guide complet FIGMA_CONFIGURATION.md
- Ajout: Tests d'intégration manuels améliorés
- Ajout: Section Figma dans CLAUDE.md

### v2.0.0 (Novembre 2025)

**✨ Fonctionnalités initiales:**
- ✅ OAuth par projet
- ✅ Extraction métadonnées et commentaires
- ✅ Screenshots et vision analysis
- ✅ Intégration dans refinement workflow
