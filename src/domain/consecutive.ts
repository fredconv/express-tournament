import type { ScheduledMatch } from './types';

/**
 * Teams that also play in the previous or the next slot of the same phase, by match id
 * (SPEC F13). Computed from the schedule itself, so it works whether or not the rest
 * option was on and on published schedules. Informative only, not an error.
 */
export function consecutiveTeams(matches: readonly ScheduledMatch[]): Map<string, string[]> {
  const slotsByTeam = new Map<string, Set<number>>();
  for (const m of matches) {
    for (const team of [m.teamAId, m.teamBId]) {
      const slots = slotsByTeam.get(team) ?? new Set<number>();
      slots.add(m.slot);
      slotsByTeam.set(team, slots);
    }
  }
  const result = new Map<string, string[]>();
  for (const m of matches) {
    const teams = [m.teamAId, m.teamBId].filter((team) => {
      const slots = slotsByTeam.get(team);
      return slots?.has(m.slot - 1) || slots?.has(m.slot + 1);
    });
    if (teams.length > 0) result.set(m.id, teams);
  }
  return result;
}
