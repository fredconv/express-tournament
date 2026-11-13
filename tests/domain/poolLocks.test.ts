import { describe, expect, it } from 'vitest';
import {
  addTeams,
  createDraft,
  draftIssues,
  generate,
  isScheduleStale,
  locksOf,
  morningPoolCount,
  removeTeam,
  setPoolLock,
} from '../../src/app/draft/model';
import { drawPools, lockIssues, poolSizes } from '../../src/domain/pools';
import { ids } from './helpers';

const teams = ids('t', 13); // pools 5-4-4

function poolOf(pools: ReturnType<typeof drawPools>, teamId: string): number {
  return pools.findIndex((p) => p.teamIds.includes(teamId));
}

function expectValidDraw(pools: ReturnType<typeof drawPools>, teamIds: readonly string[]) {
  expect(pools.map((p) => p.teamIds.length)).toEqual(poolSizes(teamIds.length));
  expect(pools.flatMap((p) => p.teamIds).sort()).toEqual([...teamIds].sort());
}

describe('pool locks (SPEC F10)', () => {
  it('without locks, the draw is exactly the plain random draw', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(drawPools(teams, seed, {})).toEqual(drawPools(teams, seed));
    }
  });

  it('one locked team always stays in its pool, over many redraws', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const pools = drawPools(teams, seed, { t1: 2 });
      expectValidDraw(pools, teams);
      expect(poolOf(pools, 't1'), `seed ${seed}`).toBe(2);
    }
  });

  it('several locks keep favourites apart while the others are redistributed', () => {
    const locks = { t1: 0, t2: 1, t3: 2 };
    const others = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const pools = drawPools(teams, seed, locks);
      expectValidDraw(pools, teams);
      expect([poolOf(pools, 't1'), poolOf(pools, 't2'), poolOf(pools, 't3')]).toEqual([0, 1, 2]);
      others.add(JSON.stringify(pools.map((p) => p.teamIds.filter((t) => !(t in locks)).sort())));
    }
    expect(others.size).toBeGreaterThan(40);
  });

  it('a pool can be entirely locked', () => {
    const locks = { t1: 1, t2: 1, t3: 1, t4: 1 };
    for (let seed = 1; seed <= 20; seed++) {
      const pools = drawPools(teams, seed, locks);
      expectValidDraw(pools, teams);
      expect([...(pools[1]?.teamIds ?? [])].sort()).toEqual(['t1', 't2', 't3', 't4']);
    }
  });

  it('refuses impossible configurations instead of moving a locked team', () => {
    const tooMany = { t1: 1, t2: 1, t3: 1, t4: 1, t5: 1 };
    expect(lockIssues(teams, tooMany)).toEqual([
      { kind: 'over-capacity', poolIndex: 1, locked: 5, capacity: 4 },
    ]);
    expect(() => drawPools(teams, 1, tooMany)).toThrow(RangeError);
    expect(lockIssues(teams, { t1: 3 })).toEqual([
      { kind: 'missing-pool', teamId: 't1', poolIndex: 3 },
    ]);
    expect(() => drawPools(teams, 1, { t1: 3 })).toThrow(RangeError);
  });

  it('flags locks made invalid by a change of the pool layout', () => {
    // 15 teams: 4 pools; removing two teams leaves 3 pools, so pool D disappears.
    const fifteen = ids('t', 15);
    expect(lockIssues(fifteen, { t1: 3 })).toEqual([]);
    expect(lockIssues(fifteen.slice(0, 13), { t1: 3 })).toEqual([
      { kind: 'missing-pool', teamId: 't1', poolIndex: 3 },
    ]);
    // Locks of removed teams are ignored.
    expect(lockIssues(teams, { ghost: 9 })).toEqual([]);
  });

  it('does not favour locked teams in the draw order (last ranking tie-break)', () => {
    let lockedFirst = 0;
    for (let seed = 1; seed <= 200; seed++) {
      if (drawPools(teams, seed, { t1: 0 })[0]?.teamIds[0] === 't1') lockedFirst++;
    }
    // 5 teams in pool A: about 1 draw in 5 starts with the locked team.
    expect(lockedFirst).toBeGreaterThan(20);
    expect(lockedFirst).toBeLessThan(70);
  });
});

describe('pool locks in the draft (SPEC F10)', () => {
  function draft13() {
    let n = 0;
    const newId = (prefix: string) => `${prefix}${++n}`;
    const names = Array.from({ length: 13 }, (_, i) => `Équipe ${i + 1}`).join('\n');
    return addTeams({ ...createDraft('2026-06-20', newId, 'now'), name: 'Beach' }, names, newId)
      .draft;
  }

  it('keeps locked favourites in their pools on every new draw', () => {
    const base = draft13();
    const [a, b, c] = base.teams.map((t) => t.id);
    let locked = setPoolLock(
      setPoolLock(setPoolLock(base, a as string, 0), b as string, 1),
      c as string,
      2,
    );
    for (let seed = 1; seed <= 30; seed++) {
      locked = generate(locked, seed);
      expect(locked.pools.map((p) => p.teamIds.includes(a as string))).toEqual([
        true,
        false,
        false,
      ]);
      expect(locked.pools[1]?.teamIds).toContain(b);
      expect(locked.pools[2]?.teamIds).toContain(c);
    }
  });

  it('unlocks, forgets removed teams and marks the morning to regenerate', () => {
    const base = generate(draft13(), 1);
    const id = base.teams[0]?.id as string;
    const locked = setPoolLock(base, id, 1);
    expect(isScheduleStale(locked)).toBe(true);
    expect(locksOf(setPoolLock(locked, id, null))).toEqual({});
    expect(locksOf(removeTeam(locked, id))).toEqual({});
  });

  it('blocks the draw while a lock cannot be honoured', () => {
    let day = draft13();
    for (const team of day.teams.slice(0, 5)) day = setPoolLock(day, team.id, 1);
    expect(draftIssues(day)).toContain('pool-locks');
    expect(() => generate(day, 1)).toThrow();
    // Pool D exists with 15 teams, not with 13.
    let extra = 0;
    const fifteen = addTeams(day, 'X\nY', (p) => `${p}extra${++extra}`).draft;
    expect(morningPoolCount(fifteen)).toBe(4);
    expect(morningPoolCount(day)).toBe(3);
  });
});
