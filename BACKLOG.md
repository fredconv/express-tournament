# BACKLOG — Tournoi Express

Tout ce qui n'est pas dans SPEC.md V1 vit ici. Rien de ce fichier n'est développé sans décision explicite de l'utilisateur et mise à jour de SPEC.md.

Priorité indicative : **P1** = première itération après V1, **P2** = ensuite, **P3** = idée à confirmer.

## V2 — Fonctionnalités prévues

| # | Élément | Prio | Notes d'architecture (ARCHITECTURE.md §13) |
|---|---|---|---|
| B1 | Saisie des scores par les équipes (participants) | P1 | En V1 seul l'organisateur saisit (D14). |
| B2 | Validation des scores par un responsable | P2 | Code « table de marque ». |
| B3 | Confrontation directe et autres règles de départage | P2 | V1 : D11. |
| B4 | Demi-finales, petite finale, tableau éliminatoire | P2 | Une manche = des poules de deux équipes (`schedulePools`). |
| B5 | Autres formats de tournoi (consolante, système suisse…) | P3 | Hors MVP (recentrage du 2026-11-12). |
| B6 | Inscriptions des équipes en ligne | P3 | Nécessite modération et anti-spam. |
| B7 | Statistiques | P3 | — |
| B8 | Autres sports et formats (beach, badminton, foot…) | P3 | `sport` est déjà un champ du document. |

## Améliorations non bloquantes (candidates post-V1)

| # | Élément | Prio | Origine |
|---|---|---|---|
| A1 | Arbitrage assigné à une équipe au repos | P1 | Pratique courante en volley. |
| A2 | Pauses dans la journée (repas) | P1 | Tournois sur une journée complète. |
| A3 | Replanification partielle (forfait d'une équipe en cours de tournoi) | P1 | Décision D3. |
| A4 | Réordonnancement manuel (échanger deux matchs / terrains) | P2 | |
| A5 | Récupération de la gestion par e-mail / comptes optionnels | P2 | Décision D4. |
| A6 | Révocation / rotation du code de gestion | P2 | Sécurité. |
| A7 | Export / import JSON d'un tournoi (sauvegarde locale, duplication) | P2 | |
| A8 | Dupliquer un tournoi existant comme modèle | P2 | |
| A9 | Fichier PDF généré (bibliothèque) si l'impression navigateur gêne en test réel | P2 | Décision D7. |
| A10 | Publication Play Store (TWA ou Capacitor) | P2 | |
| A11 | Notifications « votre match commence dans 10 min » | P3 | Push web, nécessite consentement. |
| A12 | Mode « écran géant » (TV de la salle, défilement automatique) | P3 | |
| A13 | Traduction (néerlandais, anglais) | P2 | Textes déjà centralisés dans `i18n/fr.ts`. |
| A14 | Ordre de génération aléatoire (graine) | P3 | Le moteur est déterministe par conception. |
| A15 | Durées de créneau différentes selon les matchs | P3 | Décision D1. |
| A16 | Signalement de contenu abusif sur une page publique | P3 | Si abus constatés. |
| A17 | Nom de domaine dédié | P2 | Décision D5. |
| A20 | Éviter les revanches matin / après-midi | P2 | V1 : blocs consécutifs (D12). |
| A21 | Têtes de série, déplacement manuel d'une équipe entre poules | P2 | V1 : tirage au sort. |
| A22 | Mode hors ligne (PWA installable) | P1 | Reporté du MVP. |
| A23 | Gérer depuis un autre appareil, suppression, purge automatique à 90 jours | P1 | Reporté du MVP (D4, D6). |
| A24 | Tests E2E Playwright et audit Lighthouse | P2 | Reporté du MVP. |
| A25 | Estimation de l'heure de fin de journée dès la configuration | P2 | |
| A19 | ~~Optimiseur de repos plus fort~~ : séries de 3+ supprimées par ADR-12 (2026-11-13). Reste possible : recherche locale pour réduire encore les doubles ou la durée sur les grands tournois. | P3 | ADR-12. |

## Dette technique / qualité

_(vide — à alimenter pendant le développement ; chaque entrée indique le fichier et l'impact)_

## Anomalies non bloquantes

_(vide — format : date, description, étapes de reproduction, impact, contournement)_
