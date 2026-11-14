# HANDOFF — Tournoi Express

Dernière mise à jour : 2026-11-14 (Claude Code)

## Résumé

App web (React + Hono sur Cloudflare Workers + D1) pour organiser un tournoi de volley d'une journée : poules du matin, scores, poules de niveau l'après-midi, finale, page publique par QR code, impression PDF. MVP recentré le 2026-11-12 (SPEC v0.3).

- Production : https://express-tournament.fredconv.workers.dev (déployée par Workers Builds à chaque push sur `main`).
- Prévisualisations : `https://<branche>-express-tournament.fredconv.workers.dev` (base D1 de prévisualisation séparée).
- Étape en cours : **E5 — mise en production et tournoi réel** (ROADMAP.md). E0 à E4 et les ajouts E4.1–E4.3 sont fusionnés.

## Fait (vérifié dans le dépôt le 2026-11-14)

`main` à `143e7fa`, aucune PR ouverte, `npm run check` vert (131 tests).

| PR | Contenu |
|---|---|
| #3 | E2 : éditeur local (équipes, réglages, planning). |
| #4 | E3 : poules du matin (3–5 équipes), scores par set, classements par moyenne, après-midi par niveaux, finale 1ᵉʳ/2ᵉ de la poule Or, pause de midi, terrains 1–6. |
| #5 | E4 : API `POST/GET/PUT /api/tournaments` (code de gestion haché SHA-256, verrou de version), page publique `/t/:id`, QR `/t/:id/qr`, impression A4. |
| #6 | E4.1 (F13) : couleurs de terrain, marqueur d'enchaînement, filtre par équipe (le survol a été retiré à la demande de l'utilisateur). |
| #7 | Filtre par équipe placé entre les classements et le premier créneau. |
| #8 | Moteur (ADR-12) : jamais 3 matchs d'affilée (un terrain attend si besoin), puis moins de doubles, équité, durée. |
| #9 | Verrouillage d'équipes dans une poule du matin (onglet Équipes). |
| #10 | Forfait par match et « équipe partie » (forfaits automatiques, exclue des phases suivantes, réintégration possible). |

Vérifications faites sur prévisualisation (navigateur intégré, viewport 375 × 812 et 1280 px) : parcours complet 13 et 15 équipes, publication, mise à jour, page publique, filtre, impression simulée (couleur et niveaux de gris), verrouillages, forfaits. Production : santé API/D1 OK, nouvelles chaînes présentes dans le bundle après chaque fusion.

## Décisions utiles

- Durée d'un match calculée depuis le format, non modifiable (D1 révisé).
- Classement : 2/1/0 par match joué, moyennes par match, puis différences de sets et de points, puis tirage (D11).
- Nul seulement si le format le permet ; finale à égalité → set décisif.
- Forfait : le vainqueur reçoit les sets nécessaires, 0 point de jeu de part et d'autre, 0 point de classement pour l'équipe forfait.
- Moteur : zéro triple garanti par construction ; le nombre de doubles est « minimum démontré » seulement si la borne est atteinte, sinon « meilleur trouvé ».
- Flux Git : une étape = une branche = une PR, squash merge, `main` toujours déployable.

## En cours / reste à faire

- **PR #11 (ouverte, CI et Workers Builds verts)** : badges d'enchaînement orientés (orange « ↻ Rejoue juste après », rouge « ↳ Vient de jouer », un par équipe, heure/terrain cliquable), refus serveur des séries de 3, légende à la demande (bouton « ⓘ Légende » → popover). Vérifié sur prévisualisation (375 px et 1280 px : badges, saut vers le match, ouverture, Échap, clic extérieur). 135 tests. En attente de validation pour fusion.
- **E5** : test terrain réel ; DoD finale (README, tag `v1.0.0`, coût 0 €).

## Recettes manuelles en attente (utilisateur, sur vrai téléphone)

- Page d'accueil sur Android (E0), éditeur en < 4 min (E2), journée complète 15 équipes sur Android (CA12.5).
- QR scanné depuis un autre téléphone (CA8.1, CA8.2 : pas de décodeur QR dans le navigateur de test).
- PDF depuis Chrome Android (CA7.1, CA13.3).

## Blocages et points d'attention

- 2026-11-13 : Workers Builds n'a pas déclenché la prévisualisation de la branche `e4-3-forfaits` (même après un second push). Contournement : `npx wrangler preview` (utilise la base D1 de prévisualisation). Les builds de `main` fonctionnent.
- Brouillons : clé `et:drafts:v2` ; les brouillons créés avant E3 ne sont plus lus.
- Reportés au BACKLOG : mode hors ligne (PWA), gestion depuis un autre appareil, suppression/purge, tests E2E Playwright, demi-finales, anti-revanches, feuille de résultats papier, statuts de match, affectation poule → terrain, bouton « Retour en haut ».

## À confirmer

- Règle de forfait (2-0, 0 point) : choix par défaut, l'utilisateur peut demander 25-0 par set.
- Durée de rétention D1 Time Travel sur l'offre gratuite (avant E5).
