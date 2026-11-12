export interface Pairing {
  /** Pool the pairing belongs to. */
  poolId: string;
  /** 0-based Berger round. */
  round: number;
  /** Position in the overall pairing order (round, then table). */
  order: number;
  teamAId: string;
  teamBId: string;
}

/**
 * Every pair of teams exactly once, ordered by round using the circle method
 * (Berger tables). With an odd number of teams one team sits out each round.
 */
export function roundRobin(teamIds: readonly string[], poolId = 'p1'): Pairing[] {
  const slots: (string | null)[] = [...teamIds];
  if (slots.length % 2 === 1) {
    slots.push(null);
  }
  const size = slots.length;
  const pairings: Pairing[] = [];

  for (let round = 0; round < size - 1; round++) {
    for (let table = 0; table < size / 2; table++) {
      const home = slots[table];
      const away = slots[size - 1 - table];
      if (home != null && away != null) {
        // Alternate sides so the fixed team is not always listed first.
        const swap = table === 0 && round % 2 === 1;
        pairings.push({
          poolId,
          round,
          order: pairings.length,
          teamAId: swap ? away : home,
          teamBId: swap ? home : away,
        });
      }
    }
    // Keep the first slot fixed and rotate the others clockwise.
    const last = slots.pop() as string | null;
    slots.splice(1, 0, last);
  }
  return pairings;
}

/**
 * Round robin inside each pool. Pools are interleaved round by round so that, without
 * rest optimisation, every pool progresses at the same pace; `order` is global.
 */
export function poolPairings(pools: readonly { id: string; teamIds: readonly string[] }[]) {
  const perPool = pools.map((pool, poolIndex) =>
    roundRobin(pool.teamIds, pool.id).map((p) => ({ pairing: p, poolIndex })),
  );
  return perPool
    .flat()
    .sort(
      (x, y) =>
        x.pairing.round - y.pairing.round ||
        x.poolIndex - y.poolIndex ||
        x.pairing.order - y.pairing.order,
    )
    .map(({ pairing }, order): Pairing => ({ ...pairing, order }));
}
