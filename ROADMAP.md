# ROADMAP — Tournoi Express V1

Version 0.3 — 2026-11-12 — **recentrée sur le MVP** (demande utilisateur du 2026-11-12) : poules, scores, après-midi, finale simple, publication. Chemin le plus court vers une V1 déployable ; tout le reste est au BACKLOG.

Règle : avant d'ajouter quoi que ce soit, se demander si c'est indispensable pour mener un vrai tournoi avec la V1. Sinon → BACKLOG.md.

Étapes courtes, ordonnées, chacune livrable et déployée. On **déploie dès E0** pour éliminer le risque d'hébergement en premier. Une étape n'est terminée que lorsque sa Definition of Done (DoD) est entièrement cochée.

Tailles indicatives : S ≈ une session de travail, M ≈ 2–3 sessions.

## Definition of Done commune (s'applique à chaque étape)

- [ ] Code fusionné sur `main` via une branche dédiée ; CI verte (`typecheck`, `lint`, `test`, `build`).
- [ ] Aucun `any` non justifié, aucune erreur TypeScript, aucun test ignoré (`skip`/`only`).
- [ ] Les critères d'acceptation de SPEC.md couverts par l'étape sont cochés (TA automatisés, RM consignés dans `HANDOFF.md`).
- [ ] Déployé (prévisualisation de branche puis production) et vérifié sur l'URL publique.
- [ ] Toute idée hors périmètre ajoutée à BACKLOG.md, pas au code.
- [ ] Toute nouvelle dépendance justifiée dans ARCHITECTURE.md §14.
- [ ] `HANDOFF.md` mis à jour (fait / reste / vérifications exécutées).

---

## E0 — Socle et déploiement « hello » (S)
Bloqué par : D5 (compte Cloudflare + dépôt GitHub).

- Dépôt Git, Vite + React + TS strict, Biome, Vitest, structure §4.
- Worker Hono minimal servant la SPA + `GET /api/health`.
- `wrangler.jsonc`, base D1 créée, migration `0001_init.sql`.
- Cloudflare Workers Builds relié au dépôt (déploiement sur `main`) ; GitHub Actions pour les vérifications.
- Vérifier les quotas gratuits réels (Workers, D1, rate limiting, Time Travel) et corriger ARCHITECTURE.md si besoin. _(fait le 2026-11-12, ARCHITECTURE.md §3)_

**DoD**
- [ ] `https://…workers.dev/` affiche la page d'accueil sur un smartphone Android. _(en attente : test par l'utilisateur ; vérifié sur navigateur desktop)_
- [x] `GET /api/health` → 200 et lit D1 (une requête `SELECT 1`). _(vérifié en production le 2026-11-12)_
- [x] Un push sur `main` redéploie la production sans action manuelle. _(Workers Builds, vérifié le 2026-11-12)_
- [x] Aucun secret dans le dépôt (`git grep` sur token/clé vide).

## E1 — Domaine et moteur de planification (M)
Bloqué par : D1, D2.

- `domain/types.ts`, `schemas.ts`, `time.ts`, `format.ts`.
- `schedule/` : round-robin, placement, validation, alertes.
- Tests unitaires, tests de propriétés N 2..32 × C 1..16, cas de référence figés.
- Test d'architecture : `src/domain` n'importe rien d'autre que `zod`.

