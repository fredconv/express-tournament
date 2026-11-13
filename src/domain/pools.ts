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

/** Team id → morning pool index (0 = pool A). Teams not listed are drawn at random. */
export type PoolLocks = Readonly<Record<string, number>>;

export type LockIssue =
  | { kind: 'missing-pool'; teamId: string; poolIndex: number }
  | { kind: 'over-capacity'; poolIndex: number; locked: number; capacity: number };

/**
 * Locks that cannot be honoured with the current pool layout (SPEC F10): a pool that
 * no longer exists, or more locked teams than a pool holds. Locks of removed teams are
 * ignored. The draw is refused while any issue remains: a lock is never moved silently.
 */
export function lockIssues(teamIds: readonly string[], locks: PoolLocks): LockIssue[] {
  const sizes = poolSizes(teamIds.length);
  const issues: LockIssue[] = [];
  const locked = new Array<number>(sizes.length).fill(0);
  for (const teamId of teamIds) {
    const poolIndex = locks[teamId];
    if (poolIndex === undefined) continue;
    if (!Number.isInteger(poolIndex) || poolIndex < 0 || poolIndex >= sizes.length) {
      issues.push({ kind: 'missing-pool', teamId, poolIndex });
    } else {
      locked[poolIndex] = (locked[poolIndex] ?? 0) + 1;
    }
  }
  locked.forEach((count, poolIndex) => {
    const capacity = sizes[poolIndex] as number;
    if (count > capacity)
      issues.push({ kind: 'over-capacity', poolIndex, locked: count, capacity });
  });
  return issues;
}

/**
 * Random draw with a stored seed: same seed and locks, same pools. Locked teams stay in
 * their pool; the others fill the remaining places at random, pool sizes unchanged.
 * Without locks the draw is exactly the plain random draw. The order inside a pool is
 * the draw order (last ranking tie-break), shuffled too so a lock gives no advantage.
 */
export function drawPools(
  teamIds: readonly string[],
  seed: number,
  locks: PoolLocks = {},
): PoolInput[] {
  const random = seededRandom(seed);
  const isLocked = (teamId: string) => locks[teamId] !== undefined;
  if (!teamIds.some(isLocked)) return splitIntoPools(shuffled(teamIds, random), 'P');
  if (lockIssues(teamIds, locks).length > 0) throw new RangeError('Pool locks cannot be honoured');

  const sizes = poolSizes(teamIds.length);
  const members: string[][] = sizes.map(() => []);
  for (const teamId of teamIds) {
    const poolIndex = locks[teamId];
    if (poolIndex !== undefined) members[poolIndex]?.push(teamId);
  }
  const free = shuffled(
    teamIds.filter((t) => !isLocked(t)),
    random,
  );
  sizes.forEach((size, i) => {
    const pool = members[i] as string[];
    while (pool.length < size) pool.push(free.shift() as string);
  });
  return members.map((pool, i) => ({ id: `P${i + 1}`, teamIds: shuffled(pool, random) }));
}
