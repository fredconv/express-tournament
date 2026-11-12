import type { PhaseDoc, TournamentDoc } from '../../domain/schemas';
import type { ScheduleResult } from '../../domain/types';
import {
  blockingIssues,
  createDraft,
  type Draft,
  draftIssues,
  isAfternoonStale,
  isFinalStale,
  isScheduleStale,
} from './model';

// Conversion between the local draft and the published document (SPEC F9).

export type PublishIssue = 'incomplete' | 'not-generated' | 'stale';

/** Why the draft cannot be published right now, or null. */
export function publishIssue(draft: Draft): PublishIssue | null {
  if (draftIssues(draft).length > 0) return 'incomplete';
  if (!draft.schedule) return 'not-generated';
  if (isScheduleStale(draft) || isAfternoonStale(draft) || isFinalStale(draft)) return 'stale';
  return null;
}

/** Published document; only valid when `publishIssue` is null. */
export function toDoc(draft: Draft): TournamentDoc {
  if (!draft.schedule || blockingIssues(draft).length > 0) {
    throw new Error('Draft is not ready for publishing');
  }
  const phase = (pools: Draft['pools'], schedule: ScheduleResult): PhaseDoc => ({
    pools: pools.map((p) => ({ id: p.id, teamIds: [...p.teamIds] })),
    matches: schedule.matches,
  });
  return {
    schemaVersion: 1,
    name: draft.name.trim(),
    date: draft.date,
    location: draft.location.trim(),
    sport: 'volleyball',
    matchFormat: draft.matchFormat,
    startTime: draft.startTime,
    transitionMinutes: draft.transitionMinutes,
    lunchMinutes: draft.lunchMinutes,
    courts: draft.courts,
    teams: draft.teams,
    morning: phase(draft.pools, draft.schedule),
    afternoon: draft.afternoon ? phase(draft.afternoon.pools, draft.afternoon.schedule) : null,
    final: draft.final ? phase(draft.final.pools, draft.final.schedule) : null,
    results: draft.results,
  };
}

/** Fingerprint of what participants see, to detect unpublished changes. */
export function docKey(draft: Draft): string | null {
  return publishIssue(draft) === null ? JSON.stringify(toDoc(draft)) : null;
}

/** Read-only draft rebuilt from a published document, for the public page. */
export function fromDoc(doc: TournamentDoc): Draft {
  const base = createDraft(doc.date, () => 'x', '');
  const schedule = (phase: PhaseDoc): ScheduleResult => ({
    matches: phase.matches,
    slotCount: Math.max(0, ...phase.matches.map((m) => m.slot + 1)),
    endMinute: Math.max(0, ...phase.matches.map((m) => m.endMinute)),
    warnings: [],
  });
  const later = (phase: PhaseDoc | null) =>
    phase ? { pools: phase.pools, schedule: schedule(phase), key: '' } : null;
  return {
    ...base,
    id: '',
    name: doc.name,
    location: doc.location,
    matchFormat: doc.matchFormat,
    startTime: doc.startTime,
    transitionMinutes: doc.transitionMinutes,
    lunchMinutes: doc.lunchMinutes,
    courts: doc.courts,
    teams: doc.teams,
    pools: doc.morning.pools,
    schedule: schedule(doc.morning),
    afternoon: later(doc.afternoon),
    final: later(doc.final),
    results: doc.results,
  };
}
