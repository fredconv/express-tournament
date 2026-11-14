import { describe, expect, it } from 'vitest';
import {
  libraryHas,
  removeFromLibrary,
  renameInLibrary,
  saveToLibrary,
  searchLibrary,
} from '../../src/app/draft/library';
import {
  addTeams,
  createDraft,
  type Draft,
  generate,
  generateTeams,
  setResult,
} from '../../src/app/draft/model';
import { toDoc } from '../../src/app/draft/publish';
import { createLibraryStore, type KeyValueStore } from '../../src/client/storage';
import { poolStandings } from '../../src/domain/standings';

function counterIds() {
  let n = 0;
  return (prefix: string) => `${prefix}${++n}`;
}

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('team library (SPEC F14)', () => {
  it('saves one or several teams without duplicates (case, spaces, Unicode)', () => {
    const ids = counterIds();
    const one = saveToLibrary([], ['Toto Team'], ids);
    expect(one.added).toEqual(['Toto Team']);
    const many = saveToLibrary(
      one.library,
      ['  toto   TEAM ', 'Les Pélicans', 'Les Pélicans', 'Smash Bros', ''],
      ids,
    );
    expect(many.added).toEqual(['Les Pélicans', 'Smash Bros']);
    expect(many.skipped).toEqual(['toto TEAM', 'Les Pélicans']);
    expect(many.library).toHaveLength(3);
    expect(libraryHas(many.library, 'SMASH bros')).toBe(true);
  });

  it('searches by part of the name, ignoring case and accents, sorted', () => {
    const lib = saveToLibrary(
      [],
      ['Les Écureuils', 'Les Requins', 'Smash Bros', 'Les Ecrans'],
      counterIds(),
    ).library;
    expect(searchLibrary(lib, 'ecu').map((t) => t.name)).toEqual(['Les Écureuils']);
    expect(searchLibrary(lib, 'LES').map((t) => t.name)).toEqual([
      'Les Ecrans',
      'Les Écureuils',
      'Les Requins',
    ]);
    expect(searchLibrary(lib, '')).toHaveLength(4);
  });

  it('renames with conflict checks, deletes one or several', () => {
    const lib = saveToLibrary([], ['A', 'B', 'C'], counterIds()).library;
    const [a, b, c] = lib;
    expect(renameInLibrary(lib, a?.id as string, 'b')).toEqual({ issue: 'duplicate' });
    expect(renameInLibrary(lib, a?.id as string, '  ')).toEqual({ issue: 'empty' });
    const renamed = renameInLibrary(lib, a?.id as string, 'Alpha');
    expect('library' in renamed && renamed.library[0]?.name).toBe('Alpha');
    expect(removeFromLibrary(lib, [b?.id as string]).map((t) => t.name)).toEqual(['A', 'C']);
    expect(removeFromLibrary(lib, [a?.id as string, c?.id as string]).map((t) => t.name)).toEqual([
      'B',
    ]);
  });

  it('is kept per device: two stores never see each other, and it survives a reload', () => {
    const deviceA = memoryStore();
    const storeA = createLibraryStore(deviceA);
    storeA.save(saveToLibrary([], ['Toto Team'], counterIds()).library);
    expect(
      createLibraryStore(deviceA)
        .list()
        .map((t) => t.name),
    ).toEqual(['Toto Team']);
    expect(createLibraryStore(memoryStore()).list()).toEqual([]);
  });

  it('is never part of a published tournament', () => {
    const ids = counterIds();
    const lib = saveToLibrary([], ['Secret Library Team'], ids).library;
    let draft = addTeams(
      { ...createDraft('2026-06-20', ids, 'now'), name: 'T' },
      'A\nB\nC\nD',
      ids,
    ).draft;
    draft = generate(draft, 1);
    expect(JSON.stringify(toDoc(draft))).not.toContain(lib[0]?.name);
  });

  it('generated teams are never saved automatically', () => {
    const ids = counterIds();
    const draft = generateTeams(createDraft('2026-06-20', ids, 'now'), 15, 'add', 1, ids).draft;
    const store = createLibraryStore(memoryStore());
    expect(draft.teams).toHaveLength(15);
    expect(store.list()).toEqual([]);
  });
});

describe('library and tournament history (SPEC F14)', () => {
  function playedFrom(names: string[]): Draft {
    const ids = counterIds();
    let draft = addTeams(
      { ...createDraft('2026-06-20', ids, 'now'), name: 'Édition 1' },
      names.join('\n'),
      ids,
    ).draft;
    draft = generate(draft, 2);
    for (const m of draft.schedule?.matches ?? []) {
      draft = setResult(draft, m.id, [
        { a: 21, b: 15 },
        { a: 21, b: 18 },
      ]);
    }
    return draft;
  }

  it('renaming or deleting a library team never changes a tournament, its scores or rankings', () => {
    const ids = counterIds();
    let lib = saveToLibrary(
      [],
      ['Toto Team', 'Les Requins', 'Smash Bros', 'Les Dauphins'],
      ids,
    ).library;
    const tournament = playedFrom(lib.map((t) => t.name));
    const before = JSON.stringify(tournament);
    const rankingBefore = poolStandings(
      tournament.pools[0] as Draft['pools'][number],
      tournament.schedule?.matches ?? [],
      tournament.results,
    );

    const toto = lib.find((t) => t.name === 'Toto Team') as { id: string };
    const renamed = renameInLibrary(lib, toto.id, 'Toto Team 2026');
    lib = 'library' in renamed ? renamed.library : lib;
    lib = removeFromLibrary(lib, [toto.id]);

    expect(JSON.stringify(tournament)).toBe(before);
    expect(tournament.teams.map((t) => t.name)).toContain('Toto Team');
    expect(
      poolStandings(
        tournament.pools[0] as Draft['pools'][number],
        tournament.schedule?.matches ?? [],
        tournament.results,
      ),
    ).toEqual(rankingBefore);
  });
});
