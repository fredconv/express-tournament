# SPEC — Tournoi Express (nom de travail)

Version 0.3 — 2026-11-12 — **statut : MVP recentré à la demande de l'utilisateur le 2026-11-12** (poules du matin, scores, après-midi, finale simple, publication). Décisions D10–D13 : réglages par défaut proposés, à confirmer.

**Règle de périmètre** : avant d'ajouter une fonctionnalité, se demander si elle est indispensable pour mener un vrai tournoi avec la V1. Sinon → BACKLOG.md. Aucun élargissement sans accord explicite de l'utilisateur.

## 1. Vision

Permettre à une personne d'organiser un tournoi de volley-ball **en moins de 5 minutes** depuis son téléphone, puis de partager le planning avec tous les participants via un **QR code** affiché sur son écran. Les participants consultent leur planning sur leur téléphone (page web installable) ou en PDF imprimé.

Cible V1 (MVP) : un **tournoi loisir d'une journée** (typiquement 13–15 équipes, 1 à 6 terrains) :
1. créer un tournoi avec ses équipes et ses terrains ;
2. générer les poules du matin et leurs matchs (chacun contre chacun dans la poule) ;
3. saisir les scores et calculer le classement de chaque poule ;
4. générer les poules de l'après-midi à partir des classements du matin, puis une finale simple ;
5. produire un planning chronologique par terrain (durée de match, temps de rotation, pause de midi fixe) ;
6. partager un planning public adapté au mobile par lien / QR code, imprimable en PDF.

_v0.1 (poule unique sans scores) abandonnée : 15 équipes sur 2 terrains finissaient le lendemain._

## 2. Utilisateurs

| Rôle | Description | Compte |
|---|---|---|
| **Organisateur** | Crée, modifie, publie et supprime un tournoi. Utilise surtout un smartphone Android, parfois un PC. | Aucun. Détient un **code de gestion** propre au tournoi. |
| **Participant** | Joueur, coach, spectateur. Scanne le QR code, consulte le planning, filtre son équipe. | Aucun. Lecture seule. |

## 3. Parcours principaux

**P1 — Organiser**
1. « Nouveau tournoi » → nom, date, lieu (optionnel).
2. Saisir les équipes (coller une liste).
3. Réglages : terrains (1–6), heure de début, durée d'un match, rotation, pause de midi.
4. Tirer les poules du matin → planning du matin.
5. Publier → QR code.

**P2 — Mener la journée (organisateur)**
1. Saisir le score de chaque match terminé → classements des poules.
2. Matin terminé → « Générer l'après-midi » (poules de niveau + finale) → publier les mises à jour.
3. Saisir les scores de l'après-midi puis de la finale → publier.

