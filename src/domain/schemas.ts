import { z } from 'zod';
import { LIMITS } from './limits';
import { validateSchedule } from './schedule/validate';
import { MINUTES_PER_DAY } from './time';

// Published tournament document (ARCHITECTURE.md §6). Validated by the client before
// publishing and by the server before every write.

const MAX_MATCHES = (LIMITS.maxTeams * (LIMITS.maxTeams - 1)) / 2;

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,24}$/, 'invalid id');
const label = (max: number) => z.string().trim().min(1).max(max);
const int = (min: number, max: number) => z.number().int().min(min).max(max);

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

export const scheduleSettingsSchema = z.object({
  startMinute: int(0, MINUTES_PER_DAY - 1),
  slotMinutes: int(LIMITS.minSlotMinutes, LIMITS.maxSlotMinutes),
  transitionMinutes: int(0, LIMITS.maxTransitionMinutes),
  avoidBackToBack: z.boolean(),
  targetEndMinute: int(0, MINUTES_PER_DAY - 1).optional(),
});

export const scheduledMatchSchema = z.object({
  id: idSchema,
  number: int(1, MAX_MATCHES),
  slot: int(0, MAX_MATCHES),
  courtId: idSchema,
  poolId: idSchema,
  teamAId: idSchema,
  teamBId: idSchema,
  startMinute: z.number().int().min(0),
  endMinute: z.number().int().min(0),
});

export const scheduleWarningSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('back-to-back'),
    slot: z.number().int().min(0),
    teamIds: z.array(idSchema).max(LIMITS.maxTeams),
  }),
  z.object({ kind: z.literal('exceeds-target-end'), endMinute: z.number().int().min(0) }),
  z.object({ kind: z.literal('past-midnight'), endMinute: z.number().int().min(0) }),
]);

const isoDateSchema = z.iso.date();

export const tournamentDocSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: label(LIMITS.tournamentNameMax),
    date: isoDateSchema,
    location: z.string().trim().max(LIMITS.locationMax).optional(),
    sport: z.literal('volleyball'),
    matchFormat: matchFormatSchema,
    schedule: scheduleSettingsSchema,
    courts: z.array(courtSchema).min(LIMITS.minCourts).max(LIMITS.maxCourts),
    teams: z.array(teamSchema).min(LIMITS.minTeams).max(LIMITS.maxTeams),
    matches: z.array(scheduledMatchSchema).max(MAX_MATCHES),
    warnings: z.array(scheduleWarningSchema).max(MAX_MATCHES * 2),
  })
  .superRefine((doc, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: 'custom', message, path });

    const names = doc.teams.map((t) => normalizeName(t.name));
    if (new Set(names).size !== names.length) issue('duplicate team name', ['teams']);
    if (new Set(doc.teams.map((t) => t.id)).size !== doc.teams.length) {
      issue('duplicate team id', ['teams']);
    }
    if (new Set(doc.courts.map((c) => c.id)).size !== doc.courts.length) {
      issue('duplicate court id', ['courts']);
    }

    const errors = validateSchedule({
      pools: [{ id: 'p1', teamIds: doc.teams.map((t) => t.id) }],
      courtIds: doc.courts.map((c) => c.id),
      startMinute: doc.schedule.startMinute,
      slotMinutes: doc.schedule.slotMinutes,
      transitionMinutes: doc.schedule.transitionMinutes,
      matches: doc.matches,
    });
    for (const error of errors) issue(`schedule: ${error.code}`, ['matches']);
  });

export type TournamentDoc = z.infer<typeof tournamentDocSchema>;

/** Team names are unique ignoring case and surrounding/multiple spaces (SPEC F2). */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
}
