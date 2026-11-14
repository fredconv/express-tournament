import { defaultCourtColor, isCourtColor } from '../../domain/courtColors';
import { suggestSlotMinutes } from '../../domain/format';
import { LIMITS } from '../../domain/limits';
import { normalizeName } from '../../domain/names';
import { drawPools, lockIssues, type PoolLocks, poolSizes } from '../../domain/pools';
import { schedulePools } from '../../domain/schedule/generate';
import {
  forfeitBy,
  isForfeit,
  type MatchResult,
  type SetScore,
  scoreIssue,
} from '../../domain/scores';
import {
  isPoolComplete,
  levelPools,
  overallRanking,
  poolStandings,
  type Results,
} from '../../domain/standings';
import { fictionalTeamNames } from '../../domain/teamNames';
import { isValidTime, parseTime } from '../../domain/time';
import type {
  MatchFormat,
  PoolInput,
  PoolScheduleInput,
  ScheduledMatch,
  ScheduleResult,
} from '../../domain/types';

// Local, unpublished tournament being edited on this device (SPEC F1, decision D3).
// Pure functions only: React components call these, tests exercise them directly.

export interface NamedItem {
  id: string;
  name: string;
}

export interface Court extends NamedItem {
  /** `#rrggbb`; missing on drafts created before court colors (palette by position). */
  color?: string | undefined;
}

export interface Draft {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  location: string;
  matchFormat: MatchFormat;
  /** HH:mm */
  startTime: string;
  transitionMinutes: number;
  avoidBackToBack: boolean;
  /** HH:mm or '' when not set. */
  targetEndTime: string;
  /** Fixed break between the end of the morning and the afternoon. */
  lunchMinutes: number;
  courts: Court[];
  teams: NamedItem[];
  /** Teams locked in a morning pool (team id → pool index); missing on older drafts. */
  poolLocks?: Record<string, number> | undefined;
  /** Seed of the morning pool draw. */
  drawSeed: number | null;
  /** Morning pools, in draw order. */
  pools: PoolInput[];
  /** Morning schedule. */
  schedule: ScheduleResult | null;
  /** Inputs the morning was generated from; differs from the current inputs when stale. */
  scheduleKey: string | null;
  afternoon: Phase | null;
  final: Phase | null;
  /** Scores by match id, all phases. */
  results: Record<string, MatchResult>;
  /** Teams that left during the day: their remaining matches are forfeits (SPEC F11). */
  withdrawn?: string[] | undefined;
  /** Set once published: public id, server version and fingerprint of what was sent. */
  publication: Publication | null;
  updatedAt: string;
}

export interface Publication {
  id: string;
  version: number;
  key: string;
}

/** A generated afternoon or final, with the inputs it was built from. */
export interface Phase {
  pools: PoolInput[];
  schedule: ScheduleResult;
  key: string;
}

export type IdFactory = (prefix: string) => string;

export const DEFAULT_FORMAT: MatchFormat = { kind: 'time', setCount: 2, minutesPerSet: 10 };
export const DEFAULT_LUNCH_MINUTES = 60;
export const MAX_LUNCH_MINUTES = 180;

export function createDraft(today: string, newId: IdFactory, now: string): Draft {
  return {
    id: newId('d'),
    name: '',
    date: today,
    location: '',
    matchFormat: DEFAULT_FORMAT,
    startTime: '09:00',
    transitionMinutes: 5,
    avoidBackToBack: true,
    targetEndTime: '',
    lunchMinutes: DEFAULT_LUNCH_MINUTES,
    courts: [
      { id: newId('c'), name: 'Terrain 1', color: defaultCourtColor(0) },
      { id: newId('c'), name: 'Terrain 2', color: defaultCourtColor(1) },
    ],
    teams: [],
    drawSeed: null,
    pools: [],
    schedule: null,
    scheduleKey: null,
    afternoon: null,
    final: null,
    results: {},
    publication: null,
    updatedAt: now,
  };
}

// ---------- Teams (SPEC F2) ----------

export type TeamIssue = 'empty' | 'too-long' | 'duplicate' | 'too-many';

export interface AddTeamsResult {
  draft: Draft;
  added: number;
  rejected: { name: string; issue: TeamIssue }[];
}

