import { seededRandom, shuffled } from './schedule/random';
import type { PoolInput } from './types';

// Morning pool draw (SPEC F10, decision D10).

const MIN_POOL = 3;
const MAX_POOL = 5;
const TARGET_POOL = 4;
/** Below this count every team goes in a single pool. */
const MIN_TEAMS_FOR_POOLS = 6;

/** Balanced pool sizes, larger pools first: 13 → [5, 4, 4], 15 → [4, 4, 4, 3]. */
export function poolSizes(teamCount: number): number[] {
  if (teamCount < MIN_TEAMS_FOR_POOLS) return [teamCount];
  let best: number[] = [teamCount];
  let bestGap = Number.POSITIVE_INFINITY;
  for (let count = 2; count <= teamCount; count++) {
    const sizes = splitEvenly(teamCount, count);
    const smallest = sizes[sizes.length - 1] as number;
    if (smallest < MIN_POOL || (sizes[0] as number) > MAX_POOL) continue;
    const gap = Math.abs(teamCount / count - TARGET_POOL);
    // On a tie, prefer more (smaller) pools: shorter day.
    if (gap <= bestGap) {
      best = sizes;
      bestGap = gap;
    }
  }
  return best;
}

function splitEvenly(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const extra = total % count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Splits teams into pools in the given order; ids are `${prefix}1`, `${prefix}2`… */
export function splitIntoPools(teamIds: readonly string[], prefix: string): PoolInput[] {
  const pools: PoolInput[] = [];
  let next = 0;
  poolSizes(teamIds.length).forEach((size, i) => {
    pools.push({ id: `${prefix}${i + 1}`, teamIds: teamIds.slice(next, next + size) });
    next += size;
  });
  return pools;
}

/** Random draw with a stored seed: same seed, same pools. The pool order is the draw order. */
export function drawPools(teamIds: readonly string[], seed: number): PoolInput[] {
  return splitIntoPools(shuffled(teamIds, seededRandom(seed)), 'P');
}
