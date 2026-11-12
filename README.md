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

Réglages attendus dans Cloudflare (Worker → Settings → Build) :

| Réglage | Valeur |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

GitHub Actions (`.github/workflows/ci.yml`) exécute les vérifications sur chaque push et pull request ; il ne déploie pas.

Après une modification de `wrangler.jsonc`, régénérer les types : `npm run cf-typegen`.