/** Adds one team per non-empty line (CA2.1); duplicates and overflow are reported. */
export function addTeams(draft: Draft, text: string, newId: IdFactory): AddTeamsResult {
  const teams = [...draft.teams];
  const rejected: AddTeamsResult['rejected'] = [];
  for (const line of text.split(/\r?\n/)) {
    const name = line.trim().replace(/\s+/g, ' ');
    if (name === '') continue;
    const issue = teamNameIssue(teams, name);
    if (issue) {
      rejected.push({ name, issue });
    } else if (teams.length >= LIMITS.maxTeams) {
      rejected.push({ name, issue: 'too-many' });
    } else {
      teams.push({ id: newId('t'), name });
    }
  }
  return { draft: { ...draft, teams }, added: teams.length - draft.teams.length, rejected };
}

/** Room left for teams in this tournament. */
export function freeTeamSlots(draft: Draft): number {
  return Math.max(0, LIMITS.maxTeams - draft.teams.length);
}

/**
 * Fictional teams (SPEC F2): `add` keeps the current teams, `replace` starts from an
 * empty list (the caller confirms first). Never saved to the library.
 */
export function generateTeams(
  draft: Draft,
  count: number,
  mode: 'add' | 'replace',
  seed: number,
  newId: IdFactory,
): AddTeamsResult {
  const base: Draft =
    mode === 'replace' ? { ...draft, teams: [], poolLocks: {}, withdrawn: [] } : draft;
  const wanted = Math.min(Math.max(0, Math.floor(count)), freeTeamSlots(base));
  const names = fictionalTeamNames(
    wanted,
    base.teams.map((t) => t.name),
    seed,
  );
  return addTeams(base, names.join('\n'), newId);
}

export function teamNameIssue(
  teams: readonly NamedItem[],
  name: string,
  exceptId?: string,
): TeamIssue | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'empty';
  if (trimmed.length > LIMITS.teamNameMax) return 'too-long';
  const key = normalizeName(trimmed);
  if (teams.some((t) => t.id !== exceptId && normalizeName(t.name) === key)) return 'duplicate';
  return null;
}

export function renameTeam(draft: Draft, id: string, name: string): Draft {
  const clean = name.trim().replace(/\s+/g, ' ');
  return { ...draft, teams: draft.teams.map((t) => (t.id === id ? { ...t, name: clean } : t)) };
}

export function removeTeam(draft: Draft, id: string): Draft {
  const { [id]: _removed, ...poolLocks } = locksOf(draft);
  return { ...draft, teams: draft.teams.filter((t) => t.id !== id), poolLocks };
}

// ---------- Pool locks (SPEC F10) ----------

export function locksOf(draft: Draft): PoolLocks {
  return draft.poolLocks ?? {};
}

/** Number of morning pools for the current team count. */
export function morningPoolCount(draft: Draft): number {
  return poolSizes(draft.teams.length).length;
}

/** Locks a team in a pool (0 = A), or back to random with `null`. */
export function setPoolLock(draft: Draft, teamId: string, poolIndex: number | null): Draft {
  const { [teamId]: _previous, ...others } = locksOf(draft);
  return { ...draft, poolLocks: poolIndex === null ? others : { ...others, [teamId]: poolIndex } };
}

export function poolLockIssues(draft: Draft) {
  return lockIssues(
    draft.teams.map((t) => t.id),
    locksOf(draft),
  );
}

// ---------- Courts and settings (SPEC F3) ----------

export function setCourtCount(draft: Draft, count: number, newId: IdFactory): Draft {
  const target = Math.min(LIMITS.maxCourts, Math.max(LIMITS.minCourts, count));
  const courts = draft.courts.slice(0, target);
  while (courts.length < target) {
    courts.push({
      id: newId('c'),
      name: `Terrain ${courts.length + 1}`,
      color: defaultCourtColor(courts.length),
    });
  }
  return { ...draft, courts };
}

/** Only valid `#rrggbb` colors are stored (SPEC F13). */
export function setCourtColor(draft: Draft, id: string, color: string): Draft {
  if (!isCourtColor(color)) return draft;
  return { ...draft, courts: draft.courts.map((c) => (c.id === id ? { ...c, color } : c)) };
}

export function renameCourt(draft: Draft, id: string, name: string): Draft {
  return { ...draft, courts: draft.courts.map((c) => (c.id === id ? { ...c, name } : c)) };
}

