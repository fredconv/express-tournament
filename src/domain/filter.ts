import type { ScheduledMatch } from './types';

/** Planning filter (SPEC F6): a team and/or a court, combined with AND; null means all. */
export interface PlanningFilter {
  teamId: string | null;
  courtId: string | null;
}

export const NO_FILTER: PlanningFilter = { teamId: null, courtId: null };

export function isFiltered(filter: PlanningFilter): boolean {
  return filter.teamId !== null || filter.courtId !== null;
}

export function matchesFilter(match: ScheduledMatch, filter: PlanningFilter): boolean {
  const team =
    filter.teamId === null || match.teamAId === filter.teamId || match.teamBId === filter.teamId;
  const court = filter.courtId === null || match.courtId === filter.courtId;
  return team && court;
}

export function filterMatches(
  matches: readonly ScheduledMatch[],
  filter: PlanningFilter,
): ScheduledMatch[] {
  return matches.filter((m) => matchesFilter(m, filter));
}

/**
 * Smallest change that shows a hidden match: drop the court only if the team still
 * matches, otherwise show everything. The team stays selected whenever possible.
 */
export function revealFilter(match: ScheduledMatch, filter: PlanningFilter): PlanningFilter {
  if (matchesFilter(match, filter)) return filter;
  const keepTeam = matchesFilter(match, { teamId: filter.teamId, courtId: null });
  return keepTeam ? { teamId: filter.teamId, courtId: null } : NO_FILTER;
}

/** Ignores a team or court that no longer exists (renamed lists, removed court). */
export function sanitizeFilter(
  filter: PlanningFilter,
  teamIds: readonly string[],
  courtIds: readonly string[],
): PlanningFilter {
  return {
    teamId: filter.teamId !== null && teamIds.includes(filter.teamId) ? filter.teamId : null,
    courtId: filter.courtId !== null && courtIds.includes(filter.courtId) ? filter.courtId : null,
  };
}
