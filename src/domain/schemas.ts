import { z } from 'zod';
import { suggestSlotMinutes } from './format';
import { LIMITS } from './limits';
import { normalizeName } from './names';
import { validateSchedule } from './schedule/validate';
import { MAX_SET_POINTS, scoreIssue } from './scores';
import { isValidTime, MINUTES_PER_DAY, parseTime } from './time';
import type { PoolInput, ScheduledMatch } from './types';

// Published tournament document (ARCHITECTURE.md §6). Validated by the client before
// publishing and by the server before every write: a forged schedule or score is
// rejected.

const MAX_MATCHES = 600;
const MAX_LUNCH_MINUTES = 180;

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,24}$/, 'invalid id');
const label = (max: number) => z.string().trim().min(1).max(max);
const int = (min: number, max: number) => z.number().int().min(min).max(max);
const timeSchema = z.string().refine(isValidTime, 'invalid time');

export const teamSchema = z.object({ id: idSchema, name: label(LIMITS.teamNameMax) });
export const courtSchema = z.object({ id: idSchema, name: label(LIMITS.courtNameMax) });

export const matchFormatSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('time'),
    setCount: int(LIMITS.minSets, LIMITS.maxSets),
    minutesPerSet: int(LIMITS.minMinutesPerSet, LIMITS.maxMinutesPerSet),
  }),
  z.object({
    kind: z.literal('points'),
    setCount: int(LIMITS.minSets, LIMITS.maxSets),
    pointsPerSet: int(LIMITS.minPointsPerSet, LIMITS.maxPointsPerSet),
    mode: z.enum(['all-sets', 'best-of']),
    decidingSetPoints: int(LIMITS.minPointsPerSet, LIMITS.maxPointsPerSet).optional(),
  }),
]);

const minute = z
  .number()
  .int()
  .min(0)
  .max(MINUTES_PER_DAY * 2);

export const scheduledMatchSchema = z.object({
  id: idSchema,
  poolId: idSchema,
  number: int(1, MAX_MATCHES),
  slot: int(0, MAX_MATCHES),
  courtId: idSchema,
  teamAId: idSchema,
  teamBId: idSchema,
  startMinute: minute,
  endMinute: minute,
});

const poolSchema = z.object({
  id: idSchema,
  teamIds: z.array(idSchema).min(2).max(LIMITS.maxTeams),
});

const phaseSchema = z.object({
  pools: z.array(poolSchema).min(1).max(LIMITS.maxTeams),
  matches: z.array(scheduledMatchSchema).min(1).max(MAX_MATCHES),
});

const setScoreSchema = z.object({ a: int(0, MAX_SET_POINTS), b: int(0, MAX_SET_POINTS) });

const docShape = z.object({
  schemaVersion: z.literal(1),
  name: label(LIMITS.tournamentNameMax),
  date: z.iso.date(),
  location: z.string().trim().max(LIMITS.locationMax),
  sport: z.literal('volleyball'),
  matchFormat: matchFormatSchema,
  startTime: timeSchema,
  transitionMinutes: int(0, LIMITS.maxTransitionMinutes),
  lunchMinutes: int(0, MAX_LUNCH_MINUTES),
  courts: z.array(courtSchema).min(LIMITS.minCourts).max(LIMITS.maxCourts),
  teams: z.array(teamSchema).min(LIMITS.minTeams).max(LIMITS.maxTeams),
  morning: phaseSchema,
  afternoon: phaseSchema.nullable(),
  final: phaseSchema.nullable(),
  results: z.record(
    idSchema,
    z
      .array(setScoreSchema)
      .min(1)
      .max(LIMITS.maxSets + 1),
  ),
});

export const tournamentDocSchema = docShape.superRefine((doc, ctx) => {
  for (const { message, path } of docIssues(doc)) {
    ctx.addIssue({ code: 'custom', message, path });
  }
});

export type TournamentDoc = z.infer<typeof tournamentDocSchema>;
export type PhaseDoc = z.infer<typeof phaseSchema>;

interface DocIssue {
  message: string;
  path: (string | number)[];
}

/** Cross-field checks: unique names and ids, consistent phases, valid scores. */
function docIssues(doc: z.infer<typeof docShape>): DocIssue[] {
  const issues: DocIssue[] = [];
  const issue = (message: string, path: (string | number)[]) => issues.push({ message, path });

  const names = doc.teams.map((t) => normalizeName(t.name));
  if (new Set(names).size !== names.length) issue('duplicate team name', ['teams']);
  const teamIds = doc.teams.map((t) => t.id);
  if (new Set(teamIds).size !== teamIds.length) issue('duplicate team id', ['teams']);
  const courtIds = doc.courts.map((c) => c.id);
  if (new Set(courtIds).size !== courtIds.length) issue('duplicate court id', ['courts']);
  if (doc.final && !doc.afternoon) issue('final without afternoon', ['final']);

  // Field-level errors are reported by the shape; timings cannot be checked without them.
  if (!isValidTime(doc.startTime)) return issues;
  const slotMinutes = suggestSlotMinutes(doc.matchFormat);
  const phases: { key: 'morning' | 'afternoon' | 'final'; phase: PhaseDoc }[] = [];
  let startMinute = parseTime(doc.startTime);
  let firstNumber = 1;
  for (const key of ['morning', 'afternoon', 'final'] as const) {
    const phase = doc[key];
    if (!phase) break;
    const isFinal = key === 'final';
    if (isFinal && (phase.pools.length !== 1 || phase.pools[0]?.teamIds.length !== 2)) {
      issue('final must be one match', [key]);
    }
    if (!isFinal && !coversAllTeams(phase.pools, teamIds)) {
      issue('pools must contain every team once', [key, 'pools']);
    }
    const errors = validateSchedule({
      pools: phase.pools,
      courtIds: isFinal ? courtIds.slice(0, 1) : courtIds,
      startMinute,
      slotMinutes,
      transitionMinutes: doc.transitionMinutes,
      firstNumber,
      matches: phase.matches,
    });
    for (const error of errors) issue(`schedule: ${error.code}`, [key, 'matches']);
    phases.push({ key, phase });
    const end = endOf(phase.matches);
    startMinute = end + (key === 'morning' ? doc.lunchMinutes : doc.transitionMinutes);
    firstNumber += phase.matches.length;
  }

  const finalIds = new Set(doc.final?.matches.map((m) => m.id) ?? []);
  const matchIds = new Set(phases.flatMap(({ phase }) => phase.matches.map((m) => m.id)));
  for (const [matchId, sets] of Object.entries(doc.results)) {
    if (!matchIds.has(matchId)) issue('score for unknown match', ['results', matchId]);
    else if (scoreIssue(sets, doc.matchFormat, finalIds.has(matchId)) !== null) {
      issue('invalid score', ['results', matchId]);
    }
  }
  return issues;
}

function coversAllTeams(pools: readonly PoolInput[], teamIds: readonly string[]): boolean {
  const inPools = pools.flatMap((p) => p.teamIds);
  return inPools.length === teamIds.length && new Set(inPools).size === teamIds.length
    ? teamIds.every((id) => inPools.includes(id))
    : false;
}

function endOf(matches: readonly ScheduledMatch[]): number {
  return matches.reduce((end, m) => Math.max(end, m.endMinute), 0);
}

export { normalizeName };