export function setMatchFormat(draft: Draft, matchFormat: MatchFormat): Draft {
  return { ...draft, matchFormat };
}

/** Time reserved on a court per match: always computed from the format, never edited (D1). */
export function matchMinutesOf(draft: Draft): number {
  return suggestSlotMinutes(draft.matchFormat);
}

// ---------- Validation and generation (SPEC F4, CA2.3) ----------

export type DraftIssue =
  | 'name-missing'
  | 'date-missing'
  | 'not-enough-teams'
  | 'invalid-start-time'
  | 'invalid-target-end'
  | 'invalid-slot-minutes'
  | 'invalid-transition'
  | 'invalid-lunch'
  | 'pool-locks'
  | 'court-name-missing';

/** Issues that block schedule generation, in display order. */
export function draftIssues(draft: Draft): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (draft.name.trim() === '') issues.push('name-missing');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) issues.push('date-missing');
  if (draft.teams.length < LIMITS.minTeams) issues.push('not-enough-teams');
  if (!isValidTime(draft.startTime)) issues.push('invalid-start-time');
  if (draft.targetEndTime !== '' && !isValidTime(draft.targetEndTime)) {
    issues.push('invalid-target-end');
  }
  if (!isIntIn(matchMinutesOf(draft), LIMITS.minSlotMinutes, LIMITS.maxSlotMinutes)) {
    issues.push('invalid-slot-minutes');
  }
  if (!isIntIn(draft.transitionMinutes, 0, LIMITS.maxTransitionMinutes)) {
    issues.push('invalid-transition');
  }
  if (!isIntIn(draft.lunchMinutes, 0, MAX_LUNCH_MINUTES)) issues.push('invalid-lunch');
  if (poolLockIssues(draft).length > 0) issues.push('pool-locks');
  if (draft.courts.some((c) => c.name.trim() === '')) issues.push('court-name-missing');
  return issues;
}

/** Issues that block generation (name and date only block publishing). */
export function blockingIssues(draft: Draft): DraftIssue[] {
  return draftIssues(draft).filter((i) => i !== 'name-missing' && i !== 'date-missing');
}

type Timing = Omit<PoolScheduleInput, 'pools' | 'startMinute' | 'idPrefix' | 'firstNumber'>;

/** Courts and durations shared by every phase; only valid when `blockingIssues` is empty. */
export function timingOf(draft: Draft): Timing {
  const timing: Timing = {
    courtIds: draft.courts.map((c) => c.id),
    slotMinutes: matchMinutesOf(draft),
    transitionMinutes: draft.transitionMinutes,
    avoidBackToBack: draft.avoidBackToBack,
  };
  return draft.targetEndTime === ''
    ? timing
    : { ...timing, targetEndMinute: parseTime(draft.targetEndTime) };
}

/** The target end only drives a warning (`exceedsTargetEnd`), so it is not part of the key. */
function scheduleKeyOf(draft: Draft): string {
  const { targetEndMinute: _warningOnly, ...timing } = timingOf(draft);
  return JSON.stringify({
    teams: draft.teams.map((t) => t.id),
    start: draft.startTime,
    lunch: draft.lunchMinutes,
    seed: draft.drawSeed,
    locks: draft.teams.map((t) => locksOf(draft)[t.id] ?? null),
    ...timing,
  });
}

/** End of the phase when it is later than the current target end, else null. */
export function exceedsTargetEnd(draft: Draft, schedule: ScheduleResult): number | null {
  if (!isValidTime(draft.targetEndTime)) return null;
  return schedule.endMinute > parseTime(draft.targetEndTime) ? schedule.endMinute : null;
}

/**
 * Draws the morning pools with `seed` and plans them (SPEC F10). Clears every score
 * and later phase: the caller confirms first when scores exist.
 */
export function generate(draft: Draft, seed: number): Draft {
  if (blockingIssues(draft).length > 0) throw new Error('Draft is not ready for generation');
  const pools = drawPools(
    draft.teams.map((t) => t.id),
    seed,
    locksOf(draft),
  );
  const schedule = schedulePools({
    ...timingOf(draft),
    pools,
    startMinute: parseTime(draft.startTime),
  });
  const next = { ...draft, drawSeed: seed, pools, schedule, afternoon: null, final: null };
  return { ...next, results: {}, scheduleKey: scheduleKeyOf(next) };
}

