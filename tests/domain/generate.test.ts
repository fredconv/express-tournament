import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../src/domain/limits';
import { drawPools } from '../../src/domain/pools';
import { generateSchedule, schedulePools } from '../../src/domain/schedule/generate';
import { validateSchedule } from '../../src/domain/schedule/validate';
import type { ScheduleInput, ScheduleResult } from '../../src/domain/types';
import { ids, makeInput, schedule, shapeOf, slotsByTeam } from './helpers';

const TEAM_COUNTS = Array.from({ length: 31 }, (_, i) => i + 2);
const COURT_COUNTS = Array.from({ length: LIMITS.maxCourts }, (_, i) => i + 1);

function invariantErrors(input: ScheduleInput, result: ScheduleResult) {
  return validateSchedule({ ...shapeOf(input), matches: result.matches });
}

describe('generateSchedule — properties over every size (CA4.1, CA4.3, CA5.1)', () => {
  for (const avoidBackToBack of [false, true]) {
    it(`2–32 teams × 1–6 courts, rest ${avoidBackToBack ? 'on' : 'off'}`, () => {
      for (const teams of TEAM_COUNTS) {
        for (const courts of COURT_COUNTS) {
          const input = makeInput(teams, courts, { avoidBackToBack });
          const result = generateSchedule(input);
          const label = `${teams} teams / ${courts} courts`;

          expect(result.matches, label).toHaveLength((teams * (teams - 1)) / 2);
          expect(invariantErrors(input, result), label).toEqual([]);

          const perSlot = new Map<number, number>();
          for (const m of result.matches) perSlot.set(m.slot, (perSlot.get(m.slot) ?? 0) + 1);
          expect(Math.max(...perSlot.values()), label).toBeLessThanOrEqual(courts);
          // SPEC F5: never three slots in a row, whatever the rest option.
          expect(longestRun(result), `${label}: longest run`).toBeLessThanOrEqual(2);
        }
      }
    }, 60_000);
  }
});

describe('generateSchedule — slot count', () => {
  it('CA4.2: without rest, every court is used unless that would make a team play three in a row', () => {
    for (const teams of TEAM_COUNTS) {
      const courts = Math.min(LIMITS.maxCourts, Math.floor(teams / 2));
      const result = schedule(teams, courts, { avoidBackToBack: false });
      const perTeam = teams - 1;
      // With runs of at most two, a team needs one rest per two matches.
      const noTripleBound = Math.max(
        perTeam + Math.floor((perTeam - 1) / 2),
        Math.ceil((teams * perTeam) / 2 / courts),
      );
      expect(longestRun(result), `${teams} teams`).toBeLessThanOrEqual(2);
      // Greedy, not exact: measured within 3 slots of that bound (single pool, rest off).
      expect(result.slotCount, `${teams} teams`).toBeLessThanOrEqual(noTripleBound + 3);
    }
  });

  it('pool days stay within one slot of the minimum on realistic sizes, rest on', () => {
    for (const [teams, courts] of [
      [13, 2],
      [13, 3],
      [14, 3],
      [15, 2],
      [15, 3],
      [16, 4],
      [20, 4],
      [32, 6],
    ] as const) {
      const pools = drawPools(ids('t', teams), 1);
      const result = schedulePools({ ...poolInput(courts), pools });
      const matchCount = result.matches.length;
      const lowerBound = Math.ceil(matchCount / Math.min(courts, Math.floor(teams / 2)));
      expect(result.slotCount, `${teams}/${courts}`).toBeLessThanOrEqual(lowerBound + 1);
    }
  });
});

