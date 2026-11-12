import { describe, expect, it } from 'vitest';
import { roundRobin } from '../../src/domain/schedule/roundRobin';
import { ids } from './helpers';

describe('roundRobin', () => {
  it.each([2, 3, 4, 5, 8, 9, 16, 31, 32])('pairs %i teams exactly once each', (n) => {
    const pairings = roundRobin(ids('t', n));
    expect(pairings).toHaveLength((n * (n - 1)) / 2);
    const keys = pairings.map((p) => [p.teamAId, p.teamBId].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    expect(pairings.every((p) => p.teamAId !== p.teamBId)).toBe(true);
  });

  it('gives every team at most one match per round', () => {
    for (const n of [6, 7]) {
      const byRound = new Map<number, string[]>();
      for (const p of roundRobin(ids('t', n))) {
        byRound.set(p.round, [...(byRound.get(p.round) ?? []), p.teamAId, p.teamBId]);
      }
      expect(byRound.size).toBe(n % 2 === 0 ? n - 1 : n);
      for (const teams of byRound.values()) expect(new Set(teams).size).toBe(teams.length);
    }
  });

  it('numbers pairings in order', () => {
    const pairings = roundRobin(ids('t', 6));
    expect(pairings.map((p) => p.order)).toEqual(pairings.map((_, i) => i));
  });
});