**P3 — Consulter (participant)**
1. Scanner le QR → page publique : planning de la journée, scores, classements.
2. Choisir « Mon équipe » (mémorisé sur l'appareil) ; imprimer / PDF si besoin.

## 4. Exigences fonctionnelles V1 et critères d'acceptation

Les critères sont vérifiables par test automatisé (TA) ou recette manuelle (RM).

### F1 — Création d'un tournoi sans inscription
- Aucun compte, e-mail ou mot de passe n'est demandé.
- Champs : nom (1–80 car., obligatoire), date (obligatoire), lieu (0–80 car.).
- Le tournoi est d'abord un **brouillon local** à l'appareil ; il devient public uniquement après « Publier ».

**Critères d'acceptation**
- [ ] CA1.1 (RM) Un organisateur crée et publie un tournoi de 8 équipes / 2 terrains en moins de 5 minutes sur un smartphone Android, sans créer de compte.
- [x] CA1.2 (TA) Un brouillon survit à la fermeture et réouverture du navigateur.
- [x] CA1.3 (TA) Un brouillon non publié n'est jamais envoyé au serveur.

### F2 — Gestion des équipes
- Ajouter, renommer, supprimer une équipe.
- Saisie rapide : coller une liste (une équipe par ligne).
- Contraintes : 2 à 32 équipes, nom de 1 à 40 caractères, noms uniques (insensible à la casse et aux espaces de bord).

**Critères d'acceptation**
- [x] CA2.1 (TA) Coller 10 lignes crée 10 équipes ; les lignes vides sont ignorées.
- [x] CA2.2 (TA) Un doublon de nom est refusé avec un message clair.
- [x] CA2.3 (TA) Modifier ou supprimer une équipe après génération marque le planning comme « à régénérer » ; l'ancien planning ne peut pas être publié en l'état.

### F3 — Configuration : terrains, horaires, format de match
- **Terrains** : 1 à 6 (choix direct par boutons), nommés automatiquement « Terrain 1… », renommables.
- **Heure de début** (HH:mm). Heure de fin cible optionnelle (sert uniquement à alerter).
- **Format de match** (informatif en V1, affiché sur le planning et le PDF) :
  - *Au temps* : nombre de sets (1–5) × durée par set (1–60 min). Ex. 2 sets de 10 min.
  - *Aux points* : nombre de sets (1–5), points par set (5–50), mode « tous les sets se jouent » ou « sets gagnants », points du set décisif optionnels. Ex. 2 sets de 25 pts ; 3 sets de 15 pts ; 2 sets gagnants de 25, tie-break à 15.
- **Durée d'un match** (minutes) : temps réservé par match sur un terrain. Calculée à partir du format (au temps : exacte ; aux points : estimation), modifiable via « Ajuster » (voir §7, D1). L'interface ne parle plus de « créneau ».
- **Pause de midi** fixe entre la fin du matin et le début de l'après-midi (0–180 min, défaut 60).
- **Battement** entre deux créneaux (0–30 min, défaut 5).
- **Repos minimal** : « éviter qu'une équipe joue deux créneaux d'affilée » (activé par défaut).

**Critères d'acceptation**
- [x] CA3.1 (TA) Format au temps 2 × 10 min → durée de créneau proposée = 22 min (sets + 2 min de changement de côté), modifiable.
- [x] CA3.2 (TA) Format aux points → une durée estimée est proposée (table §7 D1) et étiquetée « estimation ».
- [ ] CA3.3 (TA) Toute valeur hors limites est refusée côté client **et** côté serveur.
- [ ] CA3.4 (TA) Le nombre de terrains est limité à 1–6.

### F4 — Génération automatique du calendrier d'une phase de poules
- Dans chaque poule, chaque équipe rencontre chaque autre équipe **exactement une fois** ; toutes les poules d'une phase se jouent en même temps et se partagent les terrains.
- Les matchs sont répartis en **créneaux** horaires successifs ; chaque créneau compte au plus un match par terrain.
- Les matchs sont numérotés (Match 1…M) dans l'ordre chronologique puis par terrain.
- La génération est **déterministe** : mêmes entrées → même planning.
- Le planning publié est **stocké** : une évolution future du moteur ne modifie jamais un planning déjà publié.

**Critères d'acceptation**
- [x] CA4.1 (TA) Pour une poule de N de 2 à 32 équipes et C de 1 à 16 terrains : nombre de matchs = N(N−1)/2 et chaque paire apparaît une seule fois.
- [x] CA4.2 (TA) Pour N pair, C ≥ N/2 et repos désactivé : nombre de créneaux = N−1 (N impair : N).
- [x] CA4.3 (TA) Heures de début/fin cohérentes : début(créneau k) = début + k × (durée + battement).
- [x] CA4.4 (TA) Génération de 32 équipes / 16 terrains en moins de 200 ms sur un smartphone milieu de gamme (mesuré < 50 ms en Node).
- [x] CA4.5 (TA) Si l'heure de fin cible est dépassée, une alerte indique l'heure de fin réelle.
- [ ] CA4.6 (TA) Plusieurs poules : aucun match entre équipes de poules différentes, chaque paire d'une poule exactement une fois, aucun conflit équipe/terrain.

### F5 — Repos des équipes et absence de conflits
_Moteur existant (E1) conservé tel quel ; aucune optimisation supplémentaire en V1._
- **Aucun conflit** (invariant absolu) : une équipe ne joue jamais deux matchs dans le même créneau ; un terrain n'accueille jamais deux matchs dans le même créneau.
- **Repos** (règle souple) : la journée la plus courte passe d'abord (tous les terrains sont occupés tant qu'il reste des matchs jouables). À durée égale, si l'option est activée, le moteur minimise les matchs consécutifs et répartit ceux qui sont inévitables entre les équipes plutôt que d'allonger la série d'une même équipe. Chaque entorse est signalée.
- **Équité** : à chaque créneau, priorité aux équipes qui attendent depuis le plus longtemps.

