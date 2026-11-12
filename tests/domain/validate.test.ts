import { describe, expect, it } from 'vitest';
import { validateSchedule } from '../../src/domain/schedule/validate';
import type { ScheduledMatch } from '../../src/domain/types';
import { makeInput, schedule } from './helpers';

const input = makeInput(4, 2);
const generated = schedule(4, 2).matches;

function codes(matches: ScheduledMatch[]) {
  return validateSchedule({ ...input, matches }).map((e) => e.code);
}

function patch(index: number, change: Partial<ScheduledMatch>) {
  return generated.map((m, i) => (i === index ? { ...m, ...change } : m));
}

describe('validateSchedule', () => {
  it('accepts a generated schedule', () => {
    expect(codes(generated)).toEqual([]);
  });

  it('detects a team playing twice in the same slot', () => {
    const first = generated[0] as ScheduledMatch;
    const index = generated.findIndex((m) => m.slot !== first.slot);
    const moved = patch(index, {
      slot: first.slot,
      startMinute: first.startMinute,
      endMinute: first.endMinute,
    });
    expect(codes(moved)).toContain('team-conflict');
  });

  it('detects two matches on the same court in the same slot', () => {
    const first = generated[0] as ScheduledMatch;
    const index = generated.findIndex((m, i) => i > 0 && m.slot === first.slot);
    expect(codes(patch(index, { courtId: first.courtId }))).toContain('court-conflict');
  });

  it('detects missing, duplicated, unknown and self matches', () => {
    expect(codes(generated.slice(1))).toContain('missing-pairs');
    const duplicate = { ...(generated[0] as ScheduledMatch), id: 'x' };
    expect(codes([...generated, duplicate])).toContain('duplicate-pair');
    expect(codes(patch(0, { teamAId: 'ghost' }))).toContain('unknown-team');
    expect(codes(patch(0, { courtId: 'nowhere' }))).toContain('unknown-court');
    expect(codes(patch(0, { teamBId: generated[0]?.teamAId as string }))).toContain('self-match');
    expect(codes(patch(1, { id: 'm1' }))).toContain('duplicate-id');
  });

  it('detects inconsistent times and numbering', () => {
    expect(codes(patch(0, { startMinute: 1 }))).toContain('bad-time');
    expect(codes(patch(0, { slot: -1 }))).toContain('bad-time');
    expect(codes(patch(0, { number: 9 }))).toContain('bad-numbering');
    expect(codes([...generated].reverse())).toContain('bad-numbering');
  });
});
