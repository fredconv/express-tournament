import { describe, expect, it } from 'vitest';
import { estimateSetMinutes, isSlotEstimate, suggestSlotMinutes } from '../../src/domain/format';

describe('suggestSlotMinutes (decision D1)', () => {
  it('CA3.1: 2 sets of 10 min → 22 min (2 min side change)', () => {
    expect(suggestSlotMinutes({ kind: 'time', setCount: 2, minutesPerSet: 10 })).toBe(22);
    expect(suggestSlotMinutes({ kind: 'time', setCount: 1, minutesPerSet: 15 })).toBe(15);
  });

  it('CA3.2: points formats use the field estimates and are flagged as estimates', () => {
    const twoSetsOf25 = {
      kind: 'points',
      setCount: 2,
      pointsPerSet: 25,
      mode: 'all-sets',
    } as const;
    expect(suggestSlotMinutes(twoSetsOf25)).toBe(20 * 2 + 2);
    expect(isSlotEstimate(twoSetsOf25)).toBe(true);
    expect(isSlotEstimate({ kind: 'time', setCount: 2, minutesPerSet: 10 })).toBe(false);
    expect(
      suggestSlotMinutes({ kind: 'points', setCount: 3, pointsPerSet: 15, mode: 'all-sets' }),
    ).toBe(12 * 3 + 4);
  });

  it('sizes best-of formats for the deciding set', () => {
    expect(
      suggestSlotMinutes({
        kind: 'points',
        setCount: 3,
        pointsPerSet: 25,
        mode: 'best-of',
        decidingSetPoints: 15,
      }),
    ).toBe(20 * 2 + 12 + 4);
  });

  it('estimates unknown point targets proportionally', () => {
    expect(estimateSetMinutes(25)).toBe(20);
    expect(estimateSetMinutes(10)).toBe(8);
    expect(estimateSetMinutes(1)).toBe(1);
  });
});
