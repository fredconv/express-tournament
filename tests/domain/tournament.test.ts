import { describe, expect, it } from 'vitest';
import {
  addTeams,
  canGenerateAfternoon,
  canGenerateFinal,
  createDraft,
  type Draft,
  generate,
  generateAfternoon,
  generateFinal,
  isAfternoonStale,
  setResult,
} from '../../src/app/draft/model';
import { drawPools, poolSizes } from '../../src/domain/pools';
import { seededRandom } from '../../src/domain/schedule/random';
import { validateSchedule } from '../../src/domain/schedule/validate';
import { allowsDraw, type SetScore, scoreIssue } from '../../src/domain/scores';
import { overallRanking, poolStandings } from '../../src/domain/standings';
import type { MatchFormat, ScheduledMatch } from '../../src/domain/types';

const TIME_2X10: MatchFormat = { kind: 'time', setCount: 2, minutesPerSet: 10 };
const BEST_OF_3: MatchFormat = { kind: 'points', setCount: 3, pointsPerSet: 21, mode: 'best-of' };
const ONE_SET: MatchFormat = { kind: 'points', setCount: 1, pointsPerSet: 21, mode: 'all-sets' };

describe('pool draw (SPEC F10)', () => {
  it('CA10.1: sizes within 3–5 and balanced from 6 to 32 teams, one pool below 6', () => {
    for (let n = 2; n <= 32; n++) {
      const sizes = poolSizes(n);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
      if (n < 6) {
        expect(sizes).toEqual([n]);
        continue;
      }
      expect(Math.min(...sizes), `${n}`).toBeGreaterThanOrEqual(3);
      expect(Math.max(...sizes), `${n}`).toBeLessThanOrEqual(5);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it('CA10.2: 13, 14 and 15 teams', () => {
    expect(poolSizes(13)).toEqual([5, 4, 4]);
    expect(poolSizes(14)).toEqual([4, 4, 3, 3]);
    expect(poolSizes(15)).toEqual([4, 4, 4, 3]);
  });

  it('CA10.3: same seed, same draw; every team in exactly one pool', () => {
    const teams = Array.from({ length: 15 }, (_, i) => `t${i}`);
    expect(drawPools(teams, 42)).toEqual(drawPools(teams, 42));
    expect(drawPools(teams, 42)).not.toEqual(drawPools(teams, 43));
    const all = drawPools(teams, 42).flatMap((p) => p.teamIds);
    expect([...all].sort()).toEqual([...teams].sort());
  });
});

describe('scores (SPEC F11)', () => {
  const sets = (...pairs: [number, number][]): SetScore[] => pairs.map(([a, b]) => ({ a, b }));

  it('draws only when the format allows them', () => {
    expect(allowsDraw(TIME_2X10)).toBe(true);
    expect(allowsDraw(BEST_OF_3)).toBe(false);
    expect(allowsDraw(ONE_SET)).toBe(false);
    expect(scoreIssue(sets([21, 15], [18, 21]), TIME_2X10)).toBeNull();
  });

  it('CA11.2: rejects inconsistent scores', () => {
    expect(scoreIssue(sets([21, 15]), TIME_2X10)).toBe('set-count');
    expect(scoreIssue(sets([21, 21], [15, 10]), TIME_2X10)).toBe('tied-set');
    expect(scoreIssue(sets([-1, 3], [15, 10]), TIME_2X10)).toBe('invalid-points');
    expect(scoreIssue(sets([21, 15], [21, 15], [21, 10]), BEST_OF_3)).toBe('set-count');
    expect(scoreIssue(sets([21, 15], [15, 21]), BEST_OF_3)).toBe('set-count');
    expect(scoreIssue(sets([21, 15], [15, 21], [15, 10]), BEST_OF_3)).toBeNull();
    expect(scoreIssue([], BEST_OF_3)).toBe('set-count');
  });

  it('the final needs a winner: a deciding set after a tie', () => {
    expect(scoreIssue(sets([21, 15], [18, 21]), TIME_2X10, true)).toBe('needs-winner');
    expect(scoreIssue(sets([21, 15], [18, 21], [15, 12]), TIME_2X10, true)).toBeNull();
    expect(scoreIssue(sets([21, 15], [21, 18], [15, 12]), TIME_2X10, true)).toBe('set-count');
  });
});

describe('rankings (SPEC F11)', () => {
  const pool = { id: 'P1', teamIds: ['a', 'b', 'c', 'd'] };
  const match = (id: string, teamAId: string, teamBId: string): ScheduledMatch => ({
    id,
    poolId: 'P1',
    number: 1,
    slot: 0,
    courtId: 'c1',
    teamAId,
    teamBId,
    startMinute: 0,
    endMinute: 20,
  });
  const matches = [match('m1', 'a', 'b'), match('m2', 'c', 'd'), match('m3', 'a', 'c')];

  it('CA11.1: points, then set and point differences, then draw order', () => {
    const results = {
      m1: [
        { a: 21, b: 10 },
        { a: 10, b: 21 },
      ], // draw a–b
      m2: [
        { a: 21, b: 19 },
        { a: 21, b: 19 },
      ], // c beats d
    };
    const rows = poolStandings(pool, matches, results);
    expect(rows.map((r) => r.teamId)).toEqual(['c', 'a', 'b', 'd']);
    expect(rows[0]).toMatchObject({ played: 1, won: 1, points: 2, setsFor: 2, setsAgainst: 0 });
    expect(rows[1]).toMatchObject({ drawn: 1, points: 1 });
    // Teams that have not played keep the draw order.
    expect(poolStandings(pool, matches, {}).map((r) => r.teamId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('compares teams of different pool sizes per match played', () => {
    const big = { id: 'P1', teamIds: ['a', 'b', 'c'] };
    const small = { id: 'P2', teamIds: ['x', 'y'] };
    const win = [
      { a: 21, b: 15 },
      { a: 21, b: 15 },
    ];
    const all = [
      match('m1', 'a', 'b'),
      match('m2', 'a', 'c'),
      match('m3', 'b', 'c'),
      { ...match('m4', 'x', 'y'), poolId: 'P2' },
    ];
    // a wins twice by 12 points (avg +12), x wins once by 20 points (avg +20).
    const results = {
      m1: win,
      m2: win,
      m3: win,
      m4: [
        { a: 21, b: 11 },
        { a: 21, b: 11 },
      ],
    };
    expect(overallRanking([big, small], all, results).slice(0, 2)).toEqual(['x', 'a']);
  });
});

describe('full tournament day (SPEC F10–F12)', () => {
  function tournament(teamCount: number, courts: number): Draft {
    let n = 0;
    const ids = (prefix: string) => `${prefix}${++n}`;
    const names = Array.from({ length: teamCount }, (_, i) => `Équipe ${i + 1}`).join('\n');
    const base = {
      ...createDraft('2026-06-20', ids, 'now'),
      name: 'Beach',
      targetEndTime: '18:00',
    };
    const withCourts = {
      ...base,
      courts: Array.from({ length: courts }, (_, i) => ({ id: `c${i}`, name: `T${i + 1}` })),
    };
    return addTeams(withCourts, names, ids).draft;
  }

  function playAll(draft: Draft, matches: readonly ScheduledMatch[], seed: number): Draft {
    const random = seededRandom(seed);
    const point = () => 10 + Math.floor(random() * 11);
    return matches.reduce((d, m) => {
      const sets = [
        { a: 21, b: point() },
        { a: point(), b: 21 },
      ];
      const decided = random() < 0.7 ? [sets[0] as SetScore, { a: 21, b: point() }] : sets;
      return setResult(d, m.id, decided);
    }, draft);
  }

  it.each([
    [13, 3],
    [15, 3],
    [15, 2],
  ])('%i teams on %i courts: morning → afternoon → final', (teamCount, courts) => {
    let day = generate(tournament(teamCount, courts), 7);
    const morning = day.schedule as NonNullable<Draft['schedule']>;
    expect(validateSchedule({ ...shape(day), pools: day.pools, matches: morning.matches })).toEqual(
      [],
    );
    expect(canGenerateAfternoon(day)).toBe(false);

    day = playAll(day, morning.matches, 1);
    day = generateAfternoon(day);
    const afternoon = day.afternoon as NonNullable<Draft['afternoon']>;

    // CA12.1: everyone plays at least two afternoon matches, after the lunch break.
    expect(afternoon.pools.flatMap((p) => p.teamIds).sort()).toEqual(
      day.teams.map((t) => t.id).sort(),
    );
    expect(Math.min(...afternoon.pools.map((p) => p.teamIds.length))).toBeGreaterThanOrEqual(3);
    expect(afternoon.schedule.matches[0]?.startMinute).toBe(morning.endMinute + day.lunchMinutes);
    expect(afternoon.schedule.matches[0]?.number).toBe(morning.matches.length + 1);
    expect(
      validateSchedule({
        ...shape(day),
        startMinute: morning.endMinute + day.lunchMinutes,
        firstNumber: morning.matches.length + 1,
        pools: afternoon.pools,
        matches: afternoon.schedule.matches,
      }),
    ).toEqual([]);

    // CA12.2: the first afternoon pool holds the top of the overall ranking.
    const ranking = overallRanking(day.pools, morning.matches, day.results);
    expect(afternoon.pools[0]?.teamIds).toEqual(
      ranking.slice(0, afternoon.pools[0]?.teamIds.length),
    );

    expect(canGenerateFinal(day)).toBe(false);
    day = playAll(day, afternoon.schedule.matches, 2);
    day = generateFinal(day);

    // CA12.3: first against second of the top afternoon pool, after the afternoon.
    const top = poolStandings(
      afternoon.pools[0] as NonNullable<(typeof afternoon.pools)[0]>,
      afternoon.schedule.matches,
      day.results,
    );
    const final = day.final?.schedule.matches[0] as ScheduledMatch;
    expect([final.teamAId, final.teamBId]).toEqual([top[0]?.teamId, top[1]?.teamId]);
    expect(final.startMinute).toBe(afternoon.schedule.endMinute + day.transitionMinutes);

    day = setResult(day, final.id, [
      { a: 21, b: 18 },
      { a: 21, b: 19 },
    ]);
    expect(day.results[final.id]).toBeDefined();

    // Changing a morning score marks the afternoon stale (no silent recalculation).
    const first = morning.matches[0] as ScheduledMatch;
    const changed = setResult(day, first.id, [
      { a: 3, b: 21 },
      { a: 4, b: 21 },
    ]);
    expect(isAfternoonStale(changed)).toBe(true);
  });

  it('15 teams on 3 courts finish before the target end; 2 courts get a warning', () => {
    const endOf = (courts: number) => {
      let day = generate(tournament(15, courts), 7);
      day = generateAfternoon(playAll(day, day.schedule?.matches ?? [], 1));
      return day.afternoon?.schedule;
    };
    expect(endOf(3)?.warnings.some((w) => w.kind === 'exceeds-target-end')).toBe(false);
    expect(endOf(2)?.warnings.some((w) => w.kind === 'exceeds-target-end')).toBe(true);
  });
});

function shape(day: Draft) {
  return {
    courtIds: day.courts.map((c) => c.id),
    startMinute: 9 * 60,
    slotMinutes: day.slotMinutes,
    transitionMinutes: day.transitionMinutes,
  };
}
