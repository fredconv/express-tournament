import { generateSchedule } from '../../src/domain/schedule/generate';
import type { ScheduleInput, ScheduleResult } from '../../src/domain/types';

export const ids = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);

export function makeInput(teams: number, courts: number, overrides: Partial<ScheduleInput> = {}) {
  return {
    teamIds: ids('t', teams),
    courtIds: ids('c', courts),
    startMinute: 9 * 60,
    slotMinutes: 20,
    transitionMinutes: 5,
    avoidBackToBack: true,
    ...overrides,
  } satisfies ScheduleInput;
}

export function schedule(teams: number, courts: number, overrides: Partial<ScheduleInput> = {}) {
  return generateSchedule(makeInput(teams, courts, overrides));
}

/** Slots played by each team, ascending. */
export function slotsByTeam(result: ScheduleResult): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const m of result.matches) {
    for (const t of [m.teamAId, m.teamBId]) map.set(t, [...(map.get(t) ?? []), m.slot]);
  }
  for (const slots of map.values()) slots.sort((a, b) => a - b);
  return map;
}

/** Fairness metrics used by reference cases (SPEC CA5.4). */
export function metrics(result: ScheduleResult) {
  let backToBack = 0;
  let longestStreak = 0;
  let longestIdle = 0;
  for (const slots of slotsByTeam(result).values()) {
    let streak = 1;
    longestStreak = Math.max(longestStreak, 1);
    for (let i = 1; i < slots.length; i++) {
      const gap = (slots[i] as number) - (slots[i - 1] as number);
      streak = gap === 1 ? streak + 1 : 1;
      if (gap === 1) backToBack++;
      longestStreak = Math.max(longestStreak, streak);
      longestIdle = Math.max(longestIdle, gap - 1);
    }
  }
  // Largest difference in matches played between two teams after any slot.
  const played = new Map<string, number>();
  let maxPlayedGap = 0;
  for (let slot = 0; slot < result.slotCount; slot++) {
    for (const m of result.matches.filter((x) => x.slot === slot)) {
      for (const t of [m.teamAId, m.teamBId]) played.set(t, (played.get(t) ?? 0) + 1);
    }
    const values = [...slotsByTeam(result).keys()].map((t) => played.get(t) ?? 0);
    maxPlayedGap = Math.max(maxPlayedGap, Math.max(...values) - Math.min(...values));
  }
  return { slots: result.slotCount, backToBack, longestStreak, longestIdle, maxPlayedGap };
}
