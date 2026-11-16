import { matchRandom, type SimulationMode, simulateScore } from '../../domain/simulate';
import type { ScheduledMatch } from '../../domain/types';
import {
  canGenerateAfternoon,
  canGenerateFinal,
  createDraft,
  type Draft,
  generateAfternoon,
  generateFinal,
  generateTeams,
  type IdFactory,
  isAfternoonStale,
  isFinalMatch,
  isFinalStale,
  isScheduleStale,
  setResult,
} from './model';

// Tournament simulator for test tournaments (SPEC F15). It only fills missing scores
// through `setResult` (same validation as manual entry) and moves between phases with
// the normal `generateAfternoon` / `generateFinal`: no parallel rule, no new phase.

export type SimPhase = 'morning' | 'afternoon' | 'final';
export const SIM_PHASES: readonly SimPhase[] = ['morning', 'afternoon', 'final'];

export type SimIssue = 'not-test' | 'no-phase' | 'stale' | 'complete';

export interface SimOptions {
  mode: SimulationMode;
  seed: number;
}

export const TEST_TEAM_COUNT = 15;

/** New test tournament with fictional teams, ready for the morning draw. */
export function createTestDraft(
  name: string,
  today: string,
  newId: IdFactory,
  now: string,
  seed: number,
): Draft {
  const base: Draft = { ...createDraft(today, newId, now), name, test: true };
  return generateTeams(base, TEST_TEAM_COUNT, 'add', seed, newId).draft;
}

function phaseMatches(draft: Draft, phase: SimPhase): readonly ScheduledMatch[] | null {
  if (phase === 'morning') return draft.schedule?.matches ?? null;
  if (phase === 'afternoon') return draft.afternoon?.schedule.matches ?? null;
  return draft.final?.schedule.matches ?? null;
}

/** Matches of the phase still without a result (0 when the phase does not exist). */
export function missingInPhase(draft: Draft, phase: SimPhase): number {
  return (phaseMatches(draft, phase) ?? []).filter((m) => draft.results[m.id] === undefined).length;
}

function isStale(draft: Draft, phase: SimPhase): boolean {
  if (phase === 'morning') return isScheduleStale(draft);
  if (phase === 'afternoon') return isAfternoonStale(draft);
  return isFinalStale(draft);
}

/** Why this phase cannot be simulated now, or null. */
export function simulationIssue(draft: Draft, phase: SimPhase): SimIssue | null {
  if (!draft.test) return 'not-test';
  const matches = phaseMatches(draft, phase);
  if (matches === null) return 'no-phase';
  if (isStale(draft, phase)) return 'stale';
  if (matches.every((m) => draft.results[m.id] !== undefined)) return 'complete';
  return null;
}

/** 1 for the first team of the list, 0 for the last: "favorites" makes them win. */
function strengthOf(draft: Draft): (teamId: string) => number {
  const last = Math.max(1, draft.teams.length - 1);
  const rank = new Map(draft.teams.map((t, i) => [t.id, 1 - i / last]));
  return (teamId) => rank.get(teamId) ?? 0.5;
}

export type SimPhaseResult = { draft: Draft; filled: number } | { issue: SimIssue };

/** Fills every match of the phase that has no result yet; existing results are kept. */
export function simulatePhase(draft: Draft, phase: SimPhase, options: SimOptions): SimPhaseResult {
  const issue = simulationIssue(draft, phase);
  if (issue !== null) return { issue };
  const strength = strengthOf(draft);
  let next = draft;
  const filled: string[] = [];
  for (const m of phaseMatches(draft, phase) ?? []) {
    if (next.results[m.id] !== undefined) continue;
    const sets = simulateScore(
      {
        format: next.matchFormat,
        needsWinner: isFinalMatch(next, m.id),
        strengthA: strength(m.teamAId),
        strengthB: strength(m.teamBId),
      },
      options.mode,
      matchRandom(options.seed, m.id),
    );
    const saved = setResult(next, m.id, sets);
    if (saved === next) throw new Error(`Simulated score refused for ${m.id}`);
    next = saved;
    filled.push(m.id);
  }
  return {
    draft: { ...next, simulated: [...(draft.simulated ?? []), ...filled] },
    filled: filled.length,
  };
}

export type SimStop = 'not-test' | 'no-morning' | 'stale' | 'afternoon-blocked' | 'final-blocked';

export interface SimToEndResult {
  draft: Draft;
  /** Last phase whose scores are all filled, or null. */
  reached: SimPhase | null;
  /** Why it stopped before the end of the final, or null when the final is played. */
  stop: SimStop | null;
  filled: number;
}

/**
 * Morning scores → afternoon → afternoon scores → final → final score, through the
 * normal transitions. Never regenerates an existing phase (that would erase results):
 * a stale phase stops the run. Every intermediate state is a normal, consistent one.
 */
export function simulateToEnd(draft: Draft, options: SimOptions): SimToEndResult {
  if (!draft.test) return { draft, reached: null, stop: 'not-test', filled: 0 };
  let current = draft;
  let filled = 0;
  let reached: SimPhase | null = null;
  const done = (stop: SimStop | null): SimToEndResult => ({
    draft: current,
    reached,
    stop,
    filled,
  });

  for (const phase of SIM_PHASES) {
    if (phase === 'morning' && current.schedule === null) return done('no-morning');
    if (phase === 'afternoon' && current.afternoon === null) {
      if (!canGenerateAfternoon(current)) return done('afternoon-blocked');
      current = generateAfternoon(current);
    }
    if (phase === 'final' && current.final === null) {
      if (!canGenerateFinal(current)) return done('final-blocked');
      current = generateFinal(current);
    }
    const result = simulatePhase(current, phase, options);
    if ('issue' in result) {
      if (result.issue !== 'complete') return done('stale');
    } else {
      current = result.draft;
      filled += result.filled;
    }
    reached = phase;
  }
  return done(null);
}

/** Removes only the simulated results; results typed by hand stay. */
export function resetSimulated(draft: Draft): { draft: Draft; removed: number } {
  const ids = new Set(draft.simulated ?? []);
  const results = Object.fromEntries(Object.entries(draft.results).filter(([id]) => !ids.has(id)));
  const removed = Object.keys(draft.results).length - Object.keys(results).length;
  return { draft: { ...draft, results, simulated: [] }, removed };
}
