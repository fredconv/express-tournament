import { describe, expect, it } from 'vitest';
import {
  addTeams,
  canGenerateAfternoon,
  createDraft,
  type Draft,
  dayMatches,
  duplicateDraft,
  generate,
  generateAfternoon,
  setResult,
} from '../../src/app/draft/model';
import { toDoc } from '../../src/app/draft/publish';
import {
  createTestDraft,
  resetSimulated,
  simulatePhase,
  simulateToEnd,
  simulationIssue,
} from '../../src/app/draft/simulation';
import { tournamentDocSchema } from '../../src/domain/schemas';
import { type MatchResult, outcome, scoreIssue } from '../../src/domain/scores';
import { matchRandom, simulateScore } from '../../src/domain/simulate';
import { overallRanking } from '../../src/domain/standings';
import type { MatchFormat } from '../../src/domain/types';

function counterIds() {
  let n = 0;
  return (prefix: string) => `${prefix}${++n}`;
}

const FORMATS: MatchFormat[] = [
  { kind: 'time', setCount: 2, minutesPerSet: 10 },
  { kind: 'time', setCount: 1, minutesPerSet: 15 },
  { kind: 'points', setCount: 3, pointsPerSet: 21, mode: 'best-of', decidingSetPoints: 15 },
  // 15 points: 15 teams on 2 courts at 25 points would run past midnight (refused by the server).
  { kind: 'points', setCount: 5, pointsPerSet: 15, mode: 'best-of' },
  { kind: 'points', setCount: 2, pointsPerSet: 21, mode: 'all-sets' },
  { kind: 'points', setCount: 3, pointsPerSet: 15, mode: 'all-sets' },
];

function testTournament(format?: MatchFormat): Draft {
  const ids = counterIds();
  const draft = createTestDraft('Tournoi de test', '2026-06-20', ids, 'now', 7);
  return generate(format ? { ...draft, matchFormat: format } : draft, 3);
}

const OPTIONS = { mode: 'random', seed: 42 } as const;
const winnerOf = (draft: Draft, matchId: string) =>
  outcome(draft.results[matchId] as MatchResult).winner;

describe('simulated scores (SPEC F15)', () => {
  it('always follow the match format, final included', () => {
    for (const format of FORMATS) {
      for (let i = 0; i < 200; i++) {
        for (const needsWinner of [false, true]) {
          const sets = simulateScore(
            { format, needsWinner, strengthA: 0.5, strengthB: 0.5 },
            i % 2 === 0 ? 'random' : 'favorites',
            matchRandom(i, `m${i}`),
          );
          expect(scoreIssue(sets, format, needsWinner), JSON.stringify(format)).toBeNull();
          if (needsWinner) expect(outcome(sets).winner).not.toBeNull();
          if (format.kind === 'points' && format.mode === 'best-of') {
            const high = (s: { a: number; b: number }) => Math.max(s.a, s.b);
            expect(sets.slice(0, -1).every((s) => high(s) === format.pointsPerSet)).toBe(true);
          }
        }
      }
    }
  });

  it('are reproducible with a seed, and differ with another seed', () => {
    const a = simulatePhase(testTournament(), 'morning', OPTIONS);
    const b = simulatePhase(testTournament(), 'morning', OPTIONS);
    const c = simulatePhase(testTournament(), 'morning', { ...OPTIONS, seed: 43 });
    if (!('draft' in a) || !('draft' in b) || !('draft' in c)) throw new Error('fixture');
    expect(a.draft.results).toEqual(b.draft.results);
    expect(a.draft.results).not.toEqual(c.draft.results);
  });

  it('favorites mode makes the first teams of the list win most matches', () => {
    const draft = testTournament();
    const result = simulatePhase(draft, 'morning', { mode: 'favorites', seed: 1 });
    if (!('draft' in result)) throw new Error('fixture');
    const order = new Map(draft.teams.map((t, i) => [t.id, i]));
    let expected = 0;
    let decided = 0;
    for (const m of result.draft.schedule?.matches ?? []) {
      const winner = winnerOf(result.draft, m.id);
      if (winner === null) continue;
      decided++;
      const favorite = (order.get(m.teamAId) ?? 0) < (order.get(m.teamBId) ?? 0) ? 'a' : 'b';
      if (winner === favorite) expected++;
    }
    expect(expected / decided).toBeGreaterThan(0.7);
  });
});

