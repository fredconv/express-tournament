import { normalizeName } from './names';
import { seededRandom, shuffled } from './schedule/random';

// Fictional team names (SPEC F2): local list, no network, instant, mostly volleyball puns.

const NAMES = [
  'Les Smash Patates',
  'Les Filets Mignons',
  'Les Manchettes Folles',
  'Les Sans Pression',
  'Les Smashonautes',
  'Les Passe-Partout',
  'Les Balles à Zéro',
  'Les Volley Dingues',
  'Les Bras Cassés',
  'Les Service Compris',
  'Les Contre-Attaques',
  'Les Sets Gagnants',
  'Les Ballons Ronds',
  'Les Plongeons Libres',
  'Les Smash Bros',
  'Les Block Party',
  'Les Ace de Pique',
  'Les Manchots Volants',
  'Les Filets de Pêche',
  'Les Coups Francs',
  'Les Sables Mouvants',
  'Les Pieds Nus',
  'Les Tongs Rapides',
  'Les Crabes Volants',
  'Les Mouettes Rieuses',
  'Les Dauphins Sauteurs',
  'Les Requins du Filet',
  'Les Pélicans Smasheurs',
  'Les Coquillages',
  'Les Châteaux de Sable',
  'Les Coups de Soleil',
  'Les Vagues Scélérates',
  'Les Tsunamis',
  'Les Marées Hautes',
  'Les Crèmes Solaires',
  'Les Parasols',
  'Les Ballons Dégonflés',
  'Les Rebonds Heureux',
  'Les Plongeurs Fous',
  'Les Réceptions Molles',
  'Les Passeurs Pressés',
  'Les Libéros Libres',
  'Les Pointus',
  'Les Centraux Givrés',
  'Les Attaquants Fatigués',
  'Les Bloqueurs Fous',
  'Les Contreurs Masqués',
  'Les Smash Nachos',
  'Les Frites Smash',
  'Les Moules Frites',
  'Les Gaufres Volantes',
  'Les Pralines',
  'Les Chouquettes',
  'Les Croissants Smash',
  'Les Baguettes Magiques',
  'Les Fromages Qui Smashent',
  'Les Raclettes',
  'Les Fondus du Volley',
  'Les Tartiflettes',
  'Les Crêpes Party',
  'Les Pastèques',
  'Les Mojitos',
  'Les Limonades',
  'Les Glaçons',
  'Les Esquimaux',
  'Les Sorbets',
  'Les Cocotiers',
  'Les Ananas Smash',
  'Les Kiwis Sauteurs',
  'Les Bananes Volantes',
  'Les Tomates Cerises',
  'Les Petits Pois',
  'Les Patates Douces',
  'Les Navets Volants',
  'Les Poireaux',
  'Les Courgettes',
  'Les Haricots Sauteurs',
  'Les Lapins Crétins',
  'Les Kangourous',
  'Les Ouistitis',
  'Les Pingouins',
  'Les Paresseux',
  'Les Flamants Roses',
  'Les Hérissons',
  'Les Écureuils',
  'Les Koalas',
  'Les Lamas',
  'Les Tortues Ninja',
  'Les Escargots Turbo',
  'Les Fusées',
  'Les Comètes',
  'Les Étoiles Filantes',
  'Les Météores',
  'Les Ovnis',
  'Les Martiens',
  'Les Astronautes',
  'Les Ninjas du Sable',
  'Les Pirates du Filet',
  'Les Corsaires',
  'Les Vikings',
  'Les Mousquetaires',
  'Les Gladiateurs',
  'Les Chevaliers du Smash',
  'Les Druides',
  'Les Sorciers',
  'Les Zombies',
  'Les Fantômes',
  'Les Vampires du Filet',
  'Les Tornades',
  'Les Ouragans',
  'Les Éclairs',
  'Les Tonnerres',
  'Les Volcans',
  'Les Avalanches',
  'Les Cyclones',
  'Les Blizzards',
  'Les Inarrêtables',
  'Les Invincibles',
  'Les Imprévisibles',
  'Les Infatigables',
  'Les Increvables',
  'Les Intouchables',
  'Les Pas Pressés',
  'Les Touristes',
  'Les Retraités Actifs',
  'Les Jeunes Pousses',
  'Les Anciens Combattants',
  'Les Sans Filet',
] as const;

/** Number of distinct names available. */
export const TEAM_NAME_COUNT = NAMES.length;

/**
 * `count` fictional names, different from each other and from `existing` (compared
 * like team names: case, spaces, Unicode). Seeded: same seed, same names.
 */
export function fictionalTeamNames(
  count: number,
  existing: readonly string[],
  seed: number,
): string[] {
  const taken = new Set(existing.map(normalizeName));
  const free = shuffled(NAMES, seededRandom(seed)).filter(
    (name) => !taken.has(normalizeName(name)),
  );
  const names: string[] = free.slice(0, Math.max(0, count));
  // Only reachable if almost every name is already used: numbered variants stay unique.
  for (let n = 2; names.length < count; n++) {
    for (const base of NAMES) {
      if (names.length >= count) break;
      const candidate = `${base} ${n}`;
      if (!taken.has(normalizeName(candidate))) {
        names.push(candidate);
        taken.add(normalizeName(candidate));
      }
    }
  }
  return names;
}
