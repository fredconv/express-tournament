# ROADMAP — Tournoi Express V1

Version 0.1 — 2026-11-12

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
- [ ] `https://…workers.dev/` affiche la page d'accueil sur un smartphone Android.
- [ ] `GET /api/health` → 200 et lit D1 (une requête `SELECT 1`).
- [ ] Un push sur `main` redéploie la production sans action manuelle.
- [ ] Aucun secret dans le dépôt (`git grep` sur token/clé vide).

## E1 — Domaine et moteur de planification (M)
Bloqué par : D1, D2.

- `domain/types.ts`, `schemas.ts`, `time.ts`, `format.ts`.
- `schedule/` : round-robin, placement, validation, alertes.
- Tests unitaires, tests de propriétés N 2..32 × C 1..16, cas de référence figés.
- Test d'architecture : `src/domain` n'importe rien d'autre que `zod`.

**DoD**
- [ ] CA4.1 à CA4.5, CA5.1 à CA5.4, CA3.1, CA3.2 automatisés et verts.
- [ ] Couverture de lignes `src/domain` ≥ 90 %.
- [ ] Un script `npm run schedule:demo -- 8 2` affiche un planning en console (preuve d'indépendance vis-à-vis de React).

## E2 — Éditeur organisateur local (M)
Bloqué par : D3.

- Pages Accueil, Nouveau tournoi, Équipes (saisie rapide), Configuration (terrains, horaires, format, durée suggérée), Aperçu du planning + alertes.
- Brouillon persistant (`client/storage.ts`), marquage « à régénérer ».
- Vue planning (composant réutilisé par la page publique) : liste mobile, grille PC.

**DoD**
- [ ] CA1.2, CA1.3, CA2.1 à CA2.3, CA3.3 (partie client) verts.
- [ ] Parcours P1 jusqu'à l'aperçu réalisable en mode avion.
- [ ] RM : 8 équipes / 2 terrains configurés en < 4 min sur Android par une personne qui découvre l'app.

## E3 — API, persistance et gestion propriétaire (M)
Bloqué par : D4, D6.

- Routes §7, `auth.ts` (génération, hachage, comparaison à temps constant), `repository.ts`.
- Validation Zod + `validateSchedule()` côté serveur, limites de taille et de débit, verrou optimiste.
- En-têtes de sécurité, CSP, `robots.txt`, `noindex`.
- Cron de purge des tournois expirés.

**DoD**
- [ ] CA3.3 (serveur), CA9.1 à CA9.4 automatisés contre D1 locale.
- [ ] Test : le code de gestion n'apparaît dans aucune réponse publique ni aucun log.
- [ ] Test : un document invalide (conflit forgé, équipe inconnue, 40 équipes) → 422.
- [ ] En-têtes de sécurité vérifiés sur la préproduction (`curl -I`).

## E4 — Publication, page publique et QR code (M)

- Bouton Publier / Publier les modifications, gestion des 409.
- Écran code de gestion (copier / partager / afficher) et « Mes tournois ».
- « Gérer depuis un autre appareil » (lien + code → `owner-check`).
- Page publique `/t/:id` : planning, filtre « Mon équipe », prochain match, actualisation, 404 propre.
- Écran QR plein écran, copier / partager le lien.

**DoD**
- [ ] CA1.1, CA6.1, CA6.2, CA8.2, CA9.3 (UI), CA9.5 verts.
- [ ] RM : QR scanné depuis un Android et un iPhone à 1 m (CA8.1).
- [ ] RM : modification publiée visible par un participant après « Actualiser ».

## E5 — Impression PDF et PWA hors ligne (S)

- `print.css`, bouton Imprimer / PDF sur vue complète et filtrée.
- vite-plugin-pwa : manifest, icônes, precache, network-first sur la lecture publique, bandeau hors ligne, invite de mise à jour.

**DoD**
- [ ] CA6.4, CA7.1, CA7.2 vérifiés.
- [ ] L'app s'installe sur Android (icône, nom, lancement plein écran).
- [ ] Lighthouse mobile sur la page publique : Performance ≥ 90, Accessibilité ≥ 90, PWA installable.

## E6 — Durcissement et bêta réelle (S + test terrain)

- Gestion des erreurs réseau et messages clairs partout ; page Confidentialité ; page À propos.
- Tests E2E Playwright du parcours P1 → P2 en viewport mobile.
- Revue sécurité ciblée (Codex) + `/security-review`.
- **Test terrain** : au moins un vrai tournoi (ou simulation avec ≥ 5 personnes et leurs téléphones).

**DoD**
- [ ] E2E P1 → P2 → P3 vert en CI.
- [ ] Aucun constat de sécurité bloquant ouvert.
- [ ] Retours du test terrain triés : bloquants corrigés, le reste dans BACKLOG.md.
- [ ] CA6.3 mesuré sur un vrai Android en 4G.

## E7 — Mise en production (S)

- Base D1 de production, migration appliquée, déploiement sur tag `v1.0.0`.
- Nom de domaine (si décidé), sinon URL `workers.dev` de production.
- Procédure de restauration D1 testée une fois.

**DoD de publication finale (V1)**
- [ ] Toutes les DoD E0 à E6 cochées.
- [ ] Tous les critères d'acceptation F1 à F9 de SPEC.md cochés.
- [ ] Production accessible publiquement en HTTPS ; un tournoi créé en production est consultable via QR depuis un Android **qui n'a jamais ouvert l'app**.
- [ ] Migrations D1 rétrocompatibles et appliquées ; procédure documentée dans le README.
- [ ] Aucune anomalie bloquante ouverte (les non bloquantes sont au backlog et ne retardent pas la sortie).
- [ ] README : démarrage local, déploiement, restauration, limites connues.
- [ ] Tag Git `v1.0.0` et note de version.
- [ ] Coût mensuel constaté = 0 € (hors domaine).

---

## Ordre et dépendances

```
E0 ──► E1 ──► E2 ──► E4 ──► E5 ──► E6 ──► E7
          └─────► E3 ──┘
```
E3 peut avancer en parallèle de E2 (fichiers disjoints : `worker/` vs `src/app/`), les deux s'appuyant sur `domain/`.
