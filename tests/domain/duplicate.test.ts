import { describe, expect, it } from 'vitest';
import { removeFromLibrary, saveToLibrary } from '../../src/app/draft/library';
import {
  addTeams,
  createDraft,
  type Draft,
  duplicateDraft,
  generate,
  generateAfternoon,
  setCourtColor,
  setPoolLock,
  setResult,
  withdrawTeam,
} from '../../src/app/draft/model';
import { publishIssue } from '../../src/app/draft/publish';

function counterIds() {
  let n = 0;
  return (prefix: string) => `${prefix}${++n}`;
}

const WIN = [
  { a: 21, b: 15 },
  { a: 21, b: 17 },
];

/** A finished morning, an afternoon, a forfeit, a lock, a publication: everything to skip. */
function previousEdition(): Draft {
  const ids = counterIds();
  const names = Array.from({ length: 13 }, (_, i) => `Équipe ${i + 1}`).join('\n');
  let d: Draft = {
    ...createDraft('2025-06-21', ids, 'then'),
    name: 'Tournoi loisirs',
    location: 'Plage',
    startTime: '10:00',
    lunchMinutes: 45,
    targetEndTime: '18:00',
    matchFormat: { kind: 'points', setCount: 3, pointsPerSet: 21, mode: 'best-of' },
  };
  d = addTeams(d, names, ids).draft;
  d = setCourtColor(d, d.courts[0]?.id as string, '#ff8800');
  d = setPoolLock(d, d.teams[0]?.id as string, 1);
  d = generate(d, 3);
  d = withdrawTeam(d, d.teams[12]?.id as string);
  for (const m of d.schedule?.matches ?? []) {
    if (!d.results[m.id]) d = setResult(d, m.id, WIN);
  }
  d = generateAfternoon(d);
  return { ...d, publication: { id: 'abcdefghjk', version: 3, key: 'x' } };
}

describe('duplicate a tournament (SPEC F14)', () => {
  it('copies teams and settings, with a recognisable name and today as date', () => {
    const source = previousEdition();
    const copy = duplicateDraft(source, ' — Copie', '2026-06-20', counterIds(), 'now');
    expect(copy.name).toBe('Tournoi loisirs — Copie');
    expect(copy.date).toBe('2026-06-20');
    expect(copy.location).toBe('Plage');
    expect(copy.teams.map((t) => t.name)).toEqual(source.teams.map((t) => t.name));
    expect(copy.courts.map((c) => [c.name, c.color])).toEqual(
      source.courts.map((c) => [c.name, c.color]),
    );
    expect(copy).toMatchObject({
      matchFormat: source.matchFormat,
      startTime: '10:00',
      lunchMinutes: 45,
      targetEndTime: '18:00',
      avoidBackToBack: source.avoidBackToBack,
    });
    // The lock follows the team, under its new id.
    expect(copy.poolLocks).toEqual({ [copy.teams[0]?.id as string]: 1 });
  });

  it('never copies matches, scores, forfeits, withdrawals or publication', () => {
    const copy = duplicateDraft(previousEdition(), ' — Copie', '2026-06-20', counterIds(), 'now');
    expect(copy).toMatchObject({
      schedule: null,
      afternoon: null,
      final: null,
      pools: [],
      results: {},
      drawSeed: null,
      publication: null,
    });
    expect(copy.withdrawn ?? []).toEqual([]);
    expect(publishIssue(copy)).toBe('not-generated');
  });

  it('creates an independent tournament and leaves the original untouched', () => {
    const source = previousEdition();
    const before = JSON.stringify(source);
    let n = 0;
    const ids = (prefix: string) => `${prefix}new${++n}`;
    let copy = duplicateDraft(source, ' — Copie', '2026-06-20', ids, 'now');
    expect(copy.id).not.toBe(source.id);
    const sourceIds = new Set([...source.teams, ...source.courts].map((x) => x.id));
    expect([...copy.teams, ...copy.courts].some((x) => sourceIds.has(x.id))).toBe(false);
    copy = addTeams(copy, 'Nouvelle équipe', ids).draft;
    copy = generate(copy, 9);
    expect(JSON.stringify(source)).toBe(before);
    expect(copy.teams).toHaveLength(14);
  });

  it('works when some teams were deleted from the library since', () => {
    const ids = counterIds();
    const source = previousEdition();
    let library = saveToLibrary(
      [],
      source.teams.map((t) => t.name),
      ids,
    ).library;
    library = removeFromLibrary(
      library,
      library.slice(0, 5).map((t) => t.id),
    );
    const copy = duplicateDraft(source, ' — Copie', '2026-06-20', ids, 'now');
    expect(copy.teams).toHaveLength(13);
    expect(library).toHaveLength(8);
  });
});
