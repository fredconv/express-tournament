# SPEC — Tournoi Express (nom de travail)

Version 0.1 — 2026-11-12 — **statut : validé par l'utilisateur le 2026-11-12**

## 1. Vision

Permettre à une personne d'organiser un tournoi de volley-ball **en moins de 5 minutes** depuis son téléphone, puis de partager le planning avec tous les participants via un **QR code** affiché sur son écran. Les participants consultent leur planning sur leur téléphone (page web installable) ou en PDF imprimé.

Le produit V1 est volontairement réduit : **une poule unique, chaque équipe rencontre toutes les autres une fois**, sans saisie de scores.

## 2. Utilisateurs

| Rôle | Description | Compte |
|---|---|---|
| **Organisateur** | Crée, modifie, publie et supprime un tournoi. Utilise surtout un smartphone Android, parfois un PC. | Aucun. Détient un **code de gestion** propre au tournoi. |
| **Participant** | Joueur, coach, spectateur. Scanne le QR code, consulte le planning, filtre son équipe. | Aucun. Lecture seule. |

## 3. Parcours principaux

**P1 — Organiser (cible : < 5 min pour 8 équipes, 2 terrains)**
1. Ouvrir l'app → « Nouveau tournoi ».
2. Saisir nom, date, lieu (optionnel).
3. Saisir les équipes (une par ligne ou une par une).
4. Choisir le format de match, le nombre de terrains, l'heure de début.
5. Générer → prévisualiser le planning et les éventuelles alertes.
6. Publier → afficher le QR code en plein écran.

