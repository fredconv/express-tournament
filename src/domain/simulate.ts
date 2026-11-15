import { seededRandom } from './schedule/random';
import { type SetScore, scoreIssue } from './scores';
import type { MatchFormat } from './types';

// Test tournaments only (SPEC F15): plausible scores that follow the match format.
// The result is always checked with `scoreIssue`, the same rule as manual entry.

export type SimulationMode = 'random' | 'favorites';

/**
 * Chance that side A wins a set. `strength` goes from 0 (weakest) to 1 (strongest);
 * "random" ignores it, "favorites" lets the stronger side win most sets.
 */
function setWinChance(mode: SimulationMode, strengthA: number, strengthB: number): number {
  return mode === 'random' ? 0.5 : 0.5 + 0.45 * (strengthA - strengthB);
}

/** Random generator for one match: same seed and match id, same score, in any order. */
export function matchRandom(seed: number, matchId: string): () => number {
  let hash = 2166136261;
  for (const char of matchId) hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 16777619);
  return seededRandom((seed ^ hash) >>> 0);
}

const between = (random: () => number, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));

/** One set won by `winner`: target points for a points set, a time-limited score otherwise. */
function playSet(winner: 'a' | 'b', target: number | null, random: () => number): SetScore {
  const high = target ?? between(random, 12, 24);
  const low =
    target === null ? between(random, 6, high - 1) : between(random, Math.ceil(high / 2), high - 2);
  return winner === 'a' ? { a: high, b: low } : { a: low, b: high };
}

export interface SimulatedMatch {
  format: MatchFormat;
  /** The final needs a winner: a deciding set is added after a tie when draws are possible. */
  needsWinner: boolean;
  strengthA: number;
  strengthB: number;
}

/** A valid score for one match; throws if the format rules were not met (a bug). */
export function simulateScore(
  match: SimulatedMatch,
  mode: SimulationMode,
  random: () => number,
): SetScore[] {
  const { format } = match;
  const chance = setWinChance(mode, match.strengthA, match.strengthB);
  const side = (): 'a' | 'b' => (random() < chance ? 'a' : 'b');
  const pointsFor = (index: number): number | null => {
    if (format.kind === 'time') return null;
    const last = index === format.setCount - 1;
    return last && format.decidingSetPoints !== undefined
      ? format.decidingSetPoints
      : format.pointsPerSet;
  };

  const sets: SetScore[] = [];
  if (format.kind === 'points' && format.mode === 'best-of') {
    const toWin = Math.ceil(format.setCount / 2);
    let a = 0;
    let b = 0;
    while (a < toWin && b < toWin) {
      const winner = side();
      sets.push(playSet(winner, pointsFor(sets.length), random));
      if (winner === 'a') a++;
      else b++;
    }
  } else {
    for (let i = 0; i < format.setCount; i++) sets.push(playSet(side(), pointsFor(i), random));
    const won = sets.filter((s) => s.a > s.b).length;
    if (match.needsWinner && won * 2 === sets.length) {
      sets.push(playSet(side(), pointsFor(format.setCount - 1), random));
    }
  }
  const issue = scoreIssue(sets, format, match.needsWinner);
  if (issue !== null) throw new Error(`Simulated score breaks the format: ${issue}`);
  return sets;
}
