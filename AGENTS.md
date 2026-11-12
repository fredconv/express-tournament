# AGENTS.md — Consignes communes (Codex, Claude Code)

Ce fichier fait foi pour tout agent travaillant sur le dépôt. En cas de conflit : **SPEC.md > ARCHITECTURE.md > ce fichier > habitudes de l'agent**.

## 1. Rôles

| Acteur | Responsabilités |
|---|---|
| **Utilisateur** | Valide les décisions produit (SPEC.md §7), priorise le backlog, fait les recettes manuelles terrain. |
| **Codex** | Conception, arbitrages techniques, audits ciblés (sécurité, moteur, revue d'étape). Propose ; n'élargit pas le périmètre. |
| **Claude Code** | Développement, tests, CI, déploiement, mise à jour de `HANDOFF.md`. |

Un agent qui découvre une question produit **s'arrête et la pose** à l'utilisateur au lieu de trancher.

## 2. Avant de commencer une tâche

1. Lire `HANDOFF.md` (s'il existe), puis l'étape en cours de ROADMAP.md.
2. Vérifier l'état réel du dépôt (`git status`, `git log -5`, CI) avant de croire le handoff.
3. Identifier les critères d'acceptation (SPEC.md) et la DoD (ROADMAP.md) visés.

## 3. Périmètre

- Seule la V1 décrite dans SPEC.md est développée.
- Toute idée, demande ou amélioration hors V1 → une ligne dans BACKLOG.md, **pas de code**.
- Pas de « préparation » de fonctionnalités V2 dans le code (champs, flags, abstractions inutilisées).
- Une anomalie non bloquante → BACKLOG.md « Anomalies non bloquantes » ; elle ne retarde pas la sortie.

## 4. Architecture — règles non négociables

- `src/domain/` est **pur** : aucun import de `react`, `hono`, `src/app`, `src/client`, `worker`, ni d'API navigateur/serveur (`fetch`, `localStorage`, `Date.now`, `Math.random`). Seule dépendance autorisée : `zod`.
- Le moteur de planification est **déterministe** et testable en Node sans navigateur.
- Seul `worker/repository.ts` contient du SQL. Seul `src/client/storage.ts` touche `localStorage`. Seul `src/client/api.ts` appelle `/api`.
- Toute écriture serveur passe par : schéma Zod → `validateSchedule()` → vérification du code de gestion → verrou de version.
- **Aucune nouvelle dépendance** (npm, service, framework) sans justification ajoutée à ARCHITECTURE.md §14 dans le même commit.
- Pas de réécriture ni de refactorisation hors de la tâche en cours.

## 5. Sécurité — règles non négociables

- Le code de gestion n'apparaît **jamais** dans une URL, un QR code, un log, une réponse publique, un message d'erreur ou le dépôt.
- Le serveur ne stocke que le hachage SHA-256 du code ; comparaison à temps constant.
- Interdits : `dangerouslySetInnerHTML`, `eval`, scripts ou polices tiers chargés depuis un CDN, assouplissement de la CSP sans ADR.
- Toute entrée est validée côté serveur, même si le client l'a déjà validée.
- Aucun secret dans le code, `.env*`/`.dev.vars` ignorés par Git ; aucun jeton de déploiement dans GitHub (Cloudflare Workers Builds déploie).

## 6. Code

- TypeScript `strict`, pas de `any` (sauf justification en commentaire), pas de `// @ts-ignore`.
- Identifiants et commentaires de code **en anglais** ; textes d'interface **en français**, centralisés dans `src/app/i18n/fr.ts` ; documentation projet en français.
- Fonctions courtes, noms explicites, pas de commentaire qui paraphrase le code.
- Composants React : fonctionnels, état local + hooks ; pas de gestionnaire d'état global en V1.
- Styles : CSS natif ; mobile d'abord ; `print.css` pour l'impression.

## 7. Tests

- Toute logique de `domain/` a des tests unitaires ; le moteur a des tests de propriétés (voir SPEC F4/F5).
- Toute route API a des tests (succès, 401, 404, 409, 422 selon le cas) contre D1 locale.
- Un bug corrigé = un test qui le reproduit d'abord.
- Les parcours P1 → P2 → P3 sont couverts par Playwright en viewport mobile (à partir de E6).
- Interdits dans `main` : `.only`, `.skip`, tests désactivés pour « faire passer » la CI.

## 8. Commandes

```bash
npm ci                 # installation
npm run dev            # SPA + Worker en local
npm run typecheck      # tsc -b (app, worker, config)
npm run lint           # biome check
npm run format         # biome check --write
npm test               # vitest
npm run build          # vite build (client + worker)
npm run check          # typecheck + lint + test + build
npm run cf-typegen     # régénère worker-configuration.d.ts après une modif de wrangler.jsonc
```
_(À ajouter quand l'étape les crée : `test:e2e` (E6), `db:migrate:local` (E0/E3). Mettre à jour cette liste si un script change.)_

## 9. Git

- `main` toujours déployable ; travail sur branches `e<N>-<sujet>` (ex. `e1-schedule-engine`) ou `fix-<sujet>`.
- Commits petits, au format Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`).
- Fusion seulement si la CI est verte. Pas de `--force` sur `main`, pas de `--no-verify`.
- Git est la source de vérité : une décision non commitée dans SPEC/ARCHITECTURE/BACKLOG n'existe pas.

## 10. Definition of Done

Voir ROADMAP.md : DoD commune + DoD de l'étape. Ne jamais déclarer une étape terminée sans avoir exécuté et constaté chaque vérification ; indiquer explicitement ce qui n'a pas pu être vérifié.

## 11. Continuité entre sessions

- `HANDOFF.md` (racine) est le fichier de suivi canonique : date, étape en cours, fait, reste, décisions, vérifications exécutées, blocages.
- Faits vérifiés et éléments à confirmer y sont séparés. Jamais de secret.
