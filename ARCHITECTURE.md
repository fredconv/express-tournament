# ARCHITECTURE — Tournoi Express

Version 0.1 — 2026-11-12 — statut : validée le 2026-11-12

## 1. Principes

1. **Une seule base de code TypeScript** pour le web, l'app installable (PWA) et le serveur.
2. **Le domaine est pur** : types, validation et moteur de planification n'importent ni React, ni le réseau, ni le stockage. Il est partagé par le client et le serveur.
3. **Local d'abord pour l'organisateur** : le brouillon et la génération fonctionnent sans réseau ; le serveur ne sert qu'à publier, partager et protéger l'écriture.
4. **Serveur minimal** : 5 routes, un document JSON par tournoi, aucune logique métier propre au serveur hormis la validation.
5. **Portabilité** : uniquement des API web standard (fetch, Web Crypto) et SQLite ; quitter Cloudflare = changer l'adaptateur d'hébergement, pas le code.
6. **Pas de V2 anticipée dans le code** ; seulement des choix qui ne la bloquent pas (§13).

## 2. Vue d'ensemble

```
 Smartphone organisateur                          Smartphone participant
 ┌──────────────────────────┐                     ┌──────────────────────────┐
 │ PWA React                │                     │ PWA React (même app)     │
 │  ├─ UI organisateur      │                     │  └─ Page publique /t/:id │
 │  ├─ domain/ (moteur)     │                     │      (cache hors ligne)  │
 │  └─ brouillon localStorage│                    └────────────┬─────────────┘
 └────────────┬─────────────┘                                  │ GET (public)
              │ POST/PUT/DELETE + Authorization: Bearer <code> │
              ▼                                                ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Cloudflare Worker (un seul déploiement, même origine)                     │
 │  ├─ fichiers statiques de la SPA (Workers Static Assets)                  │
 │  └─ /api/* : Hono → validation (domain/ + Zod) → D1                       │
 └───────────────────────────────────────┬──────────────────────────────────┘
                                         ▼
                              Cloudflare D1 (SQLite)
                              table tournaments
```

Une seule origine (SPA + API) ⇒ pas de CORS, pas de cookie, configuration minimale.

## 3. Choix techniques