/** CA2.3: any change to teams or settings after generation marks the schedule stale. */
export function isScheduleStale(draft: Draft): boolean {
  if (draft.schedule === null) return false;
  return blockingIssues(draft).length > 0 || draft.scheduleKey !== scheduleKeyOf(draft);
}

/** Every generated match of the day, in order: morning, afternoon, final. */
export function dayMatches(draft: Draft): ScheduledMatch[] {
  return [
    ...(draft.schedule?.matches ?? []),
    ...(draft.afternoon?.schedule.matches ?? []),
    ...(draft.final?.schedule.matches ?? []),
  ];
}

/** Matches shown when the schedule is filtered on one team (SPEC F6). */
export function teamMatchCount(draft: Draft, teamId: string): number {
  return dayMatches(draft).filter((m) => m.teamAId === teamId || m.teamBId === teamId).length;
}

export function hasResults(draft: Draft): boolean {
  return Object.keys(draft.results).length > 0;
}

// ---------- Scores (SPEC F11) ----------

export function isFinalMatch(draft: Draft, matchId: string): boolean {
  return draft.final?.schedule.matches.some((m) => m.id === matchId) ?? false;
}

/** Stores a valid score, or clears it with `null`. Invalid scores are ignored. */
export function setResult(draft: Draft, matchId: string, sets: SetScore[] | null): Draft {
  const results = { ...draft.results };
  if (sets === null) {
    delete results[matchId];
  } else {
    if (scoreIssue(sets, draft.matchFormat, isFinalMatch(draft, matchId)) !== null) return draft;
    results[matchId] = sets;
  }
  return { ...draft, results };
}

/** Forfeit by one side of a match (`null` clears the result). */
export function setForfeit(draft: Draft, matchId: string, side: 'a' | 'b' | null): Draft {
  if (side === null) return setResult(draft, matchId, null);
  return { ...draft, results: { ...draft.results, [matchId]: forfeitBy(side, draft.matchFormat) } };
}

export function withdrawnOf(draft: Draft): readonly string[] {
  return draft.withdrawn ?? [];
}

/**
 * A team leaves the tournament: every match of it still without a result becomes a
 * forfeit by that team; later phases are built without it. Played matches are kept.
 */
export function withdrawTeam(draft: Draft, teamId: string): Draft {
  if (withdrawnOf(draft).includes(teamId)) return draft;
  const results = { ...draft.results };
  for (const m of dayMatches(draft)) {
    if (results[m.id] !== undefined) continue;
    if (m.teamAId === teamId) results[m.id] = forfeitBy('a', draft.matchFormat);
    else if (m.teamBId === teamId) results[m.id] = forfeitBy('b', draft.matchFormat);
  }
  return { ...draft, results, withdrawn: [...withdrawnOf(draft), teamId] };
}

/** Undoes a withdrawal: the team is back and its forfeits are cleared (to be played). */
export function reinstateTeam(draft: Draft, teamId: string): Draft {
  const results = { ...draft.results };
  for (const m of dayMatches(draft)) {
    const result = results[m.id];
    if (!result || !isForfeit(result)) continue;
    const forfeiter = result.forfeit === 'a' ? m.teamAId : m.teamBId;
    if (forfeiter === teamId) delete results[m.id];
  }
  return { ...draft, results, withdrawn: withdrawnOf(draft).filter((t) => t !== teamId) };
}

function scoresOf(matches: readonly ScheduledMatch[], results: Results) {
  return matches.map((m) => [m.id, results[m.id] ?? null]);
}

export function missingScores(matches: readonly ScheduledMatch[], results: Results): number {
  return matches.filter((m) => results[m.id] === undefined).length;
}

// ---------- Afternoon and final (SPEC F12) ----------

function afternoonKeyOf(draft: Draft): string {
  return JSON.stringify([
    draft.scheduleKey,
    scoresOf(draft.schedule?.matches ?? [], draft.results),
  ]);
}

export function canGenerateAfternoon(draft: Draft): boolean {
  return (
    draft.schedule !== null &&
    !isScheduleStale(draft) &&
    missingScores(draft.schedule.matches, draft.results) === 0 &&
    activeTeams(draft).length >= LIMITS.minTeams
  );
}