describe('three in a row (SPEC F5, ADR-12)', () => {
  it('13 teams, pools 5-4-4, 3 courts: 22 matches in 8 slots and never three in a row', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const pools = drawPools(ids('t', 13), seed);
      expect(pools.map((p) => p.teamIds.length)).toEqual([5, 4, 4]);
      const result = schedulePools({ ...poolInput(3), pools });
      expect(result.matches).toHaveLength(22);
      expect(result.slotCount, `seed ${seed}`).toBe(8);
      expect(longestRun(result), `seed ${seed}`).toBeLessThanOrEqual(2);
    }
  });

  it('every pool layout from 2 to 32 teams on 1 to 6 courts avoids three in a row', () => {
    for (const teams of TEAM_COUNTS) {
      for (const courts of COURT_COUNTS) {
        const pools = drawPools(ids('t', teams), teams * 7 + courts);
        for (const avoidBackToBack of [true, false]) {
          const result = schedulePools({ ...poolInput(courts), pools, avoidBackToBack });
          expect(longestRun(result), `${teams}/${courts}`).toBeLessThanOrEqual(2);
        }
      }
    }
  }, 60_000);

  it('8 teams, pools 4-4, 3 courts: impossible in 4 slots (proved), so one more slot is used', () => {
    const pools = drawPools(ids('t', 8), 1);
    const pairings = pools.flatMap((p) =>
      p.teamIds.flatMap((a, i) => p.teamIds.slice(i + 1).map((b) => [a, b] as const)),
    );
    expect(existsWithoutTriple(pairings, 4, 3)).toBe(false);
    expect(existsWithoutTriple(pairings, 5, 3)).toBe(true);
    const result = schedulePools({ ...poolInput(3), pools });
    expect(result.slotCount).toBe(5);
    expect(longestRun(result)).toBeLessThanOrEqual(2);
  });

  it('reports back-to-backs as proven minimal only when the lower bound is reached', () => {
    const fifteen = schedulePools({ ...poolInput(3), pools: drawPools(ids('t', 15), 1) });
    expect(fifteen.backToBackMinimal).toBe(true);
    const sixteen = schedulePools({ ...poolInput(5), pools: drawPools(ids('t', 16), 1) });
    expect(sixteen.backToBackMinimal).toBe(false);
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
      [32, 6],
    ] as const;
    for (const [teams, courts] of sizes) {
      expect(schedule(teams, courts)).toEqual(schedule(teams, courts));
    }
  });
});

describe.skipIf(import.meta.env.PERF_TESTS === 'off')('generateSchedule — performance', () => {
  it('CA4.4: 32 teams / 6 courts in under 50 ms', () => {
    const start = performance.now();
    schedule(32, 6);
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

describe('schedulePools — several pools on shared courts (CA4.6)', () => {
  it('plays a round robin inside each pool, never across pools, without conflicts', () => {
    const sizes = [4, 4, 4, 3];
    let next = 0;
    const pools = sizes.map((size, p) => ({
      id: `p${p + 1}`,
      teamIds: Array.from({ length: size }, () => `t${++next}`),
    }));
    for (const avoidBackToBack of [false, true]) {
      const input = {
        ...makeInput(2, 3, { avoidBackToBack }),
        pools,
        firstNumber: 23,
        idPrefix: 'a',
      };
      const { teamIds: _unused, ...rest } = input;
      const result = schedulePools(rest);
      expect(result.matches).toHaveLength(6 + 6 + 6 + 3);
      expect(result.matches[0]).toMatchObject({ id: 'a23', number: 23 });
      expect(validateSchedule({ ...rest, matches: result.matches })).toEqual([]);
      expect(result.slotCount).toBe(7);
    }
  });
});

function poolInput(courts: number) {
  return {
    courtIds: ids('c', courts),
    startMinute: 9 * 60,
    slotMinutes: 20,
    transitionMinutes: 5,
    avoidBackToBack: true,
  };
}

function longestRun(result: ScheduleResult): number {
  let longest = 0;
  for (const slots of slotsByTeam(result).values()) {
    let run = 0;
    slots.forEach((slot, i) => {
      run = i > 0 && slot === (slots[i - 1] as number) + 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
    });
  }
  return longest;
}

/**
 * Exhaustive search (small cases only): can these matches fit in `slotCount` slots of
 * `courts` courts with no team playing three slots in a row?
 */
function existsWithoutTriple(
  pairings: readonly (readonly [string, string])[],
  slotCount: number,
  courts: number,
): boolean {
  const slotsOf = new Map<string, Set<number>>();
  const used = new Array<number>(slotCount).fill(0);
  const playing = Array.from({ length: slotCount }, () => new Set<string>());
  const tripleAt = (team: string, slot: number) => {
    const s = slotsOf.get(team) ?? new Set<number>();
    const has = (x: number) => x === slot || s.has(x);
    return [slot - 2, slot - 1, slot].some(
      (start) => has(start) && has(start + 1) && has(start + 2),
    );
  };
  const place = (index: number): boolean => {
    const pairing = pairings[index];
    if (!pairing) return true;
    const [a, b] = pairing;
    for (let slot = 0; slot < slotCount; slot++) {
      if ((used[slot] as number) >= courts) continue;
      const busy = playing[slot] as Set<string>;
      if (busy.has(a) || busy.has(b) || tripleAt(a, slot) || tripleAt(b, slot)) continue;
      used[slot] = (used[slot] as number) + 1;
      busy.add(a);
      busy.add(b);
      for (const t of [a, b]) slotsOf.set(t, (slotsOf.get(t) ?? new Set<number>()).add(slot));
      if (place(index + 1)) return true;
      used[slot] = (used[slot] as number) - 1;
      busy.delete(a);
      busy.delete(b);
      for (const t of [a, b]) slotsOf.get(t)?.delete(slot);
    }
    return false;
  };
  return place(0);
}