**P2 — Consulter (cible : planning visible < 10 s après le scan)**
1. Scanner le QR code → page publique du tournoi.
2. Choisir « Mon équipe » → voir uniquement ses matchs (choix mémorisé sur l'appareil).
3. Optionnel : installer l'app, imprimer / enregistrer en PDF.

**P3 — Corriger après publication**
1. L'organisateur rouvre le tournoi depuis « Mes tournois » (même appareil) ou en saisissant son code de gestion (autre appareil).
2. Modifie (ex. une équipe absente), régénère, republie. Les participants voient la nouvelle version en actualisant.

## 4. Exigences fonctionnelles V1 et critères d'acceptation

Les critères sont vérifiables par test automatisé (TA) ou recette manuelle (RM).

### F1 — Création d'un tournoi sans inscription
- Aucun compte, e-mail ou mot de passe n'est demandé.
- Champs : nom (1–80 car., obligatoire), date (obligatoire), lieu (0–80 car.).
- Le tournoi est d'abord un **brouillon local** à l'appareil ; il devient public uniquement après « Publier ».

**Critères d'acceptation**
- [ ] CA1.1 (RM) Un organisateur crée et publie un tournoi de 8 équipes / 2 terrains en moins de 5 minutes sur un smartphone Android, sans créer de compte.
- [ ] CA1.2 (TA) Un brouillon survit à la fermeture et réouverture du navigateur.
- [ ] CA1.3 (TA) Un brouillon non publié n'est jamais envoyé au serveur.

### F2 — Gestion des équipes
- Ajouter, renommer, supprimer une équipe.
- Saisie rapide : coller une liste (une équipe par ligne).
- Contraintes : 2 à 32 équipes, nom de 1 à 40 caractères, noms uniques (insensible à la casse et aux espaces de bord).

**Critères d'acceptation**
- [ ] CA2.1 (TA) Coller 10 lignes crée 10 équipes ; les lignes vides sont ignorées.
- [ ] CA2.2 (TA) Un doublon de nom est refusé avec un message clair.
- [ ] CA2.3 (TA) Modifier ou supprimer une équipe après génération marque le planning comme « à régénérer » ; l'ancien planning ne peut pas être publié en l'état.

### F3 — Configuration : terrains, horaires, format de match
- **Terrains** : 1 à 16, nommés automatiquement « Terrain 1… », renommables.
- **Heure de début** (HH:mm). Heure de fin cible optionnelle (sert uniquement à alerter).
- **Format de match** (informatif en V1, affiché sur le planning et le PDF) :
  - *Au temps* : nombre de sets (1–5) × durée par set (1–60 min). Ex. 2 sets de 10 min.
  - *Aux points* : nombre de sets (1–5), points par set (5–50), mode « tous les sets se jouent » ou « sets gagnants », points du set décisif optionnels. Ex. 2 sets de 25 pts ; 3 sets de 15 pts ; 2 sets gagnants de 25, tie-break à 15.
- **Durée de créneau** (minutes) : temps réservé par match sur un terrain. Pré-remplie à partir du format (voir §7, D1), toujours modifiable.
- **Battement** entre deux créneaux (0–30 min, défaut 5).
- **Repos minimal** : « éviter qu'une équipe joue deux créneaux d'affilée » (activé par défaut).

**Critères d'acceptation**
- [ ] CA3.1 (TA) Format au temps 2 × 10 min → durée de créneau proposée = 22 min (sets + 2 min de changement de côté), modifiable.
- [ ] CA3.2 (TA) Format aux points → une durée estimée est proposée (table §7 D1) et étiquetée « estimation ».
- [ ] CA3.3 (TA) Toute valeur hors limites est refusée côté client **et** côté serveur.

### F4 — Génération automatique du calendrier (poule unique)
- Chaque équipe rencontre chaque autre équipe **exactement une fois**.
- Les matchs sont répartis en **créneaux** horaires successifs ; chaque créneau compte au plus un match par terrain.
- Les matchs sont numérotés (Match 1…M) dans l'ordre chronologique puis par terrain.
- La génération est **déterministe** : mêmes entrées → même planning.
- Le planning publié est **stocké** : une évolution future du moteur ne modifie jamais un planning déjà publié.

**Critères d'acceptation**
- [ ] CA4.1 (TA) Pour N de 2 à 32 et C de 1 à 16 : nombre de matchs = N(N−1)/2 et chaque paire apparaît une seule fois.
- [ ] CA4.2 (TA) Pour N pair, C ≥ N/2 et repos désactivé : nombre de créneaux = N−1 (N impair : N).
- [ ] CA4.3 (TA) Heures de début/fin cohérentes : début(créneau k) = début + k × (durée + battement).
- [ ] CA4.4 (TA) Génération de 32 équipes / 16 terrains en moins de 200 ms sur un smartphone milieu de gamme (mesuré < 50 ms en Node).
- [ ] CA4.5 (TA) Si l'heure de fin cible est dépassée, une alerte indique l'heure de fin réelle.

### F5 — Repos des équipes et absence de conflits
- **Aucun conflit** (invariant absolu) : une équipe ne joue jamais deux matchs dans le même créneau ; un terrain n'accueille jamais deux matchs dans le même créneau.
- **Repos** (règle souple) : si l'option est activée, une équipe ne joue pas deux créneaux consécutifs **lorsque c'est possible**. Le moteur ne laisse jamais un créneau entièrement vide pour respecter le repos ; il place alors un match et signale l'entorse.
- **Équité** : à chaque créneau, priorité aux équipes qui attendent depuis le plus longtemps.

**Critères d'acceptation**
- [ ] CA5.1 (TA, test de propriété sur toutes les combinaisons N × C) Aucun conflit équipe ni terrain.
- [ ] CA5.2 (TA) Avec repos activé, toute entorse au repos figure dans les alertes avec les équipes concernées ; sans alerte, aucune équipe ne joue deux créneaux consécutifs.
- [ ] CA5.3 (TA) Cas de référence 8 équipes / 2 terrains / repos activé : 0 entorse au repos.
- [ ] CA5.4 (TA) L'écart maximal de nombre de matchs joués entre deux équipes, à la fin de n'importe quel créneau, est documenté et ne régresse pas (test de non-régression sur cas de référence).

### F6 — Consultation du planning (PC et smartphone)
- Page publique `/t/{idPublic}` lisible sans connexion de compte.
- Mobile (≥ 360 px) : liste chronologique groupée par créneau (heure, terrain, équipes, n° de match).
- PC : grille créneaux × terrains.
- Filtre « Mon équipe » mémorisé sur l'appareil ; affiche aussi les temps de repos de l'équipe.
- Si la date du tournoi est aujourd'hui : mise en évidence du prochain match selon l'heure de l'appareil.
- Affichage de la date de dernière mise à jour ; bouton « Actualiser » ; rechargement automatique au retour sur l'onglet.
- Hors ligne : la dernière version consultée reste affichée avec un bandeau « hors ligne — version du HH:mm ».

**Critères d'acceptation**
- [ ] CA6.1 (TA, Playwright, viewport 360 × 800) Le planning d'un tournoi de 12 équipes s'affiche sans défilement horizontal.
- [ ] CA6.2 (TA) Le filtre équipe est conservé après rechargement.
- [ ] CA6.3 (RM) Sur Android (Chrome) en 4G simulée, planning lisible < 3 s après ouverture du lien.
- [ ] CA6.4 (TA) Après une première consultation, la page s'affiche en mode avion avec le bandeau hors ligne.

### F7 — Export PDF imprimable
- Bouton « Imprimer / PDF » : feuille de style d'impression A4 dédiée (en-tête : nom, date, lieu, format ; tableau des matchs ; pied : URL courte).
- Imprime la vue courante : planning complet ou planning filtré d'une équipe.

**Critères d'acceptation**
- [ ] CA7.1 (RM) Chrome desktop et Chrome Android produisent un PDF A4 lisible (police ≥ 10 pt, aucun élément d'interface parasite, pas de ligne coupée entre deux pages).
- [ ] CA7.2 (RM) Un planning de 16 équipes / 4 terrains tient sur ≤ 4 pages A4 portrait.

### F8 — QR code vers la page publique
- Après publication : écran QR plein écran, contraste maximal, URL courte affichée en clair dessous, boutons « Copier le lien » et « Partager » (partage natif si disponible).
- Le QR code ne contient **que** l'URL publique (aucun secret).
- Le QR est généré localement (fonctionne hors ligne une fois publié).

**Critères d'acceptation**
- [ ] CA8.1 (RM) Le QR affiché sur un smartphone est scanné par l'appareil photo d'un autre Android et d'un iPhone à 1 m de distance.
- [ ] CA8.2 (TA) Le contenu décodé du QR est strictement égal à l'URL publique.

### F9 — Sauvegarde, rechargement et gestion propriétaire sécurisée
- « Publier » enregistre le tournoi sur le serveur et renvoie un **code de gestion** (secret aléatoire de 160 bits, affiché une seule fois, mémorisé sur l'appareil).
- « Mes tournois » : liste des tournois gérés depuis cet appareil.
- « Gérer depuis un autre appareil » : saisir le lien du tournoi + le code de gestion.
- Modifier puis « Publier les modifications » ; supprimer le tournoi.
- Deux appareils qui modifient en même temps : le second à publier est prévenu du conflit (pas d'écrasement silencieux).
- L'organisateur est invité à copier / sauvegarder son code (copier, partager vers soi-même, afficher).

**Critères d'acceptation**
- [ ] CA9.1 (TA) Toute requête d'écriture sans code valide → 401 ; avec le code d'un autre tournoi → 401.
- [ ] CA9.2 (TA) Le code de gestion n'apparaît ni dans une URL, ni dans le QR, ni dans la réponse publique, ni dans les journaux serveur ; seul son hachage est stocké.
- [ ] CA9.3 (TA) Publication concurrente : la seconde écriture basée sur une version obsolète → 409, l'interface propose « recharger » ou « écraser ».
- [ ] CA9.4 (TA) Un tournoi supprimé renvoie 404 sur sa page publique.
- [ ] CA9.5 (RM) Reprise de la gestion sur un 2ᵉ appareil avec le code : réussite.

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

Saisie et validation des scores, classements, plusieurs poules, phases finales, inscriptions en ligne, comptes utilisateurs, statistiques, autres sports, gestion des arbitres, pauses dans la journée, réordonnancement manuel des matchs, application sur le Play Store. → voir BACKLOG.md.

## 7. Décisions produit (validées le 2026-11-12)

| # | Décision proposée (par défaut) | Pourquoi | Bloque |
|---|---|---|---|
| **D1** | Une **durée de créneau unique** pour tous les matchs. Au temps : sets × durée + 2 min par changement de côté. Aux points : estimation (25 pts ≈ 20 min/set, 21 pts ≈ 17, 15 pts ≈ 12) éditable. Le moteur ne connaît que cette durée. | Un match aux points n'a pas de durée fixe ; un créneau fixe garantit un planning lisible et sans chevauchement. | E1 |
| **D2** | Repos = « pas deux créneaux d'affilée si possible », jamais de créneau vide imposé, entorses signalées. | Bon compromis durée totale / fatigue sans paramétrage complexe. | E1 |
| **D3** | Toute modification d'équipes ou de configuration après publication **régénère le planning entier** (avec avertissement). Pas de replanification partielle en V1. | La replanification partielle (forfait en cours de tournoi) est complexe → backlog. | E2 |
| **D4** | Gestion propriétaire par **code de gestion** sans compte ni e-mail. Perdre l'appareil **et** le code = perdre le droit de modifier (le tournoi reste consultable, puis expire). | Zéro inscription exigée par le besoin. Récupération par e-mail → backlog. | E3 |
| **D5** | Hébergement **Cloudflare** (compte gratuit au nom de l'utilisateur), URL `*.workers.dev` au départ, nom de domaine plus tard. | Gratuit, pas de mise en veille, déploiement mondial. Voir ARCHITECTURE.md §3. | E0 |
| **D6** | Suppression automatique **90 jours après la date du tournoi**. | Minimisation des données, coût nul. | E3 |
| **D7** | PDF via **impression du navigateur** (feuille de style dédiée), sans bibliothèque PDF. | Zéro dépendance, rendu fidèle ; une bibliothèque ne sera ajoutée que si les tests réels montrent une gêne. | E5 |
| **D8** | Interface en français uniquement. | Périmètre. | — |
