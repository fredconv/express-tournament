import type { Pairing } from './roundRobin';

export interface SlotAssignment {
  pairing: Pairing;
  slot: number;
  /** Index into the court list. */
  courtIndex: number;
}

export interface AssignResult {
  assignments: SlotAssignment[];
  slotCount: number;
  /** Teams that played two consecutive slots, by slot where it happened. */
  backToBack: { slot: number; teamIds: string[] }[];
  /** Longest run of consecutive slots played by any team. */
  longestStreak: number;
}

interface TeamState {
  lastSlot: number;
  /** Consecutive slots played up to and including `lastSlot`. */
  streak: number;
  remaining: number;
}

const NEVER_PLAYED = -2;

/**
 * Greedy slot filling (ARCHITECTURE.md §5, decision D2).
 *
 * Every slot uses as many courts as possible, so the day is as short as the greedy
 * allows. Within that, when rest is enabled, pairings are ranked by:
 *   1. fatigue cost: for each team that played the previous slot, the square of the
 *      run it would extend (spreads unavoidable back-to-backs instead of piling them
 *      on the same teams),
 *   2. most matches still to play for both teams (they are the bottleneck),
 *   3. longest cumulated wait of both teams,
 *   4. `tieBreak` rank (pairing order by default; callers may pass seeded variants).
 * Without rest, Berger order alone is used, which yields the optimal N−1 (even) or
 * N (odd) slots when there are enough courts for a full round.
 */
export function assignSlots(
  pairings: readonly Pairing[],
  courtCount: number,
  avoidBackToBack: boolean,
  tieBreak?: ReadonlyMap<Pairing, number>,
): AssignResult {
  const teams = new Map<string, TeamState>();
  for (const p of pairings) {
    for (const teamId of [p.teamAId, p.teamBId]) {
      const state = teams.get(teamId) ?? { lastSlot: NEVER_PLAYED, streak: 0, remaining: 0 };
      state.remaining++;
      teams.set(teamId, state);
    }
  }
  const team = (teamId: string) => teams.get(teamId) as TeamState;

  const remaining = [...pairings];
  const assignments: SlotAssignment[] = [];
  const backToBack: AssignResult['backToBack'] = [];
  let longestStreak = 0;
  let slotCount = 0;

  for (let slot = 0; remaining.length > 0; slot++) {
    const ranked = avoidBackToBack
      ? rankForRest(remaining, slot, team, tieBreak)
      : [...remaining].sort((x, y) => x.round - y.round || x.order - y.order);
    const picked = pickFreeTeams(ranked, courtCount);

    const tired: string[] = [];
    picked.forEach((pairing, courtIndex) => {
      assignments.push({ pairing, slot, courtIndex });
      remaining.splice(remaining.indexOf(pairing), 1);
      for (const teamId of [pairing.teamAId, pairing.teamBId]) {
        const state = team(teamId);
        const consecutive = state.lastSlot === slot - 1;
        if (consecutive) tired.push(teamId);
        state.streak = consecutive ? state.streak + 1 : 1;
        state.lastSlot = slot;
        state.remaining--;
        longestStreak = Math.max(longestStreak, state.streak);
      }
    });
    if (avoidBackToBack && tired.length > 0) {
      backToBack.push({ slot, teamIds: tired });
    }
    slotCount = slot + 1;
  }

  return { assignments, slotCount, backToBack, longestStreak };
}

/** Decorate-sort-undecorate: keys are computed once per pairing per slot. */
function rankForRest(
  remaining: readonly Pairing[],
  slot: number,
  team: (teamId: string) => TeamState,
  tieBreak: ReadonlyMap<Pairing, number> | undefined,
): Pairing[] {
  const fatigue = (state: TeamState) => (state.lastSlot === slot - 1 ? state.streak ** 2 : 0);
  const keyed = remaining.map((pairing) => {
    const a = team(pairing.teamAId);
    const b = team(pairing.teamBId);
    return {
      pairing,
      fatigue: fatigue(a) + fatigue(b),
      load: a.remaining + b.remaining,
      wait: slot - a.lastSlot + (slot - b.lastSlot),
      rank: tieBreak?.get(pairing) ?? pairing.order,
    };
  });
  keyed.sort(
    (x, y) => x.fatigue - y.fatigue || y.load - x.load || y.wait - x.wait || x.rank - y.rank,
  );
  return keyed.map((k) => k.pairing);
}

/** Takes pairings in rank order, skipping any whose team already plays in this slot. */
function pickFreeTeams(ranked: readonly Pairing[], courtCount: number): Pairing[] {
  const busy = new Set<string>();
  const picked: Pairing[] = [];
  for (const pairing of ranked) {
    if (picked.length === courtCount) break;
    if (busy.has(pairing.teamAId) || busy.has(pairing.teamBId)) continue;
    picked.push(pairing);
    busy.add(pairing.teamAId);
    busy.add(pairing.teamBId);
  }
  return picked;
}