function activeTeams(draft: Draft): string[] {
  const gone = new Set(withdrawnOf(draft));
  return draft.teams.map((t) => t.id).filter((t) => !gone.has(t));
}

/** Level pools from the morning ranking, after the lunch break. Clears afternoon scores. */
export function generateAfternoon(draft: Draft): Draft {
  if (!canGenerateAfternoon(draft) || draft.schedule === null) {
    throw new Error('Morning is not complete');
  }
  const morning = draft.schedule;
  const gone = new Set(withdrawnOf(draft));
  const ranking = overallRanking(draft.pools, morning.matches, draft.results);
  const pools = levelPools(ranking.filter((t) => !gone.has(t)));
  const schedule = schedulePools({
    ...timingOf(draft),
    pools,
    startMinute: morning.endMinute + draft.lunchMinutes,
    idPrefix: 'a',
    firstNumber: morning.matches.length + 1,
  });
  return {
    ...draft,
    afternoon: { pools, schedule, key: afternoonKeyOf(draft) },
    final: null,
    results: withoutPhases(draft.results, ['a', 'f']),
  };
}

/**
 * Stale when the morning changed, or when a team left out of the afternoon (withdrawn
 * at the time) has been reinstated. A withdrawal during the afternoon is not: its
 * matches become forfeits and the afternoon goes on.
 */
export function isAfternoonStale(draft: Draft): boolean {
  const afternoon = draft.afternoon;
  if (afternoon === null) return false;
  const inAfternoon = new Set(afternoon.pools.flatMap((p) => p.teamIds));
  const gone = new Set(withdrawnOf(draft));
  const reinstated = draft.teams.some((t) => !inAfternoon.has(t.id) && !gone.has(t.id));
  return reinstated || afternoon.key !== afternoonKeyOf(draft);
}

function topPool(draft: Draft): PoolInput | undefined {
  return draft.afternoon?.pools[0];
}

function finalKeyOf(draft: Draft): string {
  const afternoon = draft.afternoon;
  const pool = topPool(draft);
  if (!afternoon || !pool) return '';
  const matches = afternoon.schedule.matches.filter((m) => m.poolId === pool.id);
  return JSON.stringify([afternoon.key, scoresOf(matches, draft.results)]);
}

export function canGenerateFinal(draft: Draft): boolean {
  const pool = topPool(draft);
  return (
    draft.afternoon !== null &&
    pool !== undefined &&
    !isAfternoonStale(draft) &&
    isPoolComplete(pool.id, draft.afternoon.schedule.matches, draft.results)
  );
}

/** D13: first against second of the top afternoon pool, on the first court, after the afternoon. */
export function generateFinal(draft: Draft): Draft {
  const afternoon = draft.afternoon;
  const pool = topPool(draft);
  if (!canGenerateFinal(draft) || !afternoon || !pool) throw new Error('Top pool not complete');
  const gone = new Set(withdrawnOf(draft));
  const [first, second] = poolStandings(pool, afternoon.schedule.matches, draft.results).filter(
    (row) => !gone.has(row.teamId),
  );
  if (!first || !second) throw new Error('Top pool needs two teams');
  const pools = [{ id: 'F', teamIds: [first.teamId, second.teamId] }];
  const { courtIds, ...timing } = timingOf(draft);
  const schedule = schedulePools({
    ...timing,
    courtIds: courtIds.slice(0, 1),
    pools,
    startMinute: afternoon.schedule.endMinute + draft.transitionMinutes,
    idPrefix: 'f',
    firstNumber: (draft.schedule?.matches.length ?? 0) + afternoon.schedule.matches.length + 1,
  });
  return {
    ...draft,
    final: { pools, schedule, key: finalKeyOf(draft) },
    results: withoutPhases(draft.results, ['f']),
  };
}

export function isFinalStale(draft: Draft): boolean {
  return draft.final !== null && (isAfternoonStale(draft) || draft.final.key !== finalKeyOf(draft));
}

function withoutPhases(results: Results, prefixes: readonly string[]): Record<string, MatchResult> {
  return Object.fromEntries(
    Object.entries(results).filter(([id]) => !prefixes.some((p) => id.startsWith(p))),
  );
}

function isIntIn(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}
