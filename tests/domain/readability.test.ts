import { describe, expect, it } from 'vitest';
import { createDraft, setCourtColor, setCourtCount } from '../../src/app/draft/model';
import { backToBackLinks, forbiddenRuns } from '../../src/domain/consecutive';
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

describe('back-to-back links (SPEC F13)', () => {
  const match = (
    id: string,
    slot: number,
    a: string,
    b: string,
    courtId = 'c1',
  ): ScheduledMatch => ({
    id,
    poolId: 'P1',
    number: Number(id.slice(1)),
    slot,
    courtId,
    teamAId: a,
    teamBId: b,
    startMinute: 600 + slot * 27,
    endMinute: 600 + slot * 27 + 22,
  });
  const summary = (links: ReturnType<typeof backToBackLinks>, id: string) =>
    (links.get(id) ?? []).map((l) => `${l.teamId}:${l.direction}:${l.other.id}`);

  it('one team: orange on the first match, red on the second, with the other match', () => {
    const links = backToBackLinks([match('m1', 0, 'A', 'B'), match('m2', 1, 'A', 'C', 'c4')]);
    expect(summary(links, 'm1')).toEqual(['A:next:m2']);
    expect(summary(links, 'm2')).toEqual(['A:previous:m1']);
    expect(links.get('m1')?.[0]?.other).toMatchObject({ courtId: 'c4', startMinute: 627 });
  });

  it('both teams of a match: one badge per team (Sans Pression / Balles à Zéro case)', () => {
    const links = backToBackLinks([
      match('m13', 0, 'VolleyDingues', 'SansPression', 'c1'),
      match('m14', 0, 'Manchettes', 'BallesAZero', 'c2'),
      match('m20', 1, 'SansPression', 'BallesAZero', 'c4'),
    ]);
    expect(summary(links, 'm13')).toEqual(['SansPression:next:m20']);
    expect(summary(links, 'm14')).toEqual(['BallesAZero:next:m20']);
    expect(summary(links, 'm20')).toEqual([
      'SansPression:previous:m13',
      'BallesAZero:previous:m14',
    ]);
  });

  it('a run of three would show both states on the middle match, and is detected as forbidden', () => {
    const run = [match('m1', 0, 'A', 'B'), match('m2', 1, 'A', 'C'), match('m3', 2, 'A', 'D')];
    expect(summary(backToBackLinks(run), 'm2')).toEqual(['A:previous:m1', 'A:next:m3']);
    expect(forbiddenRuns(run)).toEqual(['A']);
    expect(forbiddenRuns(run.slice(0, 2))).toEqual([]);
  });

  it('uses real time order, not match numbers', () => {
    const links = backToBackLinks([match('m9', 1, 'A', 'B'), match('m2', 0, 'A', 'C')]);
    expect(summary(links, 'm2')).toEqual(['A:next:m9']);
    expect(summary(links, 'm9')).toEqual(['A:previous:m2']);
  });

  it('no link when every team rests between its matches', () => {
    expect(backToBackLinks([match('m1', 0, 'A', 'B'), match('m2', 2, 'A', 'B')]).size).toBe(0);
  });

  it('agrees with the engine warnings and never sees a forbidden run in generated schedules', () => {
    for (const [teams, courts] of [
      [8, 3],
      [13, 3],
      [16, 4],
    ] as const) {
      const result = schedule(teams, courts);
      const links = backToBackLinks(result.matches);
      for (const w of result.warnings) {
        if (w.kind !== 'back-to-back') continue;
        for (const team of w.teamIds) {
          const m = result.matches.find(
            (x) => x.slot === w.slot && (x.teamAId === team || x.teamBId === team),
          ) as ScheduledMatch;
          expect(summary(links, m.id).some((s) => s.startsWith(`${team}:previous`))).toBe(true);
        }
      }
      expect(forbiddenRuns(result.matches), `${teams}/${courts}`).toEqual([]);
    }
  });
});
