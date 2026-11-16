import { describe, expect, it } from 'vitest';
import {
  generate,
  generateAfternoon,
  generateFinal,
  scoresErasedBy,
} from '../../src/app/draft/model';
import { createTestDraft, simulateToEnd } from '../../src/app/draft/simulation';
import { forfeitBy, matchStatus, outcome } from '../../src/domain/scores';
import { poolStandings } from '../../src/domain/standings';
import type { MatchFormat, ScheduledMatch } from '../../src/domain/types';

const TIMED: MatchFormat = { kind: 'time', setCount: 2, minutesPerSet: 10 };

describe('match status and winner (SPEC F11)', () => {
  it('derives the status from the same outcome as the standings', () => {
    expect(matchStatus(undefined)).toBe('pending');
    expect(matchStatus([{ a: 21, b: 15 }])).toBe('played');
    expect(matchStatus(forfeitBy('a', TIMED))).toBe('forfeit');
  });

  it('a 1–1 with more points is a draw, not a win (rule D11)', () => {
    const sets = [
      { a: 21, b: 15 },
      { a: 17, b: 21 },
    ];
    expect(outcome(sets)).toMatchObject({ winner: null, pointsA: 38, pointsB: 36 });
    expect(matchStatus(sets)).toBe('draw');
    // The standings agree: one point each, points only feed the difference.
    const pool = { id: 'P', teamIds: ['x', 'y'] };
    const match: ScheduledMatch = {
      id: 'm1',
      poolId: 'P',
      number: 1,
      slot: 0,
      courtId: 'c1',
      teamAId: 'x',
      teamBId: 'y',
      startMinute: 540,
      endMinute: 560,
    };
    const rows = poolStandings(pool, [match], { m1: sets });
    expect(rows.map((r) => r.points)).toEqual([1, 1]);
  });
});

describe('regenerating a phase never erases scores silently (SPEC F12)', () => {
  it('counts the afternoon and final scores lost by a regeneration', () => {
    let n = 0;
    const base = generate(
      createTestDraft('T', '2026-06-20', (p) => `${p}${++n}`, 'now', 1),
      3,
    );
    const day = simulateToEnd(base, { mode: 'random', seed: 3 }).draft;
    const afternoon = day.afternoon?.schedule.matches.length ?? 0;
    const final = day.final?.schedule.matches.length ?? 0;
    expect(scoresErasedBy(day, 'final')).toBe(final);
    expect(scoresErasedBy(day, 'afternoon')).toBe(afternoon + final);
    // What the count announces is exactly what regenerating removes.
    const total = Object.keys(day.results).length;
    expect(Object.keys(generateFinal(day).results)).toHaveLength(total - final);
    expect(Object.keys(generateAfternoon(day).results)).toHaveLength(total - afternoon - final);
    expect(scoresErasedBy(generateAfternoon(day), 'afternoon')).toBe(0);
  });
});