describe('simulating a test tournament phase by phase (SPEC F15)', () => {
  it('morning, afternoon then final through the normal transitions and rankings', () => {
    let draft = testTournament();
    expect(draft.teams).toHaveLength(15);
    expect(simulationIssue(draft, 'afternoon')).toBe('no-phase');

    const morning = simulatePhase(draft, 'morning', OPTIONS);
    if (!('draft' in morning)) throw new Error(morning.issue);
    draft = morning.draft;
    expect(morning.filled).toBe(draft.schedule?.matches.length);
    expect(simulationIssue(draft, 'morning')).toBe('complete');
    expect(canGenerateAfternoon(draft)).toBe(true);

    draft = generateAfternoon(draft);
    // The top afternoon pool holds the best teams of the real morning ranking.
    const ranking = overallRanking(draft.pools, draft.schedule?.matches ?? [], draft.results);
    const top = draft.afternoon?.pools[0]?.teamIds ?? [];
    expect([...top].sort()).toEqual(ranking.slice(0, top.length).sort());

    const afternoon = simulatePhase(draft, 'afternoon', OPTIONS);
    if (!('draft' in afternoon)) throw new Error(afternoon.issue);
    draft = afternoon.draft;

    const end = simulateToEnd(draft, OPTIONS);
    expect(end.stop).toBeNull();
    expect(end.reached).toBe('final');
    const final = end.draft.final?.schedule.matches[0];
    if (!final) throw new Error('no final');
    expect(winnerOf(end.draft, final.id)).not.toBeNull();
    expect(tournamentDocSchema.safeParse(toDoc(end.draft)).success).toBe(true);
  });

  it('simulates to the end in one go, for every format', () => {
    for (const format of FORMATS) {
      const end = simulateToEnd(testTournament(format), OPTIONS);
      expect(end.stop, JSON.stringify(format)).toBeNull();
      expect(dayMatches(end.draft).every((m) => end.draft.results[m.id] !== undefined)).toBe(true);
      expect(tournamentDocSchema.safeParse(toDoc(end.draft)).success).toBe(true);
    }
  });

  it('refuses a missing phase and stops before a missing morning', () => {
    const draft = createTestDraft('T', '2026-06-20', counterIds(), 'now', 1);
    expect(simulatePhase(draft, 'morning', OPTIONS)).toEqual({ issue: 'no-phase' });
    expect(simulateToEnd(draft, OPTIONS)).toMatchObject({ stop: 'no-morning', reached: null });
  });

  it('stops on a stale afternoon instead of regenerating it', () => {
    let draft = simulateToEnd(testTournament(), OPTIONS).draft;
    const first = draft.schedule?.matches[0]?.id as string;
    const current = draft.results[first] as { a: number; b: number }[];
    draft = setResult(
      draft,
      first,
      current.map((s) => ({ a: s.b, b: s.a })),
    );
    const before = JSON.stringify(draft.afternoon);
    const end = simulateToEnd(draft, OPTIONS);
    expect(end.stop).toBe('stale');
    expect(end.reached).toBe('morning');
    expect(JSON.stringify(end.draft.afternoon)).toBe(before);
  });
});

describe('protecting real tournaments and manual scores (SPEC F15)', () => {
  it('never touches a tournament that is not a test one', () => {
    const ids = counterIds();
    const names = Array.from({ length: 13 }, (_, i) => `Équipe ${i + 1}`).join('\n');
    const real = generate(addTeams(createDraft('2026-06-20', ids, 'now'), names, ids).draft, 3);
    expect(simulatePhase(real, 'morning', OPTIONS)).toEqual({ issue: 'not-test' });
    expect(simulateToEnd(real, OPTIONS)).toMatchObject({ draft: real, stop: 'not-test' });
    // Duplicating a real tournament never makes a test one; a test copy stays a test.
    expect(duplicateDraft(real, ' — Copie', '2026-06-21', ids, 'now').test).toBeUndefined();
    expect(duplicateDraft(testTournament(), ' — Copie', '2026-06-21', ids, 'now').test).toBe(true);
  });

  it('keeps manual scores: not overwritten, not reset', () => {
    let draft = testTournament();
    const [manual, edited] = draft.schedule?.matches ?? [];
    if (!manual || !edited) throw new Error('fixture');
    const typed = [
      { a: 3, b: 1 },
      { a: 2, b: 5 },
    ];
    draft = setResult(draft, manual.id, typed);
    const simulated = simulatePhase(draft, 'morning', OPTIONS);
    if (!('draft' in simulated)) throw new Error(simulated.issue);
    draft = simulated.draft;
    expect(draft.results[manual.id]).toEqual(typed);
    expect(draft.simulated).not.toContain(manual.id);

    // A simulated score corrected by hand becomes a manual one.
    const corrected = [
      { a: 9, b: 8 },
      { a: 9, b: 8 },
    ];
    draft = setResult(draft, edited.id, corrected);
    const { draft: reset, removed } = resetSimulated(draft);
    expect(reset.results[manual.id]).toEqual(typed);
    expect(reset.results[edited.id]).toEqual(corrected);
    expect(removed).toBe((draft.schedule?.matches.length ?? 0) - 2);
    expect(Object.keys(reset.results)).toHaveLength(2);
  });
});