**DoD**
- [x] CA4.1 à CA4.5, CA5.1 à CA5.4, CA3.1, CA3.2 automatisés et verts.
- [x] Couverture de lignes `src/domain` ≥ 90 %. _(99,5 % le 2026-11-12, seuil imposé par `npm run test:coverage`)_
- [x] Un script `npm run schedule:demo -- 8 2` affiche un planning en console (preuve d'indépendance vis-à-vis de React).

## E2 — Éditeur organisateur local (M)
Bloqué par : D3.

- Pages Accueil, Nouveau tournoi, Équipes (saisie rapide), Configuration (terrains, horaires, format, durée suggérée), Aperçu du planning + alertes.
- Brouillon persistant (`client/storage.ts`), marquage « à régénérer ».
- Vue planning (composant réutilisé par la page publique) : liste mobile, grille PC.

**DoD**
- [x] CA1.2, CA1.3, CA2.1 à CA2.3, CA3.3 (partie client) verts. _(tests/domain/draft.test.ts)_
- [ ] Parcours P1 jusqu'à l'aperçu réalisable en mode avion. _(aucun appel réseau dans l'éditeur ; à confirmer sur téléphone — mode hors ligne reporté au BACKLOG)_
- [ ] RM : 8 équipes / 2 terrains configurés en < 4 min sur Android par une personne qui découvre l'app.

## E3 — Poules, scores, après-midi et finale (M)

Dans l'éditeur local existant, sans nouvelle couche d'architecture : quelques fonctions pures dans `src/domain/` (répartition, classement, après-midi) et des écrans dans `src/app/`.

- Réglages : terrains 1–6 en boutons, « durée d'un match » (au lieu de « créneau »), rotation, pause de midi fixe.
- Matin : tirage des poules (3–5 équipes), round-robin dans chaque poule, poules jouées en même temps sur les terrains partagés.
- Saisie des scores (sets), classement de chaque poule.
- Après-midi : poules de niveau construites depuis le classement du matin, planning après la pause de midi.
- Finale simple : 1ᵉʳ contre 2ᵉ de la première poule de l'après-midi, à la suite.
- Un seul planning chronologique de la journée (matin, pause, après-midi, finale).

**DoD**
- [x] CA3.4, CA4.6, CA10.1 à CA10.3, CA11.1, CA11.2, CA12.1 à CA12.3 automatisés et verts. _(tests/domain/tournament.test.ts, journée complète 13 et 15 équipes)_
- [x] Parcours complet (création → tirage → scores → après-midi → finale) faisable en viewport 375 × 812. _(prévisualisation, 2026-11-12 : 15 équipes / 3 terrains et 13 équipes / 2 terrains ; une partie des scores injectée en stockage local pour aller vite, saisie, nul, set décisif de la finale et alerte de fin testés dans l'interface ; aucune erreur console, pas de défilement horizontal)_
- [ ] RM sur un vrai Android (en attente de l'utilisateur).

## E4 — Publication, page publique, QR et impression (M)

- API minimale : `POST /api/tournaments` (création, renvoie le code de gestion une seule fois), `GET /api/tournaments/:id`, `PUT /api/tournaments/:id` (code de gestion + version). Validation Zod côté serveur, hachage SHA-256 du code, limite de taille.
- Bouton « Publier » / « Publier les mises à jour » (après chaque saisie de scores).
- Page publique `/t/:id` : planning de la journée, scores, classements, filtre « Mon équipe », bouton « Actualiser ».
- Écran QR plein écran + lien à copier ; feuille `print.css` pour imprimer / enregistrer en PDF.

**DoD**
- [ ] CA6.1, CA6.2, CA8.2, CA9.1 à CA9.4 automatisés et verts.
- [ ] En-têtes de sécurité vérifiés sur la prévisualisation (`curl -I`).
- [ ] RM : QR scanné depuis un autre téléphone ; PDF lisible depuis Chrome Android (CA7.1, CA8.1).

## E5 — Mise en production et tournoi réel (S)

- Fusion sur `main`, migration D1 appliquée, production vérifiée.
- Test terrain : un vrai tournoi (ou simulation à plusieurs téléphones) ; anomalies bloquantes corrigées, le reste au BACKLOG.

**DoD de publication finale (V1)**
- [ ] DoD E0 à E4 cochées (sauf RM explicitement reportées et notées dans `HANDOFF.md`).
- [ ] Un tournoi créé en production est consultable via QR depuis un téléphone qui n'a jamais ouvert l'app.
- [ ] README : démarrage local, déploiement, limites connues.
- [ ] Tag Git `v1.0.0`.
- [ ] Coût mensuel constaté = 0 €.

---

## Ordre

```
E0 ──► E1 ──► E2 ──► E3 ──► E4 ──► E5
```

Reportés au BACKLOG (non indispensables pour mener un tournoi) : PWA hors ligne, gestion depuis un autre appareil, suppression et purge automatique, tests E2E Playwright, Lighthouse, demi-finales, anti-revanches.
