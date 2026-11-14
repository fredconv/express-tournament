import { describe, expect, it } from 'vitest';
import { addTeams, createDraft, generateTeams } from '../../src/app/draft/model';
import { LIMITS } from '../../src/domain/limits';
import { normalizeName } from '../../src/domain/names';
import { fictionalTeamNames, TEAM_NAME_COUNT } from '../../src/domain/teamNames';

function counterIds() {
  let n = 0;
  return (prefix: string) => `${prefix}${++n}`;
}

describe('fictional team names (SPEC F2)', () => {
  it('offers at least 100 distinct names', () => {
    expect(TEAM_NAME_COUNT).toBeGreaterThanOrEqual(100);
    const all = fictionalTeamNames(TEAM_NAME_COUNT, [], 1);
    expect(new Set(all.map(normalizeName)).size).toBe(TEAM_NAME_COUNT);
  });

  it('15 unique names, different from the existing ones, same seed same list', () => {
    const existing = ['Les Smash Patates', 'les  filets mignons '];
    const names = fictionalTeamNames(15, existing, 7);
    expect(names).toHaveLength(15);
    expect(new Set(names.map(normalizeName)).size).toBe(15);
    expect(names.map(normalizeName)).not.toContain('les smash patates');
    expect(names.map(normalizeName)).not.toContain('les filets mignons');
    expect(fictionalTeamNames(15, existing, 7)).toEqual(names);
    expect(fictionalTeamNames(15, existing, 8)).not.toEqual(names);
  });

  it('stays unique even when the list is exhausted', () => {
    const all = fictionalTeamNames(TEAM_NAME_COUNT, [], 1);
    const more = fictionalTeamNames(5, all, 2);
    expect(more).toHaveLength(5);
    expect(new Set([...all, ...more].map(normalizeName)).size).toBe(TEAM_NAME_COUNT + 5);
  });

  it('compares names with Unicode normalization', () => {
    expect(normalizeName('Les Pélicans')).toBe(normalizeName('Les Pélicans'));
  });
});

describe('generating teams in a tournament (SPEC F2)', () => {
  it('adds 15 teams and keeps the existing ones', () => {
    const ids = counterIds();
    const draft = addTeams(createDraft('2026-06-20', ids, 'now'), 'Toto Team', ids).draft;
    const result = generateTeams(draft, 15, 'add', 3, ids);
    expect(result.added).toBe(15);
    expect(result.draft.teams[0]?.name).toBe('Toto Team');
    expect(result.draft.teams).toHaveLength(16);
  });

  it('never exceeds the team limit', () => {
    const ids = counterIds();
    const draft = createDraft('2026-06-20', ids, 'now');
    const full = generateTeams(draft, 500, 'add', 3, ids).draft;
    expect(full.teams).toHaveLength(LIMITS.maxTeams);
    expect(generateTeams(full, 5, 'add', 4, ids).added).toBe(0);
  });

  it('replace starts again from an empty list and drops locks of removed teams', () => {
    const ids = counterIds();
    let draft = addTeams(createDraft('2026-06-20', ids, 'now'), 'A\nB\nC', ids).draft;
    draft = { ...draft, poolLocks: { [draft.teams[0]?.id as string]: 0 } };
    const replaced = generateTeams(draft, 12, 'replace', 5, ids).draft;
    expect(replaced.teams).toHaveLength(12);
    expect(replaced.teams.map((t) => t.name)).not.toContain('A');
    expect(replaced.poolLocks).toEqual({});
  });
});
