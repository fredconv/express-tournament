import { describe, expect, it } from 'vitest';
import { describeFormat } from '../../src/app/draft/labels';
import {
  addTeams,
  createDraft,
  type Draft,
  draftIssues,
  generate,
  isScheduleStale,
  removeTeam,
  renameTeam,
  resetSlotMinutes,
  scheduleInputOf,
  setCourtCount,
  setMatchFormat,
  setSlotMinutes,
} from '../../src/app/draft/model';
import { createDraftStore, type KeyValueStore } from '../../src/client/storage';

function counterIds() {
  let n = 0;
  return (prefix: string) => `${prefix}${++n}`;
}

function draftWithTeams(count: number): Draft {
  const ids = counterIds();
  const names = Array.from({ length: count }, (_, i) => `Équipe ${i + 1}`).join('\n');
  const base = { ...createDraft('2026-12-05', ids, '2026-11-12T10:00:00Z'), name: 'Test' };
  return addTeams(base, names, ids).draft;
}

describe('draft teams (SPEC F2)', () => {
  it('CA2.1: pasting lines adds one team per non-empty line', () => {
    const ids = counterIds();
    const draft = createDraft('2026-12-05', ids, 'now');
    const text = 'A\n\n  B  \r\nC\n\n\nD\nE\nF\nG\nH\nI\nJ';
    const result = addTeams(draft, text, ids);
    expect(result.added).toBe(10);
    expect(result.draft.teams.map((t) => t.name)).toEqual('ABCDEFGHIJ'.split(''));
  });

  it('CA2.2: duplicate names are rejected with a reason', () => {
    const ids = counterIds();
    const draft = addTeams(createDraft('2026-12-05', ids, 'now'), 'Les Aigles', ids).draft;
    const result = addTeams(draft, 'les  aigles\nNouveaux\nNouveaux', ids);
    expect(result.added).toBe(1);
    expect(result.rejected).toEqual([
      { name: 'les aigles', issue: 'duplicate' },
      { name: 'Nouveaux', issue: 'duplicate' },
    ]);
  });

  it('rejects names that are too long and teams beyond 32', () => {
    const ids = counterIds();
    const full = draftWithTeams(32);
    const result = addTeams(full, `${'x'.repeat(41)}\nEncore une`, ids);
    expect(result.rejected.map((r) => r.issue)).toEqual(['too-long', 'too-many']);
    expect(result.draft.teams).toHaveLength(32);
  });

  it('renames and removes teams', () => {
    const draft = draftWithTeams(3);
    const id = draft.teams[0]?.id as string;
    expect(renameTeam(draft, id, '  Les   Pros ').teams[0]?.name).toBe('Les Pros');
    expect(removeTeam(draft, id).teams).toHaveLength(2);
  });
});

describe('draft settings (SPEC F3)', () => {
  it('keeps court count within 1–6 and names new courts', () => {
    const ids = counterIds();
    const draft = createDraft('2026-12-05', ids, 'now');
    expect(setCourtCount(draft, 4, ids).courts.map((c) => c.name)).toEqual([
      'Terrain 1',
      'Terrain 2',
      'Terrain 3',
      'Terrain 4',
    ]);
    expect(setCourtCount(draft, 0, ids).courts).toHaveLength(1);
    expect(setCourtCount(draft, 40, ids).courts).toHaveLength(6);
  });

  it('follows the suggested slot length until the organizer overrides it', () => {
    const draft = draftWithTeams(4);
    expect(draft.slotMinutes).toBe(22);
    const points = setMatchFormat(draft, {
      kind: 'points',
      setCount: 2,
      pointsPerSet: 25,
      mode: 'all-sets',
    });
    expect(points.slotMinutes).toBe(42);
    const custom = setSlotMinutes(points, 30);
    expect(
      setMatchFormat(custom, { kind: 'time', setCount: 1, minutesPerSet: 15 }).slotMinutes,
    ).toBe(30);
    expect(resetSlotMinutes(custom).slotMinutes).toBe(42);
  });

  it('describes formats in French', () => {
    expect(describeFormat({ kind: 'time', setCount: 2, minutesPerSet: 10 })).toBe(
      '2 sets de 10 min',
    );
    expect(describeFormat({ kind: 'time', setCount: 1, minutesPerSet: 15 })).toBe(
      '1 set de 15 min',
    );
    expect(
      describeFormat({
        kind: 'points',
        setCount: 3,
        pointsPerSet: 25,
        mode: 'best-of',
        decidingSetPoints: 15,
      }),
    ).toBe('2 sets gagnants de 25 pts, dernier set à 15 pts');
  });
});

