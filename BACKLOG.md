# BACKLOG — Tournoi Express

Tout ce qui n'est pas dans SPEC.md V1 vit ici. Rien de ce fichier n'est développé sans décision explicite de l'utilisateur et mise à jour de SPEC.md.

Priorité indicative : **P1** = première itération après V1, **P2** = ensuite, **P3** = idée à confirmer.

## V2 — Fonctionnalités prévues

| # | Élément | Prio | Notes d'architecture (ARCHITECTURE.md §13) |
|---|---|---|---|
| B1 | Saisie des scores par match depuis un smartphone (participants) | P1 | Table `match_results` séparée du document ; clé = `match.id`. |
| B2 | Validation des scores par un responsable | P1 | Basée sur le code de gestion ou un code « table de marque ». |
| B3 | Classements automatiques (points, sets, ratio de points) | P1 | Fonction pure `computeStandings` dans `domain/`. Règles de départage à spécifier. |
| B4 | Plusieurs poules | P2 | `schemaVersion: 2` avec `phases[]`, migration v1 → v2. |
| B5 | Tournois éliminatoires (phases finales, consolante) | P2 | Nouveau type de phase ; qualifiés issus des classements. |
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
| A18 | Base D1 de préproduction séparée (les prévisualisations de branche utilisent la base de production) | P2 | ADR-6. |

## Dette technique / qualité

_(vide — à alimenter pendant le développement ; chaque entrée indique le fichier et l'impact)_

## Anomalies non bloquantes

_(vide — format : date, description, étapes de reproduction, impact, contournement)_
