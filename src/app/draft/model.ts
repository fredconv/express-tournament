import { suggestSlotMinutes } from '../../domain/format';
import { LIMITS } from '../../domain/limits';
import { generateSchedule } from '../../domain/schedule/generate';
import { normalizeName } from '../../domain/schemas';
import { isValidTime, parseTime } from '../../domain/time';
import type { MatchFormat, ScheduleInput, ScheduleResult } from '../../domain/types';

// Local, unpublished tournament being edited on this device (SPEC F1, decision D3).
// Pure functions only: React components call these, tests exercise them directly.

export interface NamedItem {
  id: string;
  name: string;
}

export interface Draft {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  location: string;
  matchFormat: MatchFormat;
  /** Slot length; follows the format suggestion unless `slotMinutesCustom`. */
  slotMinutes: number;
  slotMinutesCustom: boolean;
  /** HH:mm */
  startTime: string;
  transitionMinutes: number;
  avoidBackToBack: boolean;
  /** HH:mm or '' when not set. */
  targetEndTime: string;
  courts: NamedItem[];
  teams: NamedItem[];
  schedule: ScheduleResult | null;
  /** Inputs the schedule was generated from; differs from the current inputs when stale. */
  scheduleKey: string | null;
  updatedAt: string;
}

export type IdFactory = (prefix: string) => string;

export const DEFAULT_FORMAT: MatchFormat = { kind: 'time', setCount: 2, minutesPerSet: 10 };

export function createDraft(today: string, newId: IdFactory, now: string): Draft {
  return {
    id: newId('d'),
    name: '',
    date: today,
    location: '',
    matchFormat: DEFAULT_FORMAT,
    slotMinutes: suggestSlotMinutes(DEFAULT_FORMAT),
    slotMinutesCustom: false,
    startTime: '09:00',
    transitionMinutes: 5,
    avoidBackToBack: true,
    targetEndTime: '',
    courts: [
      { id: newId('c'), name: 'Terrain 1' },
      { id: newId('c'), name: 'Terrain 2' },
    ],
    teams: [],
    schedule: null,
    scheduleKey: null,
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
  return { ...draft, teams: draft.teams.filter((t) => t.id !== id) };
}

// ---------- Courts and settings (SPEC F3) ----------

export function setCourtCount(draft: Draft, count: number, newId: IdFactory): Draft {
  const target = Math.min(LIMITS.maxCourts, Math.max(LIMITS.minCourts, count));
  const courts = draft.courts.slice(0, target);
  while (courts.length < target) {
    courts.push({ id: newId('c'), name: `Terrain ${courts.length + 1}` });
  }
  return { ...draft, courts };
}

export function renameCourt(draft: Draft, id: string, name: string): Draft {
  return { ...draft, courts: draft.courts.map((c) => (c.id === id ? { ...c, name } : c)) };
}

/** Changing the format refreshes the slot length unless the organizer set it by hand. */
export function setMatchFormat(draft: Draft, matchFormat: MatchFormat): Draft {
  return {
    ...draft,
    matchFormat,
    slotMinutes: draft.slotMinutesCustom ? draft.slotMinutes : suggestSlotMinutes(matchFormat),
  };
}

export function setSlotMinutes(draft: Draft, minutes: number): Draft {
  return { ...draft, slotMinutes: minutes, slotMinutesCustom: true };
}

export function resetSlotMinutes(draft: Draft): Draft {
  return {
    ...draft,
    slotMinutes: suggestSlotMinutes(draft.matchFormat),
    slotMinutesCustom: false,
  };
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
  if (!isIntIn(draft.slotMinutes, LIMITS.minSlotMinutes, LIMITS.maxSlotMinutes)) {
    issues.push('invalid-slot-minutes');
  }
  if (!isIntIn(draft.transitionMinutes, 0, LIMITS.maxTransitionMinutes)) {
    issues.push('invalid-transition');
  }
  if (draft.courts.some((c) => c.name.trim() === '')) issues.push('court-name-missing');
  return issues;
}

/** Engine input for the current draft; only valid when `draftIssues` is empty. */
export function scheduleInputOf(draft: Draft): ScheduleInput {
  const input: ScheduleInput = {
    teamIds: draft.teams.map((t) => t.id),
    courtIds: draft.courts.map((c) => c.id),
    startMinute: parseTime(draft.startTime),
    slotMinutes: draft.slotMinutes,
    transitionMinutes: draft.transitionMinutes,
    avoidBackToBack: draft.avoidBackToBack,
  };
  return draft.targetEndTime === ''
    ? input
    : { ...input, targetEndMinute: parseTime(draft.targetEndTime) };
}

function scheduleKeyOf(draft: Draft): string {
  return JSON.stringify(scheduleInputOf(draft));
}

export function generate(draft: Draft): Draft {
  if (draftIssues(draft).some((i) => i !== 'name-missing' && i !== 'date-missing')) {
    throw new Error('Draft is not ready for generation');
  }
  return {
    ...draft,
    schedule: generateSchedule(scheduleInputOf(draft)),
    scheduleKey: scheduleKeyOf(draft),
  };
}

/** CA2.3: any change to teams or settings after generation marks the schedule stale. */
export function isScheduleStale(draft: Draft): boolean {
  if (draft.schedule === null) return false;
  const blocking = draftIssues(draft).filter((i) => i !== 'name-missing' && i !== 'date-missing');
  return blocking.length > 0 || draft.scheduleKey !== scheduleKeyOf(draft);
}

function isIntIn(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}