describe('draft generation (SPEC F4, CA2.3)', () => {
  it('lists blocking issues', () => {
    const ids = counterIds();
    const empty = createDraft('2026-12-05', ids, 'now');
    expect(draftIssues(empty)).toEqual(['name-missing', 'not-enough-teams']);
    expect(draftIssues({ ...draftWithTeams(4), startTime: '' })).toContain('invalid-start-time');
    expect(draftIssues({ ...draftWithTeams(4), targetEndTime: '25:00' })).toContain(
      'invalid-target-end',
    );
  });

  it('builds the engine input from the draft', () => {
    const input = scheduleInputOf({ ...draftWithTeams(4), targetEndTime: '12:30' });
    expect(input).toMatchObject({ startMinute: 540, slotMinutes: 22, targetEndMinute: 750 });
    expect(input.teamIds).toHaveLength(4);
  });

  it('CA2.3: any change to teams or settings marks the schedule stale', () => {
    const ids = counterIds();
    const generated = generate(draftWithTeams(6));
    expect(generated.schedule?.matches).toHaveLength(15);
    expect(isScheduleStale(generated)).toBe(false);
    expect(isScheduleStale({ ...generated, name: 'Autre nom' })).toBe(false);
    expect(isScheduleStale(addTeams(generated, 'Nouvelle', ids).draft)).toBe(true);
    expect(isScheduleStale(setCourtCount(generated, 3, ids))).toBe(true);
    expect(isScheduleStale({ ...generated, startTime: '10:00' })).toBe(true);
    expect(isScheduleStale(removeTeam(generated, generated.teams[0]?.id as string))).toBe(true);
  });

  it('refuses to generate an incomplete draft', () => {
    expect(() => generate(draftWithTeams(1))).toThrow();
  });
});

describe('draft storage (CA1.2, CA1.3)', () => {
  function memoryStore(): KeyValueStore & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
    };
  }

  it('persists drafts across store instances (reopening the browser)', () => {
    const backing = memoryStore();
    const draft = draftWithTeams(3);
    createDraftStore(backing).save(draft);
    const reopened = createDraftStore(backing);
    expect(reopened.get(draft.id)).toEqual(draft);
    expect(reopened.list()).toHaveLength(1);
    reopened.remove(draft.id);
    expect(createDraftStore(backing).list()).toEqual([]);
  });

  it('lists the most recently edited draft first', () => {
    const store = createDraftStore(memoryStore());
    store.save({ ...draftWithTeams(2), id: 'old', updatedAt: '2026-01-01T00:00:00Z' });
    store.save({ ...draftWithTeams(2), id: 'new', updatedAt: '2026-06-01T00:00:00Z' });
    expect(store.list().map((d) => d.id)).toEqual(['new', 'old']);
  });

  it('survives corrupted storage and works without storage', () => {
    const backing = memoryStore();
    backing.data.set('et:drafts:v1', '{not json');
    expect(createDraftStore(backing).list()).toEqual([]);
    const volatile = createDraftStore(null);
    expect(volatile.persistent).toBe(false);
    volatile.save(draftWithTeams(2));
    expect(volatile.list()).toHaveLength(1);
  });
});
