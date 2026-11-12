import { LIMITS } from '../limits';
import { MINUTES_PER_DAY } from '../time';
import type {
  PoolScheduleInput,
  ScheduledMatch,
  ScheduleInput,
  ScheduleResult,
  ScheduleWarning,
} from '../types';
import { type AssignResult, assignSlots } from './assignSlots';
import { seededRandom, shuffled } from './random';
import { type Pairing, poolPairings } from './roundRobin';

/** Maximum extra tie-break orders tried when rest is enabled. */
export const REST_ATTEMPTS = 60;
/** Caps attempts × slots × pairings so generation stays instant on a phone. */
const WORK_BUDGET = 400_000;
const SEED = 20261112;

/**
 * Single round-robin schedule: every team meets every other team once,
 * spread over time slots and courts. Pure and deterministic.
 */
export function generateSchedule(input: ScheduleInput): ScheduleResult {
  const { teamIds, ...rest } = input;
  return schedulePools({ ...rest, pools: [{ id: 'p1', teamIds }] });
}

/**
 * Round robin inside each pool, all pools sharing the courts (SPEC F4).
 * A knockout round is a set of two-team pools. Pure and deterministic.
 */
export function schedulePools(input: PoolScheduleInput): ScheduleResult {
  assertValidInput(input);

  const pairings = poolPairings(input.pools);
  const { assignments, slotCount, backToBack } = input.avoidBackToBack
    ? bestRestedAssignment(pairings, input.courtIds.length)
    : assignSlots(pairings, input.courtIds.length, false);

  const step = input.slotMinutes + input.transitionMinutes;
  const prefix = input.idPrefix ?? 'm';
  const first = input.firstNumber ?? 1;
  const ordered = [...assignments].sort((x, y) => x.slot - y.slot || x.courtIndex - y.courtIndex);
  const matches: ScheduledMatch[] = ordered.map((a, index) => {
    const startMinute = input.startMinute + a.slot * step;
    return {
      id: `${prefix}${first + index}`,
      poolId: a.pairing.poolId,
      number: first + index,
      slot: a.slot,
      courtId: input.courtIds[a.courtIndex] as string,
      teamAId: a.pairing.teamAId,
      teamBId: a.pairing.teamBId,
      startMinute,
      endMinute: startMinute + input.slotMinutes,
    };
  });

  const endMinute = matches.reduce((end, m) => Math.max(end, m.endMinute), input.startMinute);
  const warnings: ScheduleWarning[] = backToBack.map((b) => ({ kind: 'back-to-back', ...b }));
  if (input.targetEndMinute !== undefined && endMinute > input.targetEndMinute) {
    warnings.push({ kind: 'exceeds-target-end', endMinute });
  }
  if (endMinute > MINUTES_PER_DAY) {
    warnings.push({ kind: 'past-midnight', endMinute });
  }

  return { matches, slotCount, endMinute, warnings };
}

/**
 * The greedy cannot see the end of the day, so with rest enabled it is replayed with
 * seeded tie-break orders and the best result kept: fewest slots, then shortest
 * consecutive run, then fewest back-to-back appearances. Stops early once the
 * theoretical minimum of back-to-backs is reached. Deterministic: same input, same
 * schedule.
 */
function bestRestedAssignment(pairings: readonly Pairing[], courtCount: number): AssignResult {
  let best = assignSlots(pairings, courtCount, true);
  const attempts = Math.min(
    REST_ATTEMPTS,
    Math.floor(WORK_BUDGET / Math.max(1, best.slotCount * pairings.length)),
  );
  const random = seededRandom(SEED);
  for (let attempt = 0; attempt < attempts && !isRestOptimal(best, pairings); attempt++) {
    const order = shuffled(pairings, random);
    const tieBreak = new Map(order.map((pairing, rank) => [pairing, rank]));
    const candidate = assignSlots(pairings, courtCount, true, tieBreak);
    if (compareRest(candidate, best) < 0) best = candidate;
  }
  return best;
}

function compareRest(x: AssignResult, y: AssignResult): number {
  return (
    x.slotCount - y.slotCount ||
    x.longestStreak - y.longestStreak ||
    countBackToBack(x) - countBackToBack(y)
  );
}

function countBackToBack(result: AssignResult): number {
  return result.backToBack.reduce((sum, entry) => sum + entry.teamIds.length, 0);
}

/**
 * True when both lower bounds are reached for this slot layout:
 * - back-to-backs: when two consecutive slots need more teams than exist, the
 *   overlap must play twice in a row;
 * - longest consecutive run: a team with m matches and r rests cannot have a run
 *   shorter than ceil(m / (r + 1)).
 */
function isRestOptimal(result: AssignResult, pairings: readonly Pairing[]): boolean {
  const matchesPerTeam = new Map<string, number>();
  for (const p of pairings) {
    for (const t of [p.teamAId, p.teamBId]) matchesPerTeam.set(t, (matchesPerTeam.get(t) ?? 0) + 1);
  }
  const teamCount = matchesPerTeam.size;
  const playing = new Array<number>(result.slotCount).fill(0);
  for (const a of result.assignments) playing[a.slot] = (playing[a.slot] ?? 0) + 2;
  let lowerBound = 0;
  for (let s = 1; s < playing.length; s++) {
    lowerBound += Math.max(0, (playing[s] ?? 0) + (playing[s - 1] ?? 0) - teamCount);
  }
  let streakBound = 1;
  for (const matches of matchesPerTeam.values()) {
    const rests = result.slotCount - matches;
    streakBound = Math.max(streakBound, Math.ceil(matches / (rests + 1)));
  }
  return countBackToBack(result) <= lowerBound && result.longestStreak <= streakBound;
}

function assertValidInput(input: PoolScheduleInput): void {
  const { pools, courtIds } = input;
  const teamIds = pools.flatMap((p) => p.teamIds);
  if (teamIds.length < LIMITS.minTeams || teamIds.length > LIMITS.maxTeams) {
    throw new RangeError(`Team count must be ${LIMITS.minTeams}–${LIMITS.maxTeams}`);
  }
  if (pools.some((p) => p.teamIds.length < 2)) {
    throw new RangeError('Every pool needs at least two teams');
  }
  if (courtIds.length < LIMITS.minCourts || courtIds.length > LIMITS.maxCourts) {
    throw new RangeError(`Court count must be ${LIMITS.minCourts}–${LIMITS.maxCourts}`);
  }
  const poolIds = pools.map((p) => p.id);
  if (
    new Set(teamIds).size !== teamIds.length ||
    new Set(courtIds).size !== courtIds.length ||
    new Set(poolIds).size !== poolIds.length
  ) {
    throw new RangeError('Team, pool and court ids must be unique');
  }
  const minutes: [string, number][] = [
    ['startMinute', input.startMinute],
    ['slotMinutes', input.slotMinutes],
    ['transitionMinutes', input.transitionMinutes],
    ['firstNumber', input.firstNumber ?? 1],
  ];
  for (const [name, value] of minutes) {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(`${name} must be a non-negative integer`);
    }
  }
  if (input.slotMinutes === 0) {
    throw new RangeError('slotMinutes must be positive');
  }
}