| Besoin | Choix | Justification | Alternatives écartées |
|---|---|---|---|
| Langage | **TypeScript strict** | Typage de bout en bout, domaine partagé client/serveur. | — |
| UI | **React 19 + Vite 8** | Envisagé par le besoin ; écosystème connu des agents ; Vite = build rapide, standard. | Next.js (SSR inutile, plus lourd) ; Flutter (web lourd, 2ᵉ langage). |
| Routage | **React Router** (mode SPA) | Liens profonds nécessaires (QR → `/t/:id`). | Routage maison (fragile). |
| Styles | **CSS natif + variables CSS** | Zéro dépendance ; la feuille d'impression est du CSS de toute façon. | Tailwind (outillage supplémentaire non indispensable). |
| Validation | **Zod** | Un seul schéma pour formulaires, API et stockage ; types dérivés. | Validation manuelle (duplication, erreurs). |
| Hors ligne / installation | **vite-plugin-pwa** (Workbox) | Manifest + service worker générés, éprouvé. | Service worker écrit à la main (risque de cache cassé). |
| QR code | **qrcode** (npm, MIT) | Génération locale, petit, sans service externe. | API QR en ligne (fuite de données, dépendance réseau). |
| PDF | **Impression navigateur + CSS `@media print`** | Aucune dépendance, rendu fidèle, fonctionne sur Android. | jsPDF / pdfmake (poids, mise en page à recoder) → backlog si besoin réel. |
| API | **Hono** sur Cloudflare Workers | Routeur ~15 Ko, typé, tourne aussi sur Node/Bun/Deno ⇒ porte de sortie. | Express (incompatible Workers) ; fetch handler nu (acceptable, mais middlewares à recoder). |
| Base de données | **Cloudflare D1** (SQLite) | Gratuit, sans mise en veille, SQL standard, migrable vers SQLite/Postgres. | Supabase (projets gratuits mis en pause après inactivité — incompatible avec un usage ponctuel) ; Firebase (propriétaire, NoSQL) ; PocketBase (nécessite une VM payante). |
| Hébergement | **Cloudflare Workers + Static Assets** | Un seul déploiement pour SPA + API, HTTPS, CDN mondial, offre gratuite. | Vercel/Netlify + base séparée (2 fournisseurs). |
| Tests | **Vitest** (+ `@cloudflare/vitest-pool-workers` pour l'API), **Playwright** (E2E mobile) | Vitest natif Vite ; pool Workers = vraie D1 locale ; Playwright = critères d'acceptation mobiles. | Jest (config ESM/TS plus lourde). |
| Qualité | **Biome** (lint + format) | Un seul outil au lieu d'ESLint + Prettier. | ESLint + Prettier (2 outils, plus de config). |
| Outillage | **npm**, Node 22 (`.node-version`), **Wrangler** | Pas d'outil supplémentaire ; Wrangler = déploiement et migrations D1. npm 12 bloque les scripts d'installation : seuls `workerd` et `esbuild` sont autorisés (`allowScripts` dans `package.json`). | — |
| CI | **GitHub Actions** (vérifications seulement) | Gratuit ; typecheck, lint, tests, build sur chaque push et PR. | — |
| Déploiement | **Cloudflare Workers Builds** (intégration GitHub) | Push sur `main` → build + déploiement par Cloudflare ; aucun jeton Cloudflare à stocker dans GitHub. | Déploiement par GitHub Actions + `CLOUDFLARE_API_TOKEN` (un secret de plus à gérer). |

**Android** : en V1 la PWA s'installe depuis Chrome (« Ajouter à l'écran d'accueil ») et fonctionne hors ligne. Publication Play Store ultérieure via **TWA** (Bubblewrap) ou **Capacitor** avec le même code → backlog.

### Quotas gratuits vérifiés (documentation Cloudflare, 2026-11-12)

| Ressource | Offre gratuite | Conséquence pour le projet |
|---|---|---|
| Requêtes Worker | 100 000 / jour | Seuls les appels `/api` comptent. |
| Fichiers statiques | Gratuits et illimités | L'app (HTML/JS/CSS) ne consomme pas le quota. |
| CPU | **10 ms par requête** | Validation serveur (Zod + `validateSchedule`) à mesurer sur un tournoi de 32 équipes en E3 ; rester sous ~5 ms. |
| Cron Triggers | 5 par compte | 1 utilisé (purge quotidienne). |
| D1 lectures | 5 M lignes / jour | ~1 ligne par consultation de page publique. |
| D1 écritures | 100 000 lignes / jour | Écritures rares (publication). |
| D1 stockage | 5 Go | Tournoi < 50 Ko → > 100 000 tournois. |
| D1 Time Travel | Restauration à la minute ; 30 jours selon la doc générale de D1, durée exacte pour l'offre gratuite à confirmer dans le tableau de bord avant E7. | |
| Rate Limiting binding | Fenêtre de **10 s ou 60 s uniquement**, compteur **par point de présence** Cloudflare (pas global). | Les limites se calculent à la minute (§8). |

Bases D1 (région WEUR, binding `DB`) : `express-tournament-db` (production), `express-tournament-db-preview` (prévisualisations de branche).

## 4. Structure du dépôt

```
/
├─ src/
│  ├─ domain/            # PUR : aucun import de react, hono, fetch, localStorage, Date.now
│  │  ├─ types.ts        # Tournament, Team, Court, MatchFormat, ScheduledMatch…
│  │  ├─ limits.ts       # limites produit (MAX_TEAMS…)
│  │  ├─ schemas.ts      # schémas Zod du document publié
│  │  ├─ schedule/
│  │  │  ├─ roundRobin.ts    # paires par méthode du cercle (Berger)
│  │  │  ├─ assignSlots.ts   # placement créneaux × terrains, repos
│  │  │  ├─ generate.ts      # point d'entrée generateSchedule()
│  │  │  ├─ random.ts        # PRNG à graine fixe (rejeux déterministes)
│  │  │  └─ validate.ts      # invariants (utilisé par tests ET serveur)
│  │  ├─ format.ts       # durée suggérée, libellés de format
│  │  └─ time.ts         # minutes depuis minuit ↔ "HH:mm"
│  ├─ app/               # React : pages, composants, hooks
│  │  ├─ pages/          # Home, Editor, Publish (QR), PublicView, MyTournaments, Recover
│  │  ├─ components/
│  │  ├─ styles/         # global.css, print.css
│  │  └─ i18n/fr.ts      # tous les textes UI
│  ├─ client/            # accès externes côté navigateur
│  │  ├─ api.ts          # appels /api typés
│  │  └─ storage.ts      # brouillons + codes de gestion (localStorage)
│  └─ main.tsx
├─ worker/
│  ├─ index.ts           # app Hono : routes /api, en-têtes de sécurité, assets
│  ├─ auth.ts            # génération / hachage / vérification du code de gestion
│  ├─ repository.ts      # SQL D1 (seul fichier qui parle SQL)
│  └─ cron.ts            # purge des tournois expirés
├─ migrations/           # SQL D1 versionné (0001_init.sql…)
├─ tests/
│  ├─ domain/            # unitaires + propriétés du moteur
│  ├─ worker/            # API contre D1 locale
│  └─ e2e/               # Playwright, viewport mobile
├─ wrangler.jsonc
├─ SPEC.md ARCHITECTURE.md ROADMAP.md BACKLOG.md AGENTS.md CLAUDE.md
```

**Règle de dépendances** (vérifiée en revue, et par un test qui scanne les imports de `src/domain`) :
`app → client → domain` ; `worker → domain` ; `domain → (rien sauf zod)`.

## 5. Moteur de planification

### Contrat

```ts
// Tous les horaires sont des minutes depuis minuit (entiers) : aucun fuseau horaire,
// le tournoi a lieu à un seul endroit.
interface ScheduleInput {
  teamIds: string[];          // 2..32, ordre = ordre de saisie
  courtIds: string[];         // 1..16
  startMinute: number;        // ex. 9 h 00 → 540
  slotMinutes: number;        // durée de créneau (D1)
  transitionMinutes: number;  // battement
  avoidBackToBack: boolean;   // repos (D2)
  targetEndMinute?: number;
}

interface ScheduledMatch {
  id: string;        // "m1", "m2"… stable pour une génération
  number: number;    // numéro affiché
  slot: number;      // index de créneau (0..)
  courtId: string;
  teamAId: string;
  teamBId: string;
  startMinute: number;
  endMinute: number;
}

type ScheduleWarning =
  | { kind: 'back-to-back'; teamIds: string[]; slot: number }
  | { kind: 'exceeds-target-end'; endMinute: number }
  | { kind: 'past-midnight' };

function generateSchedule(input: ScheduleInput): {
  matches: ScheduledMatch[];
  slotCount: number;
  endMinute: number;
  warnings: ScheduleWarning[];
};
```

### Algorithme (simple, déterministe, O(M × C × S))

1. **Paires** : méthode du cercle (tables de Berger) → liste des N(N−1)/2 matchs ordonnés par « tour » (N impair : équipe fictive « exempt »). Cet ordre garantit déjà une bonne alternance.
2. **Placement glouton par créneau, journée la plus courte d'abord** : chaque créneau prend autant de matchs que de terrains, parmi ceux dont les deux équipes sont libres. Repos désactivé : ordre de Berger (optimal : N−1 ou N créneaux quand il y a assez de terrains). Repos activé, tri par :
   (a) coût de fatigue = Σ (longueur de la série prolongée)² des équipes qui viennent de jouer, (b) nombre de matchs restants des deux équipes décroissant (goulots d'étranglement), (c) attente cumulée décroissante, (d) ordre de départage.
3. **Rejeux déterministes** (repos activé) : le glouton ne voit pas la fin de journée ; il est rejoué jusqu'à 60 fois avec des ordres de départage pseudo-aléatoires **à graine fixe** (même entrée → même planning), dans un budget de calcul borné. On garde le meilleur (créneaux, puis plus longue série, puis nombre d'enchaînements) et on s'arrête dès que les bornes théoriques sont atteintes.
4. Calcul des horaires : `start = startMinute + slot × (slotMinutes + transitionMinutes)`.
5. `validateSchedule()` vérifie les invariants (paires uniques, complétude, aucun conflit équipe/terrain, horaires, numérotation) ; il est appelé par les tests **et** par le serveur (via `tournamentDocSchema`) avant tout enregistrement.

Le moteur est testé sans navigateur : tests unitaires + tests de propriétés exhaustifs (N 2..32 × C 1..16, repos activé et désactivé) + cas de référence figés (`tests/domain/reference.test.ts`) + test d'architecture (pureté de `src/domain`). Si la qualité du glouton est insuffisante sur un cas réel, on améliore `assignSlots.ts` seul, le contrat ne change pas.

Mesures (Node, 2026-11-12) : 32 équipes / 16 terrains < 1 ms ; budget de calcul plafonné (rejeux ≤ 400 000 opérations) : toutes les tailles < 200 ms (test de performance hors couverture). Limite connue : 8 équipes / 3 terrains garde une série de 4 matchs pour une équipe (BACKLOG A19).

## 6. Modèle de données

### Document tournoi (validé par Zod, stocké en JSON)

```ts
interface TournamentDoc {
  schemaVersion: 1;
  name: string;               // 1..80
  date: string;               // "YYYY-MM-DD"
  location?: string;          // 0..80
  sport: 'volleyball';
  matchFormat:
    | { kind: 'time';   setCount: number; minutesPerSet: number }
    | { kind: 'points'; setCount: number; pointsPerSet: number;
        mode: 'all-sets' | 'best-of'; decidingSetPoints?: number };
  schedule: {
    startMinute: number; slotMinutes: number; transitionMinutes: number;
    avoidBackToBack: boolean; targetEndMinute?: number;
  };
  courts: { id: string; name: string }[];
  teams:  { id: string; name: string }[];
  matches: ScheduledMatch[];  // planning généré, stocké tel quel
  warnings: ScheduleWarning[];
}
```

Les identifiants d'équipes/terrains sont des chaînes courtes générées côté client (renommer une équipe ne casse rien).

### Stockage serveur (D1)

```sql
-- migrations/0001_init.sql
CREATE TABLE tournaments (
  id               TEXT PRIMARY KEY,      -- id public, 10 car. base32 aléatoires
  owner_token_hash TEXT NOT NULL,         -- SHA-256 hex du code de gestion
  doc              TEXT NOT NULL,         -- TournamentDoc JSON validé
  version          INTEGER NOT NULL,      -- verrou optimiste, +1 à chaque écriture
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL          -- date du tournoi + 90 j (D6)
);
CREATE INDEX idx_tournaments_expires ON tournaments(expires_at);
```

**Pourquoi un document JSON et pas des tables équipes/matchs ?** En V1 un tournoi est petit (< 50 Ko), toujours lu en entier, écrit par un seul propriétaire. Un document évite jointures et ORM. Les données V2 écrites par d'autres acteurs (scores) iront dans **des tables séparées** (§13), ce qui évite les conflits d'écriture sur le document. `schemaVersion` permet de migrer le document à la lecture.

### Stockage local (navigateur)

`client/storage.ts` encapsule `localStorage` :
- `drafts` : brouillons non publiés (TournamentDoc partiel) ;
- `owned` : `[{ id, ownerToken, name, date, lastPublishedVersion }]` ;
- `myTeam:{id}` : équipe suivie par le participant.

## 7. API

Toutes les réponses sont JSON. Taille de corps max : 100 Ko.

| Méthode | Route | Auth | Effet | Codes |
|---|---|---|---|---|
| POST | `/api/tournaments` | — (limité en débit) | Crée ; renvoie `{ id, ownerToken, version }` — **seule fois où le code transite du serveur vers le client** | 201, 413, 422, 429 |
| GET | `/api/tournaments/:id` | — | Document public + `version`, `updatedAt`. ETag = version | 200, 304, 404 |
| PUT | `/api/tournaments/:id` | `Authorization: Bearer <code>` + `If-Match: <version>` | Remplace le document | 200, 401, 404, 409, 413, 422, 429 |
| DELETE | `/api/tournaments/:id` | Bearer | Supprime | 204, 401, 404 |
| POST | `/api/tournaments/:id/owner-check` | Bearer | Vérifie un code saisi sur un autre appareil | 204, 401, 404 |

Sur POST/PUT le serveur : valide Zod → `validateSchedule()` → vérifie que les équipes des matchs existent → écrit. 401 et 404 ont des temps de réponse comparables.

## 8. Sécurité

### Modèle de menace (V1)
| Menace | Parade |
|---|---|
| Modification d'un tournoi par un tiers | Code de gestion 160 bits aléatoire (Web Crypto), seul le **hachage SHA-256** est stocké ; comparaison à temps constant. Un code ne vaut que pour un tournoi. |
| Fuite du code via URL / QR / logs | Le code ne figure **jamais** dans une URL (transmis en en-tête `Authorization`) ; QR = URL publique seule ; aucun log de l'en-tête ; `Referrer-Policy: no-referrer`. |
| Vol du code par XSS (stocké en localStorage) | Aucun HTML injecté (`dangerouslySetInnerHTML` interdit), React échappe ; CSP stricte `default-src 'self'` ; aucun script tiers ; portée du code limitée à un tournoi. |
| Énumération des tournois | Id public aléatoire 50 bits ; aucune route de liste ; pages `noindex` + `robots.txt`. |
| Spam / abus de création | Limite de débit par IP via binding Rate Limiting Workers (fenêtre de 60 s, compteur par point de présence) : POST ≈ 3/min, PUT ≈ 30/min par tournoi ; taille de corps 100 Ko ; limites Zod (32 équipes, 16 terrains, longueurs). |
| Données invalides rendant la page publique illisible | Validation serveur systématique (Zod + invariants du moteur). |
| Écrasement concurrent | Verrou optimiste `version` / `If-Match` → 409. |
| Perte de données | D1 Time Travel (restauration à la minute ; durée sur l'offre gratuite à confirmer avant E7) ; export JSON du tournoi par l'organisateur → backlog. |
| Secrets d'infrastructure | Aucun jeton Cloudflare dans GitHub (déploiement par Workers Builds, jeton géré par Cloudflare) ; aucun secret dans le bundle client ; `.dev.vars` ignoré par Git. |

En-têtes appliqués par le Worker : `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` restrictive, `X-Frame-Options: DENY`, HSTS (via Cloudflare).

### Données personnelles
Uniquement noms de tournoi, lieu et équipes. Pas de compte, pas de cookie, pas d'analytics tiers (statistiques agrégées Cloudflare seulement). Page « Confidentialité » courte. Purge automatique quotidienne (Cron Trigger) après `expires_at`.

## 9. Partage public et QR code

- URL publique : `https://<domaine>/t/<id>` (ex. `/t/k3m9x2p7qa`), courte pour être lisible et retapable.
- QR généré dans le navigateur par `qrcode` (niveau de correction M), affiché plein écran avec l'URL en clair.
- Le QR est disponible dès la publication et reste valable après chaque modification (l'URL ne change pas).
- `navigator.share` quand disponible, sinon copie dans le presse-papiers.

## 10. Hors ligne et PWA

- **Precache** de l'app (HTML/JS/CSS/icônes) par le service worker.
- `GET /api/tournaments/:id` en **network-first** avec repli sur le cache → bandeau « hors ligne ».
- Brouillons et génération 100 % locaux ; publication / suppression requièrent le réseau (bouton désactivé + message).
- Mise à jour du service worker : invite « Nouvelle version disponible » (pas de rechargement forcé pendant un tournoi).

## 11. Export PDF

`print.css` : A4 portrait, masque la navigation, en-tête tournoi, tableau des matchs (`break-inside: avoid` par ligne / créneau), pied de page avec l'URL. Le bouton appelle `window.print()` sur la vue courante (complète ou filtrée par équipe).

## 12. Déploiement, environnements, coûts

| Environnement | Cible | Base |
|---|---|---|
| Local | `vite dev` avec `@cloudflare/vite-plugin` (Worker + D1 locale Miniflare) | D1 locale |
| Prévisualisation | Worker Preview construite par Workers Builds pour chaque branche ≠ `main` (`https://<branche>-express-tournament.fredconv.workers.dev`) | D1 `express-tournament-db-preview` (bloc `previews` de `wrangler.jsonc`) |
| Production | Worker `express-tournament`, construit et déployé par Workers Builds à chaque push sur `main` | D1 de production |

Réglages Workers Builds : build command `npm run build`, deploy command `npx wrangler deploy`, racine `/`.

CI GitHub Actions (vérification seulement) : `npm ci` → `wrangler types --check` → `typecheck` → `lint` → `test` → `build`.

Les prévisualisations ont leur **propre base D1** : aucune branche ne touche les données de production. Une migration est appliquée d'abord à la base de prévisualisation (`npm run db:migrate:preview`), puis à la production (`npm run db:migrate:remote`) **avant** la fusion du code qui l'utilise ; elle doit rester rétrocompatible (le code en production tourne encore pendant quelques secondes sur l'ancien schéma).

Coût prévu : **0 €** (offres gratuites Workers + D1, sous-domaine `workers.dev`) ; ~10–15 €/an si nom de domaine.

## 13. Préparation de la V2 (sans la développer)

| Évolution V2 | Point d'extension prévu | Ce qu'on **ne fait pas** en V1 |
|---|---|---|
| Saisie des scores par les participants | Nouvelle table `match_results(tournament_id, match_id, sets_json, status, submitted_at)` ; les `ScheduledMatch.id` stables servent de clé. | Aucun champ score dans le document. |
| Validation par un responsable | Réutilise le code de gestion (ou un code « arbitre » dérivé). | Aucun système de rôles. |
| Classements | Fonction pure `computeStandings(doc, results)` dans `domain/`. | — |
| Plusieurs poules / phases finales | `schemaVersion: 2` : `phases[]` contenant des poules ; migration v1 → v2 = une phase, une poule. Le moteur actuel devient le générateur « poule ». | Pas de notion de phase en V1. |
| Comptes / récupération par e-mail | Rattacher des codes de gestion existants à un compte. | Aucun compte. |
| App Play Store | TWA ou Capacitor autour de la PWA. | — |

## 14. Journal des décisions

| # | Date | Décision | Statut |
|---|---|---|---|
| ADR-1 | 2026-11-12 | PWA React/TS unique pour web et Android plutôt qu'app native. | Acceptée |
| ADR-2 | 2026-11-12 | Cloudflare Workers + D1 + Hono (portable Node/SQLite) plutôt que Supabase/Firebase. | Acceptée |
| ADR-3 | 2026-11-12 | Tournoi stocké comme document JSON versionné, planning figé à la publication. | Acceptée |
| ADR-4 | 2026-11-12 | Propriété par code de gestion haché, transmis en en-tête, jamais en URL. | Acceptée |
| ADR-5 | 2026-11-12 | PDF par impression navigateur, sans bibliothèque. | Acceptée |
| ADR-6 | 2026-11-12 | Déploiement par Cloudflare Workers Builds ; GitHub Actions limité aux vérifications ; prévisualisations de branche sur une base D1 dédiée (exigé par Worker Previews). | Acceptée |
| ADR-7 | 2026-11-12 | En-têtes de sécurité : `public/_headers` pour les fichiers statiques, middleware Hono pour `/api`. | Acceptée |
| ADR-8 | 2026-11-12 | Moteur : journée la plus courte d'abord, repos en départage, rejeux à graine fixe ; CA5.3 révisé (0 entorse impossible à durée minimale). | Acceptée |
| ADR-9 | 2026-11-12 | Dépendances E1 : `zod` (schémas partagés), `tsx` (exécuter `scripts/*.ts` sans build), `@vitest/coverage-v8` (seuil de couverture du domaine). | Acceptée |
| ADR-10 | 2026-11-12 | Prévisualisations de branche : `build.command` et `assets.directory` dans `wrangler.jsonc`, Workers Builds ignorant la build command des previews. | Acceptée |

Toute nouvelle dépendance ou changement d'architecture ajoute une ligne ici.
