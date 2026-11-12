# Tournoi Express

Organiser un tournoi de volley en quelques minutes et partager le planning par QR code.
Application web installable (PWA) : React + Vite, API Hono sur Cloudflare Workers, base Cloudflare D1.

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

GitHub Actions (`.github/workflows/ci.yml`) exécute les vérifications sur chaque push et pull request ; il ne déploie pas.

Après une modification de `wrangler.jsonc`, régénérer les types : `npm run cf-typegen`.

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
