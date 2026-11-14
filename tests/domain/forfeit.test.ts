import { describe, expect, it } from 'vitest';
import {
  addTeams,
  canGenerateAfternoon,
  createDraft,
  type Draft,
  generate,
  generateAfternoon,
  generateFinal,
  isAfternoonStale,
  reinstateTeam,
  setForfeit,
  setResult,
  withdrawTeam,
} from '../../src/app/draft/model';
import { toDoc } from '../../src/app/draft/publish';
import { tournamentDocSchema } from '../../src/domain/schemas';
import { forfeitBy, isForfeit, outcome } from '../../src/domain/scores';
import { poolStandings } from '../../src/domain/standings';
import type { ScheduledMatch } from '../../src/domain/types';

const WIN = [
  { a: 21, b: 15 },
  { a: 21, b: 17 },
];

function day13(): Draft {
  let n = 0;
  const ids = (prefix: string) => `${prefix}${++n}`;
  const names = Array.from({ length: 13 }, (_, i) => `Équipe ${i + 1}`).join('\n');
  const base = { ...createDraft('2026-06-20', ids, 'now'), name: 'Beach' };
  return generate(addTeams(base, names, ids).draft, 4);
}

function playAll(draft: Draft, matches: readonly ScheduledMatch[]): Draft {
  return matches.reduce((d, m) => (d.results[m.id] ? d : setResult(d, m.id, WIN)), draft);
}

const isTeamIn = (m: ScheduledMatch, team: string) => m.teamAId === team || m.teamBId === team;

describe('forfeit (SPEC F11)', () => {
  it('the other team wins the sets needed, no points either way', () => {
    const format = { kind: 'time', setCount: 2, minutesPerSet: 10 } as const;
    expect(outcome(forfeitBy('a', format))).toEqual({
      setsA: 0,
      setsB: 2,
      pointsA: 0,
      pointsB: 0,
      winner: 'b',
    });
    const bestOf3 = { kind: 'points', setCount: 3, pointsPerSet: 21, mode: 'best-of' } as const;
    expect(forfeitBy('b', bestOf3)).toEqual({ forfeit: 'b', sets: 2 });
  });

  it('counts as a loss with 0 ranking points and keeps point differences unchanged', () => {
    let day = day13();
    const morning = day.schedule as NonNullable<Draft['schedule']>;
    const match = morning.matches[0] as ScheduledMatch;
    day = setForfeit(day, match.id, 'a');
    const pool = day.pools.find((p) => p.id === match.poolId) as Draft['pools'][number];
    const rows = poolStandings(pool, morning.matches, day.results);
    const loser = rows.find((r) => r.teamId === match.teamAId);
    const winner = rows.find((r) => r.teamId === match.teamBId);
    expect(loser).toMatchObject({ played: 1, lost: 1, points: 0, pointsFor: 0, pointsAgainst: 0 });
    expect(winner).toMatchObject({ played: 1, won: 1, points: 2, setsFor: 2, setsAgainst: 0 });
    expect(setForfeit(day, match.id, null).results[match.id]).toBeUndefined();
  });

  it('a forfeit decides the final', () => {
    let day = playAll(day13(), day13().schedule?.matches ?? []);
    day = generateAfternoon(day);
    day = generateFinal(playAll(day, day.afternoon?.schedule.matches ?? []));
    const final = day.final?.schedule.matches[0] as ScheduledMatch;
    day = setForfeit(day, final.id, 'b');
    expect(outcome(day.results[final.id] as never).winner).toBe('a');
    expect(tournamentDocSchema.safeParse(toDoc(day)).success).toBe(true);
  });
});

describe('team withdrawal (SPEC F11)', () => {
  it('turns the remaining matches into forfeits and keeps the played ones', () => {
    let day = day13();
    const morning = day.schedule as NonNullable<Draft['schedule']>;
    const team = morning.matches[0]?.teamAId as string;
    const [played, ...rest] = morning.matches.filter((m) => isTeamIn(m, team));
    day = setResult(day, (played as ScheduledMatch).id, WIN);
    day = withdrawTeam(day, team);
    expect(day.withdrawn).toEqual([team]);
    expect(day.results[(played as ScheduledMatch).id]).toEqual(WIN);
    for (const m of rest) {
      const result = day.results[m.id];
      expect(result && isForfeit(result) && (result.forfeit === 'a') === (m.teamAId === team)).toBe(
        true,
      );
    }
    // Idempotent.
    expect(withdrawTeam(day, team)).toBe(day);
  });

  it('builds the afternoon and the final without the team that left', () => {
    let day = day13();
    const team = day.teams[0]?.id as string;
    day = withdrawTeam(day, team);
    day = playAll(day, day.schedule?.matches ?? []);
    expect(canGenerateAfternoon(day)).toBe(true);
    day = generateAfternoon(day);
    const afternoonTeams = day.afternoon?.pools.flatMap((p) => p.teamIds) ?? [];
    expect(afternoonTeams).toHaveLength(12);
    expect(afternoonTeams).not.toContain(team);
    expect(day.afternoon?.pools.map((p) => p.teamIds.length)).toEqual([4, 4, 4]);
    expect(tournamentDocSchema.safeParse(toDoc(day)).success).toBe(true);
  });

  it('a withdrawal during the afternoon does not regenerate it; the final skips the team', () => {
    let day = playAll(day13(), day13().schedule?.matches ?? []);
    day = generateAfternoon(day);
    const top = day.afternoon?.pools[0] as Draft['pools'][number];
    const leader = top.teamIds[0] as string;
    day = withdrawTeam(day, leader);
    expect(isAfternoonStale(day)).toBe(false);
    day = generateFinal(playAll(day, day.afternoon?.schedule.matches ?? []));
    const final = day.final?.schedule.matches[0] as ScheduledMatch;
    expect(isTeamIn(final, leader)).toBe(false);
  });

  it('reinstating clears its forfeits and flags an afternoon built without it', () => {
    let day = day13();
    const team = day.teams[0]?.id as string;
    day = withdrawTeam(day, team);
    day = generateAfternoon(playAll(day, day.schedule?.matches ?? []));
    // Morning matches of the team were forfeits; after reinstating they need scores again.
    day = reinstateTeam(day, team);
    expect(day.withdrawn).toEqual([]);
    expect(isAfternoonStale(day)).toBe(true);
    expect(canGenerateAfternoon(day)).toBe(false);
  });
});

describe('published document with forfeits', () => {
  it('rejects forged forfeits and afternoons missing a team that did not withdraw', () => {
    let day = day13();
    day = withdrawTeam(day, day.teams[0]?.id as string);
    day = generateAfternoon(playAll(day, day.schedule?.matches ?? []));
    const doc = toDoc(day);
    const forfeitId = Object.keys(doc.results).find((id) => isForfeit(doc.results[id] as never));
    expect(forfeitId).toBeDefined();
    const forged = {
      ...doc,
      results: { ...doc.results, [forfeitId as string]: { forfeit: 'a', sets: 5 } },
    };
    expect(tournamentDocSchema.safeParse(forged).success).toBe(false);
    expect(tournamentDocSchema.safeParse({ ...doc, withdrawn: [] }).success).toBe(false);
    expect(tournamentDocSchema.safeParse({ ...doc, withdrawn: ['ghost'] }).success).toBe(false);
  });
});
