import type { MatchFormat } from '../../domain/types';
import { fr } from '../i18n/fr';

/** Human label of a match format, e.g. "2 sets gagnants de 25 pts, dernier set à 15 pts". */
export function describeFormat(format: MatchFormat): string {
  if (format.kind === 'time') return fr.format.time(format.setCount, format.minutesPerSet);
  const base =
    format.mode === 'best-of'
      ? fr.format.bestOf(Math.ceil(format.setCount / 2), format.pointsPerSet)
      : fr.format.allSets(format.setCount, format.pointsPerSet);
  return format.decidingSetPoints === undefined
    ? base
    : base + fr.format.decidingSet(format.decidingSetPoints);
}
