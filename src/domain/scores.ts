import type { MatchFormat } from './types';

// Match scores (SPEC F11). A score is the list of sets in the order played.

export interface SetScore {
  a: number;
  b: number;
}

export type ScoreIssue = 'invalid-points' | 'tied-set' | 'set-count' | 'needs-winner';

export const MAX_SET_POINTS = 99;

export interface Outcome {
  setsA: number;
  setsB: number;
  pointsA: number;
  pointsB: number;
  winner: 'a' | 'b' | null;
}

/**
 * A draw is only possible when every set is played and their number is even
 * (e.g. 2 sets of 10 min ending 1–1). Never with "winning sets".
 */
export function allowsDraw(format: MatchFormat): boolean {
  const bestOf = format.kind === 'points' && format.mode === 'best-of';
  return !bestOf && format.setCount % 2 === 0;
}

export function outcome(sets: readonly SetScore[]): Outcome {
  let setsA = 0;
  let setsB = 0;
  let pointsA = 0;
  let pointsB = 0;
  for (const set of sets) {
    if (set.a > set.b) setsA++;
    if (set.b > set.a) setsB++;
    pointsA += set.a;
    pointsB += set.b;
  }
  const winner = setsA > setsB ? 'a' : setsB > setsA ? 'b' : null;
  return { setsA, setsB, pointsA, pointsB, winner };
}

/**
 * Checks a score against the match format. `needsWinner` (the final): when the
 * format allows a draw, one extra deciding set is accepted after a tie.
 */
export function scoreIssue(
  sets: readonly SetScore[],
  format: MatchFormat,
  needsWinner = false,
): ScoreIssue | null {
  const points = (n: number) => Number.isInteger(n) && n >= 0 && n <= MAX_SET_POINTS;
  if (sets.some((s) => !points(s.a) || !points(s.b))) return 'invalid-points';
  if (sets.some((s) => s.a === s.b)) return 'tied-set';

  if (format.kind === 'points' && format.mode === 'best-of') {
    return bestOfIssue(sets, format.setCount);
  }
  const regular = sets.slice(0, format.setCount);
  if (sets.length === format.setCount) {
    return needsWinner && outcome(sets).winner === null ? 'needs-winner' : null;
  }
  const decidingSet =
    needsWinner && sets.length === format.setCount + 1 && outcome(regular).winner === null;
  return decidingSet ? null : 'set-count';
}

/** Best of N: stop exactly when one team reaches the winning number of sets. */
function bestOfIssue(sets: readonly SetScore[], setCount: number): ScoreIssue | null {
  const toWin = Math.ceil(setCount / 2);
  let a = 0;
  let b = 0;
  for (const [i, set] of sets.entries()) {
    if (set.a > set.b) a++;
    else b++;
    const decided = a === toWin || b === toWin;
    if (decided !== (i === sets.length - 1)) return 'set-count';
  }
  return sets.length === 0 ? 'set-count' : null;
}
