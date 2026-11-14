import type { ScheduledMatch } from './types';

/**
 * One team playing two slots in a row (SPEC F13), seen from one of the two matches:
 * - `next`: this team plays again right after, in `other`;
 * - `previous`: this team just played, in `other`.
 * A team with three matches in a row has both on its middle match.
 */
export interface BackToBackLink {
  teamId: string;
  direction: 'previous' | 'next';
  other: ScheduledMatch;
}

/**
 * Back-to-back links by match id, one per team concerned, `previous` before `next`.
 * Computed from the schedule of one phase in real time order (start time, then slot),
 * never from match numbers, so it works whatever the rest option and on published
 * schedules. Informative only: two in a row is allowed, it is not an error.
 */
export function backToBackLinks(matches: readonly ScheduledMatch[]): Map<string, BackToBackLink[]> {
  const links = new Map<string, BackToBackLink[]>();
  const add = (match: ScheduledMatch, link: BackToBackLink) =>
    links.set(match.id, [...(links.get(match.id) ?? []), link]);

  for (const [teamId, played] of matchesByTeam(matches)) {
    played.forEach((match, i) => {
      const before = played[i - 1];
      const after = played[i + 1];
      if (before && before.slot === match.slot - 1) {
        add(match, { teamId, direction: 'previous', other: before });
      }
      if (after && after.slot === match.slot + 1) {
        add(match, { teamId, direction: 'next', other: after });
      }
    });
  }
  for (const list of links.values()) {
    list.sort((x, y) => (x.direction === y.direction ? 0 : x.direction === 'previous' ? -1 : 1));
  }
  return links;
}

/**
 * Teams playing three slots or more in a row: forbidden (SPEC F5, ADR-12). The engine
 * never produces it; this check guards published or forged schedules.
 */
export function forbiddenRuns(matches: readonly ScheduledMatch[]): string[] {
  const teams: string[] = [];
  for (const [teamId, played] of matchesByTeam(matches)) {
    let run = 1;
    for (let i = 1; i < played.length; i++) {
      run =
        (played[i] as ScheduledMatch).slot === (played[i - 1] as ScheduledMatch).slot + 1
          ? run + 1
          : 1;
      if (run >= 3) {
        teams.push(teamId);
        break;
      }
    }
  }
  return teams;
}

function matchesByTeam(matches: readonly ScheduledMatch[]): Map<string, ScheduledMatch[]> {
  const byTeam = new Map<string, ScheduledMatch[]>();
  for (const m of matches) {
    for (const team of [m.teamAId, m.teamBId]) byTeam.set(team, [...(byTeam.get(team) ?? []), m]);
  }
  for (const played of byTeam.values()) {
    played.sort((x, y) => x.startMinute - y.startMinute || x.slot - y.slot);
  }
  return byTeam;
}