**Critères d'acceptation**
- [x] CA5.1 (TA, test de propriété sur toutes les combinaisons N × C) Aucun conflit équipe ni terrain.
- [x] CA5.2 (TA) Avec repos activé, toute entorse au repos figure dans les alertes avec les équipes concernées ; sans alerte, aucune équipe ne joue deux créneaux consécutifs.
- [x] CA5.3 (TA) Le planning utilise le nombre minimal de créneaux sur les cas de référence ; à durée minimale, aucune équipe n'enchaîne plus de 2 matchs sur 8 équipes / 2 terrains, et les entorses au repos sont figées dans des cas de référence (non-régression). _Révisé le 2026-11-12 : « 0 entorse » est mathématiquement impossible en 14 créneaux pour 8 équipes / 2 terrains (chaque équipe devrait jouer un créneau sur deux, ce qui sépare les équipes en deux groupes qui ne se rencontrent jamais)._
- [x] CA5.4 (TA) L'écart maximal de nombre de matchs joués entre deux équipes, à la fin de n'importe quel créneau, est documenté et ne régresse pas (test de non-régression sur cas de référence).

### F10 — Poules du matin
- Nombre de poules calculé automatiquement : poules de 3 à 5 équipes, tailles équilibrées (écart ≤ 1), taille visée 4 (D10). Moins de 6 équipes : une seule poule.
- Répartition par tirage au sort ; bouton « Nouveau tirage » tant qu'aucun score n'est saisi.
- Toutes les poules se jouent en même temps sur les terrains partagés (F4).

**Critères d'acceptation**
- [ ] CA10.1 (TA) Pour N de 3 à 32 : tailles de poule dans 3–5 (N < 6 : une poule de N), écart ≤ 1.
- [ ] CA10.2 (TA) 13, 14, 15 équipes → 5-4-4, 4-4-3-3, 4-4-4-3.
- [ ] CA10.3 (TA) Même graine → même tirage ; chaque équipe est dans exactement une poule.

### F11 — Scores et classements
- L'organisateur saisit le score de chaque match set par set ; il peut le corriger ou l'effacer.
- Contrôles simples : nombre de sets compatible avec le format, pas de set à égalité, la finale doit avoir un vainqueur.
- Classement de poule (D11) : points (victoire 2, nul 1, défaite 0) par match joué, puis différence de sets par match, puis différence de points par match, puis ordre du tirage.

**Critères d'acceptation**
- [ ] CA11.1 (TA) Classement correct sur des cas de référence (égalités, match nul, poule incomplète).
- [ ] CA11.2 (TA) Un score incohérent est refusé avec un message clair.

### F12 — Après-midi et finale
- « Générer l'après-midi » quand tous les matchs du matin ont un score.
- Classement général : rang dans la poule, puis critères F11 entre équipes de même rang.
- Poules de l'après-midi par blocs consécutifs de ce classement (D12), mêmes tailles que la règle du matin ; tout le monde joue. Elles commencent après la pause de midi.
- Finale simple : 1ᵉʳ contre 2ᵉ de la première poule de l'après-midi, sur le terrain 1, après le dernier match de l'après-midi (D13).
- Modifier un score du matin après génération de l'après-midi affiche « après-midi à régénérer ».

**Critères d'acceptation**
- [ ] CA12.1 (TA) Pour N de 6 à 32 : chaque équipe est dans exactement une poule de l'après-midi et y joue au moins 2 matchs.
- [ ] CA12.2 (TA) La première poule de l'après-midi contient les meilleures équipes du classement général.
- [ ] CA12.3 (TA) La finale oppose les deux premiers de la première poule de l'après-midi, une fois tous ses matchs saisis.

### F6 — Consultation du planning (PC et smartphone)
- Page publique `/t/{idPublic}` lisible sans connexion de compte.
- Mobile (≥ 360 px) : liste chronologique groupée par créneau (heure, terrain, équipes, n° de match).
- PC : grille créneaux × terrains.
- Scores saisis et classements des poules.
- Filtre « Mon équipe » mémorisé sur l'appareil.
- Date de dernière mise à jour ; bouton « Actualiser ».

