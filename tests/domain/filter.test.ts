import { describe, expect, it } from 'vitest';
import {
  addTeams,
  createDraft,
  filteredMatchCount,
  generate,
  setCourtCount,
} from '../../src/app/draft/model';
import { backToBackLinks } from '../../src/domain/consecutive';
import {
  filterMatches,
  isFiltered,
  NO_FILTER,
  revealFilter,
  sanitizeFilter,
} from '../../src/domain/filter';

function day() {
  let n = 0;
  const ids = (prefix: string) => `${prefix}${++n}`;
  let draft = setCourtCount(createDraft('2026-06-20', ids, 'now'), 3, ids);
  const names = Array.from({ length: 13 }, (_, i) => `Équipe ${i + 1}`).join('\n');
  draft = addTeams(draft, names, ids).draft;
  draft = generate(draft, 4);
  const matches = draft.schedule?.matches ?? [];
  return { draft, matches };
}

describe('planning filter by team and court (SPEC F6)', () => {
  it('shows everything without a filter', () => {
    const { matches } = day();
    expect(isFiltered(NO_FILTER)).toBe(false);
    expect(filterMatches(matches, NO_FILTER)).toEqual(matches);
  });

  it('filters by court alone, by team alone, and combines both with AND', () => {
    const { draft, matches } = day();
    const court = draft.courts[1]?.id as string;
    const team = draft.teams[0]?.id as string;
    const byCourt = filterMatches(matches, { teamId: null, courtId: court });
    expect(byCourt.length).toBeGreaterThan(0);
    expect(byCourt.every((m) => m.courtId === court)).toBe(true);
    const byTeam = filterMatches(matches, { teamId: team, courtId: null });
    expect(byTeam.every((m) => m.teamAId === team || m.teamBId === team)).toBe(true);
    const both = filterMatches(matches, { teamId: team, courtId: court });
    expect(both).toEqual(byTeam.filter((m) => m.courtId === court));
    expect(filteredMatchCount(draft, { teamId: team, courtId: court })).toBe(both.length);
  });

  it('returns no match when the team never plays on that court', () => {
    const { draft, matches } = day();
    const team = draft.teams[0]?.id as string;
    const unused = draft.courts.find(
      (c) => !matches.some((m) => m.courtId === c.id && (m.teamAId === team || m.teamBId === team)),
    );
    if (!unused) throw new Error('fixture: team plays on every court');
    expect(filterMatches(matches, { teamId: team, courtId: unused.id })).toEqual([]);
  });

  it('keeps back-to-back links computed on the full schedule', () => {
    const { matches } = day();
    const full = backToBackLinks(matches);
    const linked = matches.find((m) => (full.get(m.id) ?? []).length > 0);
    if (!linked) throw new Error('fixture: no back-to-back');
    const filter = { teamId: null, courtId: linked.courtId };
    // The view filters the cards but keeps the links of the whole phase.
    expect(filterMatches(matches, filter)).toContain(linked);
    expect(full.get(linked.id)?.length).toBeGreaterThan(0);
  });

  it('reveals a hidden match with the smallest change', () => {
    const { draft, matches } = day();
    const team = draft.teams[0]?.id as string;
    const own = matches.find((m) => m.teamAId === team || m.teamBId === team);
    const other = matches.find((m) => m.teamAId !== team && m.teamBId !== team);
    if (!own || !other) throw new Error('fixture');
    const otherCourt = draft.courts.find((c) => c.id !== own.courtId)?.id as string;
    // Team kept, court dropped.
    expect(revealFilter(own, { teamId: team, courtId: otherCourt })).toEqual({
      teamId: team,
      courtId: null,
    });
    // Another team's match: everything shown.
    expect(revealFilter(other, { teamId: team, courtId: null })).toEqual(NO_FILTER);
    // Already visible: unchanged.
    const visible = { teamId: team, courtId: own.courtId };
    expect(revealFilter(own, visible)).toBe(visible);
  });

  it('ignores a removed court or team', () => {
    expect(sanitizeFilter({ teamId: 'gone', courtId: 'c2' }, ['t1'], ['c1', 'c2'])).toEqual({
      teamId: null,
      courtId: 'c2',
    });
    expect(sanitizeFilter({ teamId: 't1', courtId: 'c9' }, ['t1'], ['c1'])).toEqual({
      teamId: 't1',
      courtId: null,
    });
  });
});
