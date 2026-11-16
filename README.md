# Tournoi Express

Organiser un tournoi de volley en quelques minutes et partager le planning par QR code.
Application web : React + Vite, API Hono sur Cloudflare Workers, base Cloudflare D1.

Production : https://express-tournament.fredconv.workers.dev

## Ce que fait l'application (V1)

- **Préparer** (sur l'appareil de l'organisateur, sans compte) : équipes saisies, collées, générées ou reprises de la bibliothèque d'équipes ; 1 à 6 terrains ; format des matchs ; horaires et pause de midi ; duplication d'un tournoi pour une nouvelle édition.
- **Jouer la journée** : tirage des poules du matin (3 à 5 équipes, verrouillage possible), planning sans trois matchs d'affilée, saisie des scores, forfaits et équipe partie, poules de niveau l'après-midi selon le classement, finale.
- **Partager** : publication en un clic, page publique `/t/<id>` lisible sans compte, QR code, impression A4 / PDF, filtres par équipe et par terrain.

Parcours détaillés et critères d'acceptation : [SPEC.md](SPEC.md).

Documents de référence : [SPEC.md](SPEC.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [ROADMAP.md](ROADMAP.md) · [BACKLOG.md](BACKLOG.md) · [AGENTS.md](AGENTS.md)

## Démarrage local

Prérequis : Node 22+ (voir `.node-version`).

```bash
npm ci
npm run dev        # SPA + Worker en local (http://localhost:5173)
```

## Vérifications

```bash
npm run check      # typecheck + lint + tests + build
```

## Déploiement

Cloudflare Workers Builds est relié au dépôt GitHub : chaque push sur `main` construit et déploie le Worker `express-tournament`.

Réglages attendus dans Cloudflare (Worker → Settings → Builds). Les onglets **Production** et **Previews Base** ont chacun leurs propres réglages :

| Réglage | Production (`main`) | Previews Base (autres branches) |
|---|---|---|
| Build command | `npm run build` | `npm run build` |
| Deploy / Preview command | `npx wrangler deploy` | `npx wrangler preview` |
| Root directory | `/` | `/` |

Sans build command, Wrangler échoue avec « The `assets` property … is missing the required `directory` property ».

Les prévisualisations de branche ignorent actuellement la build command du tableau de bord (fonction en bêta) : `wrangler.jsonc` déclare donc `build.command` et `assets.directory`, que Wrangler utilise pour construire lui-même. Le plugin Vite ignore ces deux options (avertissement attendu au build).

GitHub Actions (`.github/workflows/ci.yml`) exécute les vérifications sur chaque push et pull request ; il ne déploie pas.

Après une modification de `wrangler.jsonc`, régénérer les types : `npm run cf-typegen`.

## Tournois de test et simulation

Sur les prévisualisations de branche, l'accueil propose « Nouveau tournoi de test (15 équipes) » et l'onglet Journée un panneau « Simulation (test) » qui remplit les scores manquants (SPEC F15). En production, ces outils sont absents et le serveur refuse tout tournoi de test (variable `SIMULATION` dans `wrangler.jsonc`). En local, créer `.dev.vars` avec `SIMULATION=on` pour les activer.

## Base de données (D1)

| Base | Usage |
|---|---|
| `express-tournament-db` | production (`main`) |
| `express-tournament-db-preview` | prévisualisations de branche (`https://<branche>-express-tournament.fredconv.workers.dev`) |

Les migrations SQL sont dans `migrations/` (binding `DB`). Nécessite `npx wrangler login` pour les bases distantes.

```bash
npm run db:migrate:local     # base locale
npm run db:migrate:preview   # base de prévisualisation
npm run db:migrate:remote    # base de production
```

Une migration doit être **rétrocompatible** (ajouts uniquement) et appliquée à la prévisualisation puis à la production **avant** de fusionner le code qui en dépend. `wrangler.preview-db.jsonc` ne sert qu'à migrer la base de prévisualisation ; garder son `database_id` synchronisé avec le bloc `previews` de `wrangler.jsonc`.

## Limites connues (V1)

- **Gestion depuis un seul appareil** : le code de gestion d'un tournoi publié reste dans le navigateur qui l'a publié. Vider les données du site ou changer d'appareil empêche de le modifier (la page publique reste consultable).
- **Brouillons et bibliothèque d'équipes locaux** : stockés dans le navigateur, non synchronisés entre PC et téléphone (BACKLOG A26).
- **Connexion nécessaire** : pas de mode hors ligne (PWA au BACKLOG) ; la page publique affiche la dernière version chargée si une actualisation échoue.
- **Pas de suppression** d'un tournoi publié ni de purge automatique.
- **Phases fixes** : poules du matin, poules de niveau l'après-midi, finale entre les deux premiers de la poule Or ; pas de demi-finales.
- **Tests de bout en bout** (Playwright) non automatisés ; recettes sur vrai téléphone (QR, PDF Android) suivies dans `HANDOFF.md`.
- Les brouillons créés avant l'étape E3 ne sont plus lus.

Coût : 0 € (offres gratuites Workers et D1, sous-domaine `workers.dev`).