**Critères d'acceptation**
- [ ] CA6.1 (RM, viewport 360 × 800) Le planning d'un tournoi de 12 équipes s'affiche sans défilement horizontal.
- [ ] CA6.2 (TA) Le filtre équipe est conservé après rechargement.
- [ ] CA6.3 (RM) Sur Android (Chrome) en 4G simulée, planning lisible < 3 s après ouverture du lien.

### F7 — Export PDF imprimable
- Bouton « Imprimer / PDF » : feuille de style d'impression A4 dédiée (en-tête : nom, date, lieu, format ; tableau des matchs ; pied : URL courte).
- Imprime la vue courante : planning complet ou planning filtré d'une équipe.

**Critères d'acceptation**
- [ ] CA7.1 (RM) Chrome desktop et Chrome Android produisent un PDF A4 lisible (police ≥ 10 pt, aucun élément d'interface parasite, pas de ligne coupée entre deux pages).
- [ ] CA7.2 (RM) Un planning de 16 équipes / 4 terrains tient sur ≤ 4 pages A4 portrait.

### F8 — QR code vers la page publique
- Après publication : écran QR plein écran, contraste maximal, URL courte affichée en clair dessous, boutons « Copier le lien » et « Partager » (partage natif si disponible).
- Le QR code ne contient **que** l'URL publique (aucun secret).
- Le QR est généré localement (bibliothèque `qrcode`, aucun service externe).

**Critères d'acceptation**
- [ ] CA8.1 (RM) Le QR affiché sur un smartphone est scanné par l'appareil photo d'un autre Android et d'un iPhone à 1 m de distance.
- [ ] CA8.2 (TA) Le contenu décodé du QR est strictement égal à l'URL publique.

### F9 — Sauvegarde, rechargement et gestion propriétaire sécurisée
- « Publier » enregistre le tournoi sur le serveur et renvoie un **code de gestion** (secret aléatoire de 160 bits, affiché une seule fois, mémorisé sur l'appareil).
- « Mes tournois » : liste des tournois gérés depuis cet appareil.
- Modifier (scores, après-midi) puis « Publier les mises à jour ».
- Deux appareils qui modifient en même temps : le second à publier est prévenu du conflit (pas d'écrasement silencieux).
- L'organisateur est invité à copier / sauvegarder son code (copier, partager vers soi-même, afficher).

**Critères d'acceptation**
- [ ] CA9.1 (TA) Toute requête d'écriture sans code valide → 401 ; avec le code d'un autre tournoi → 401.
- [ ] CA9.2 (TA) Le code de gestion n'apparaît ni dans une URL, ni dans le QR, ni dans la réponse publique, ni dans les journaux serveur ; seul son hachage est stocké.
- [ ] CA9.3 (TA) Publication concurrente : la seconde écriture basée sur une version obsolète → 409, l'interface affiche un message clair.
- [ ] CA9.4 (TA) Un tournoi inconnu renvoie 404.

## 5. Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| Plateformes | Chrome Android (2 dernières versions), Samsung Internet, Safari iOS ≥ 16, Chrome/Firefox/Edge desktop. |
| Ergonomie | Mobile d'abord (≥ 360 px), cibles tactiles ≥ 44 px, utilisable d'une main. |
| Performance | JS initial de la page publique ≤ 150 Ko gzip ; LCP < 2,5 s en 4G. |
| Hors ligne | App installable (PWA). Brouillon organisateur et dernière version consultée disponibles hors ligne. Publier nécessite le réseau. |
| Accessibilité | Contrastes WCAG AA, navigation clavier sur PC, libellés de formulaire. |
| Langue | Français uniquement en V1 (textes centralisés pour une traduction ultérieure). |
| Sécurité | Voir ARCHITECTURE.md §8. Aucune écriture sans code de gestion. |
| Données personnelles | Seuls des noms d'équipes sont stockés ; pas de cookie de suivi ; pages publiques non indexées ; suppression automatique (§7 D6). |
| Coût | 0 € d'hébergement dans les offres gratuites ; nom de domaine optionnel. |
| Volume | Dimensionné pour plusieurs centaines de tournois actifs et ~200 consultations par tournoi. |

## 6. Hors périmètre V1

Arbitrage automatique, optimisation avancée des temps de repos (au-delà du moteur existant), replanification dynamique, bénévoles et restauration, plusieurs formats de tournoi, notifications, demi-finales et petite finale, évitement des revanches, têtes de série, saisie des scores par les équipes, mode hors ligne (PWA), gestion depuis un autre appareil, suppression manuelle, inscriptions en ligne, comptes, statistiques, autres pauses que celle de midi, réordonnancement manuel, Play Store. → voir BACKLOG.md.

## 7. Décisions produit (validées le 2026-11-12)

| # | Décision proposée (par défaut) | Pourquoi | Bloque |
|---|---|---|---|
| **D1** | Une **durée de match unique** (le « créneau ») pour tous les matchs, toutes phases confondues. Au temps : sets × durée + 2 min par changement de côté. Aux points : estimation (25 pts ≈ 20 min/set, 21 pts ≈ 17, 15 pts ≈ 12) éditable. Le moteur ne connaît que cette durée. | Un match aux points n'a pas de durée fixe ; un créneau fixe garantit un planning lisible et sans chevauchement. | E1 |
| **D2** | Repos = « pas deux créneaux d'affilée si possible », jamais de créneau vide imposé, entorses signalées. _Précisé le 2026-11-12 : la durée minimale de la journée prime ; le repos départage._ | Bon compromis durée totale / fatigue sans paramétrage complexe. | E1 |
| **D3** | Toute modification d'équipes ou de configuration après publication **régénère le planning entier** (avec avertissement). Pas de replanification partielle en V1. _v0.2 : une fois un score saisi, modifier les équipes, les terrains ou les durées exige de confirmer l'effacement des scores et des phases suivantes ; le nom des équipes et des terrains reste modifiable._ | La replanification partielle (forfait en cours de tournoi) est complexe → backlog. | E2 |
| **D4** | Gestion propriétaire par **code de gestion** sans compte ni e-mail. Perdre l'appareil **et** le code = perdre le droit de modifier (le tournoi reste consultable, puis expire). | Zéro inscription exigée par le besoin. Récupération par e-mail → backlog. | E5 |
| **D5** | Hébergement **Cloudflare** (compte gratuit au nom de l'utilisateur), URL `*.workers.dev` au départ, nom de domaine plus tard. | Gratuit, pas de mise en veille, déploiement mondial. Voir ARCHITECTURE.md §3. | E0 |
| **D6** | Suppression automatique **90 jours après la date du tournoi**. | Minimisation des données, coût nul. | E5 |
| **D7** | PDF via **impression du navigateur** (feuille de style dédiée), sans bibliothèque PDF. | Zéro dépendance, rendu fidèle ; une bibliothèque ne sera ajoutée que si les tests réels montrent une gêne. | E7 |
| **D8** | Interface en français uniquement. | Périmètre. | — |
| **D9** | MVP : poules du matin → poules de l'après-midi → finale simple. **Demandé par l'utilisateur le 2026-11-12.** | Le toutes-contre-toutes ne tient pas dans une journée au-delà de ~8 équipes. | E3 |
| **D10** | Poules de 3 à 5 équipes, taille visée 4, tirage au sort. _Par défaut, à confirmer._ | Simple, sans saisie de niveau. | E3 |
| **D11** | Classement : 2/1/0 points par match joué, puis différences de sets et de points par match, puis tirage. _Par défaut, à confirmer._ | Les moyennes rendent comparables des poules de tailles inégales. | E3 |
| **D12** | Après-midi : blocs consécutifs du classement général (meilleures équipes ensemble), tout le monde joue. Revanches possibles. _Par défaut, à confirmer._ | Le plus simple qui fait jouer tout le monde. | E3 |
| **D13** | Finale : 1ᵉʳ contre 2ᵉ de la première poule de l'après-midi. Pas de demi-finale ni de petite finale. _Par défaut, à confirmer._ | Finale « simple » demandée. | E3 |
| **D14** | Scores saisis par l'organisateur seul. | Aucun contrôle anti-triche à concevoir. | E3 |
