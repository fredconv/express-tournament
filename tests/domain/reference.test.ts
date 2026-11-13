import { describe, expect, it } from 'vitest';
import { metrics, schedule } from './helpers';

// Frozen fairness metrics for realistic tournaments (SPEC CA5.3, CA5.4).
// A change here must be an improvement, or an explicit decision recorded in ARCHITECTURE.md.
//   slots          number of time slots (shortest day first)
//   backToBack     appearances in two consecutive slots, summed over teams
//   longestStreak  longest run of consecutive slots played by one team
//   longestIdle    longest wait between two matches of one team, in slots
//   maxPlayedGap   largest difference in matches played between two teams after any slot
describe('reference schedules (rest on)', () => {
  it('8 teams / 2 courts', () => {
    expect(metrics(schedule(8, 2))).toMatchInlineSnapshot(`
      {
        "backToBack": 4,
        "longestIdle": 2,
        "longestStreak": 2,
        "maxPlayedGap": 1,
        "slots": 14,
      }
    `);
  });

  it('6 teams / 2 courts', () => {
    expect(metrics(schedule(6, 2))).toMatchInlineSnapshot(`
      {
        "backToBack": 10,
        "longestIdle": 1,
        "longestStreak": 2,
        "maxPlayedGap": 1,
        "slots": 8,
      }
    `);
  });

  it('8 teams / 3 courts', () => {
    expect(metrics(schedule(8, 3))).toMatchInlineSnapshot(`
      {
        "backToBack": 15,
        "longestIdle": 2,
        "longestStreak": 2,
        "maxPlayedGap": 1,
        "slots": 12,
      }
    `);
  });

  it('10 teams / 2 courts', () => {
    expect(metrics(schedule(10, 2))).toMatchInlineSnapshot(`
      {
        "backToBack": 0,
        "longestIdle": 2,
        "longestStreak": 1,
        "maxPlayedGap": 2,
        "slots": 23,
      }
    `);
  });

  it('12 teams / 3 courts', () => {
    expect(metrics(schedule(12, 3))).toMatchInlineSnapshot(`
      {
        "backToBack": 10,
        "longestIdle": 2,
        "longestStreak": 2,
        "maxPlayedGap": 2,
        "slots": 22,
      }
    `);
  });

  it('16 teams / 4 courts', () => {
    expect(metrics(schedule(16, 4))).toMatchInlineSnapshot(`
      {
        "backToBack": 12,
        "longestIdle": 2,
        "longestStreak": 2,
        "maxPlayedGap": 1,
        "slots": 30,
      }
    `);
  });

  it('7 teams / 2 courts (odd)', () => {
    expect(metrics(schedule(7, 2))).toMatchInlineSnapshot(`
      {
        "backToBack": 9,
        "longestIdle": 1,
        "longestStreak": 2,
        "maxPlayedGap": 2,
        "slots": 11,
      }
    `);
  });
});
