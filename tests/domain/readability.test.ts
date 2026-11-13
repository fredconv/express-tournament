import { describe, expect, it } from 'vitest';
import { createDraft, setCourtColor, setCourtCount } from '../../src/app/draft/model';
import { consecutiveTeams } from '../../src/domain/consecutive';
import {
  COURT_PALETTE,
  contrastRatio,
  courtColor,
  defaultCourtColor,
  textColorOn,
} from '../../src/domain/courtColors';
import { courtSchema } from '../../src/domain/schemas';
import type { ScheduledMatch } from '../../src/domain/types';
import { schedule } from './helpers';

describe('court colors (SPEC F13)', () => {
  it('palette colors are distinct and keep AA contrast with white text', () => {
    expect(new Set(COURT_PALETTE).size).toBe(COURT_PALETTE.length);
    for (const color of COURT_PALETTE) {
      expect(contrastRatio(color, '#ffffff'), color).toBeGreaterThanOrEqual(4.5);
      expect(textColorOn(color)).toBe('#ffffff');
    }
  });

  it('chooses dark text on light custom colors', () => {
    expect(textColorOn('#ffd43b')).toBe('#000000');
    expect(contrastRatio('#ffd43b', textColorOn('#ffd43b'))).toBeGreaterThanOrEqual(4.5);
  });

  it('assigns a color to every court and lets the organizer change it', () => {
    let n = 0;
    const ids = (prefix: string) => `${prefix}${++n}`;
    const draft = setCourtCount(createDraft('2026-06-20', ids, 'now'), 6, ids);
    expect(draft.courts.map((c) => c.color)).toEqual([...COURT_PALETTE]);
    const id = draft.courts[0]?.id as string;
    expect(setCourtColor(draft, id, '#ff8800').courts[0]?.color).toBe('#ff8800');
    expect(setCourtColor(draft, id, 'red').courts[0]?.color).toBe(COURT_PALETTE[0]);
  });

  it('falls back to the palette for courts saved without a color', () => {
    expect(courtColor({}, 2)).toBe(defaultCourtColor(2));
    expect(courtColor({ color: 'nope' }, 0)).toBe(COURT_PALETTE[0]);
    expect(courtSchema.safeParse({ id: 'c1', name: 'T1', color: 'javascript:' }).success).toBe(
      false,
    );
    expect(courtSchema.safeParse({ id: 'c1', name: 'T1' }).success).toBe(true);
  });
});

describe('consecutive matches (SPEC F13)', () => {
  const match = (id: string, slot: number, a: string, b: string): ScheduledMatch => ({
    id,
    poolId: 'P1',
    number: 1,
    slot,
    courtId: 'c1',
    teamAId: a,
    teamBId: b,
    startMinute: slot * 25,
    endMinute: slot * 25 + 20,
  });

  it('marks both matches of a team playing two slots in a row, for every team concerned', () => {
    const marks = consecutiveTeams([
      match('m1', 0, 'A', 'B'),
      match('m2', 0, 'C', 'D'),
      match('m3', 1, 'A', 'C'),
      match('m4', 2, 'B', 'D'),
      match('m5', 3, 'B', 'C'),
    ]);
    expect(marks.get('m1')).toEqual(['A']);
    expect(marks.get('m2')).toEqual(['C']);
    expect(marks.get('m3')).toEqual(['A', 'C']);
    expect(marks.get('m4')).toEqual(['B']);
    expect(marks.get('m5')).toEqual(['B']);
  });

  it('agrees with the engine back-to-back warnings', () => {
    const result = schedule(8, 3);
    const marks = consecutiveTeams(result.matches);
    for (const w of result.warnings) {
      if (w.kind !== 'back-to-back') continue;
      for (const team of w.teamIds) {
        const m = result.matches.find(
          (x) => x.slot === w.slot && (x.teamAId === team || x.teamBId === team),
        ) as ScheduledMatch;
        expect(marks.get(m.id)).toContain(team);
      }
    }
  });

  it('marks nothing when every team rests between its matches', () => {
    expect(consecutiveTeams([match('m1', 0, 'A', 'B'), match('m2', 2, 'A', 'B')]).size).toBe(0);
  });
});
