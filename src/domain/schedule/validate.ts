import type { ScheduledMatch } from '../types';

export interface ScheduleShape {
  teamIds: readonly string[];
  courtIds: readonly string[];
  startMinute: number;
  slotMinutes: number;
  transitionMinutes: number;
  matches: readonly ScheduledMatch[];
}

export type ScheduleError =
  | { code: 'unknown-team'; matchId: string }
  | { code: 'unknown-court'; matchId: string }
  | { code: 'self-match'; matchId: string }
  | { code: 'duplicate-pair'; matchId: string }
  | { code: 'missing-pairs'; count: number }
  | { code: 'team-conflict'; slot: number; teamId: string }
  | { code: 'court-conflict'; slot: number; courtId: string }
  | { code: 'bad-time'; matchId: string }
  | { code: 'bad-numbering'; matchId: string }
  | { code: 'duplicate-id'; matchId: string };

/**
 * Checks the invariants of a published schedule (SPEC F4/F5). Used by the tests and
 * by the server before storing a tournament, so a forged schedule is rejected.
 */
export function validateSchedule(shape: ScheduleShape): ScheduleError[] {
  const errors: ScheduleError[] = [];
  const teams = new Set(shape.teamIds);
  const courts = new Set(shape.courtIds);
  const pairs = new Set<string>();
  const ids = new Set<string>();
  const teamSlots = new Set<string>();
  const courtSlots = new Set<string>();
  const step = shape.slotMinutes + shape.transitionMinutes;

  shape.matches.forEach((m, index) => {
    if (ids.has(m.id)) errors.push({ code: 'duplicate-id', matchId: m.id });
    ids.add(m.id);

    if (!teams.has(m.teamAId) || !teams.has(m.teamBId)) {
      errors.push({ code: 'unknown-team', matchId: m.id });
    }
    if (!courts.has(m.courtId)) errors.push({ code: 'unknown-court', matchId: m.id });
    if (m.teamAId === m.teamBId) errors.push({ code: 'self-match', matchId: m.id });

    const pairKey = [m.teamAId, m.teamBId].sort().join('|');
    if (pairs.has(pairKey)) errors.push({ code: 'duplicate-pair', matchId: m.id });
    pairs.add(pairKey);

    for (const teamId of [m.teamAId, m.teamBId]) {
      const key = `${m.slot}|${teamId}`;
      if (teamSlots.has(key)) errors.push({ code: 'team-conflict', slot: m.slot, teamId });
      teamSlots.add(key);
    }
    const courtKey = `${m.slot}|${m.courtId}`;
    if (courtSlots.has(courtKey)) {
      errors.push({ code: 'court-conflict', slot: m.slot, courtId: m.courtId });
    }
    courtSlots.add(courtKey);

    const expectedStart = shape.startMinute + m.slot * step;
    if (
      !Number.isInteger(m.slot) ||
      m.slot < 0 ||
      m.startMinute !== expectedStart ||
      m.endMinute !== expectedStart + shape.slotMinutes
    ) {
      errors.push({ code: 'bad-time', matchId: m.id });
    }

    const previous = shape.matches[index - 1];
    if (m.number !== index + 1 || (previous !== undefined && previous.slot > m.slot)) {
      errors.push({ code: 'bad-numbering', matchId: m.id });
    }
  });

  const n = shape.teamIds.length;
  const expectedPairs = (n * (n - 1)) / 2;
  if (pairs.size < expectedPairs) {
    errors.push({ code: 'missing-pairs', count: expectedPairs - pairs.size });
  }
  return errors;
}
