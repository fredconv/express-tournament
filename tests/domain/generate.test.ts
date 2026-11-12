import { describe, expect, it } from 'vitest';
import { generateSchedule } from '../../src/domain/schedule/generate';
import { validateSchedule } from '../../src/domain/schedule/validate';
import type { ScheduleInput, ScheduleResult } from '../../src/domain/types';
import { makeInput, schedule, slotsByTeam } from './helpers';

const TEAM_COUNTS = Array.from({ length: 31 }, (_, i) => i + 2);
const COURT_COUNTS = Array.from({ length: 16 }, (_, i) => i + 1);

function invariantErrors(input: ScheduleInput, result: ScheduleResult) {
  return validateSchedule({ ...input, matches: result.matches });
}

describe('generateSchedule — properties over every size (CA4.1, CA4.3, CA5.1)', () => {
  for (const avoidBackToBack of [false, true]) {
    it(`2–32 teams × 1–16 courts, rest ${avoidBackToBack ? 'on' : 'off'}`, () => {
      for (const teams of TEAM_COUNTS) {
        for (const courts of COURT_COUNTS) {
          const input = makeInput(teams, courts, { avoidBackToBack });
          const result = generateSchedule(input);
          const label = `${teams} teams / ${courts} courts`;

          expect(result.matches, label).toHaveLength((teams * (teams - 1)) / 2);
          expect(invariantErrors(input, result), label).toEqual([]);

          const perSlot = new Map<number, number>();
          for (const m of result.matches) perSlot.set(m.slot, (perSlot.get(m.slot) ?? 0) + 1);
          expect(perSlot.size, `${label}: no empty slot`).toBe(result.slotCount);
          expect(Math.max(...perSlot.values()), label).toBeLessThanOrEqual(courts);
        }
      }
    }, 60_000);
  }
});

describe('generateSchedule — slot count', () => {
  it('CA4.2: without rest and with enough courts, N−1 slots (even) or N (odd)', () => {
    for (const teams of TEAM_COUNTS) {
      const courts = Math.floor(teams / 2);
      if (courts > 16) continue;
      const result = schedule(teams, courts, { avoidBackToBack: false });
      expect(result.slotCount, `${teams} teams`).toBe(teams % 2 === 0 ? teams - 1 : teams);
    }
  });

  it('reaches the minimum number of slots on reference sizes, rest on', () => {
    const sizes = [
      [4, 2],
      [6, 2],
      [8, 2],
      [8, 3],
      [10, 3],
      [12, 4],
      [16, 4],
      [20, 4],
      [32, 8],
    ] as const;
    for (const [teams, courts] of sizes) {
      const usable = Math.min(courts, Math.floor(teams / 2));
      const lowerBound = Math.ceil((teams * (teams - 1)) / 2 / usable);
      expect(schedule(teams, courts).slotCount, `${teams}/${courts}`).toBe(lowerBound);
    }
  });
});

describe('generateSchedule — times and warnings', () => {
  it('CA4.3: start = start + slot × (slot length + transition), end = start + slot length', () => {
    const result = schedule(6, 2, { startMinute: 600, slotMinutes: 22, transitionMinutes: 3 });
    for (const m of result.matches) {
      expect(m.startMinute).toBe(600 + m.slot * 25);
      expect(m.endMinute).toBe(m.startMinute + 22);
    }
    expect(result.endMinute).toBe(600 + (result.slotCount - 1) * 25 + 22);
  });

  it('CA4.5: warns with the real end time when the target end is exceeded', () => {
    const late = schedule(8, 2, { targetEndMinute: 10 * 60 });
    expect(late.warnings).toContainEqual({ kind: 'exceeds-target-end', endMinute: late.endMinute });
    const onTime = schedule(4, 2, { targetEndMinute: 18 * 60 });
    expect(onTime.warnings.some((w) => w.kind === 'exceeds-target-end')).toBe(false);
  });

  it('warns when the schedule runs past midnight', () => {
    const result = schedule(10, 1, { startMinute: 22 * 60 });
    expect(result.warnings.some((w) => w.kind === 'past-midnight')).toBe(true);
  });

  it('CA5.2: back-to-back warnings list exactly the teams playing consecutive slots', () => {
    const sizes = [
      [4, 2],
      [6, 2],
      [8, 3],
      [10, 2],
      [12, 4],
    ] as const;
    for (const [teams, courts] of sizes) {
      const result = schedule(teams, courts);
      const actual = new Set<string>();
      for (const [team, slots] of slotsByTeam(result)) {
        slots.forEach((slot, i) => {
          if (i > 0 && slot - (slots[i - 1] as number) === 1) actual.add(`${slot}|${team}`);
        });
      }
      const warned = new Set(
        result.warnings.flatMap((w) =>
          w.kind === 'back-to-back' ? w.teamIds.map((t) => `${w.slot}|${t}`) : [],
        ),
      );
      expect(warned, `${teams}/${courts}`).toEqual(actual);
    }
  });

  it('does not report back-to-backs when rest is off', () => {
    const result = schedule(4, 2, { avoidBackToBack: false });
    expect(result.warnings.filter((w) => w.kind === 'back-to-back')).toEqual([]);
  });
});

describe('generateSchedule — determinism', () => {
  it('returns the same schedule for the same input', () => {
    const sizes = [
      [5, 2],
      [8, 3],
      [16, 4],
      [32, 8],
    ] as const;
    for (const [teams, courts] of sizes) {
      expect(schedule(teams, courts)).toEqual(schedule(teams, courts));
    }
  });

});

describe.skipIf(import.meta.env.PERF_TESTS === 'off')('generateSchedule — performance', () => {
  it('CA4.4: 32 teams / 16 courts in under 50 ms', () => {
    const start = performance.now();
    schedule(32, 16);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('every size up to 32 teams generates in under 200 ms', () => {
    let slowest = 0;
    for (const teams of [8, 16, 24, 32]) {
      for (const courts of COURT_COUNTS) {
        const start = performance.now();
        schedule(teams, courts);
        slowest = Math.max(slowest, performance.now() - start);
      }
    }
    expect(slowest).toBeLessThan(200);
  });
});

describe('generateSchedule — input validation', () => {
  it('handles the smallest tournament', () => {
    const result = schedule(2, 1);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ id: 'm1', number: 1, slot: 0, courtId: 'c1' });
  });

  it.each([
    ['1 team', makeInput(1, 1)],
    ['33 teams', makeInput(33, 1)],
    ['0 courts', makeInput(4, 0)],
    ['17 courts', makeInput(4, 17)],
    ['duplicate team ids', { ...makeInput(3, 1), teamIds: ['a', 'a', 'b'] }],
    ['zero slot length', makeInput(4, 1, { slotMinutes: 0 })],
    ['negative transition', makeInput(4, 1, { transitionMinutes: -5 })],
    ['fractional start', makeInput(4, 1, { startMinute: 540.5 })],
  ])('rejects %s', (_, input) => {
    expect(() => generateSchedule(input)).toThrow(RangeError);
  });
});
