import { splitIntoPools } from './pools';
import { type MatchResult, outcome } from './scores';
import type { PoolInput, ScheduledMatch } from './types';

// Pool rankings and afternoon pools (SPEC F11/F12, decisions D11/D12).

export type Results = Readonly<Record<string, MatchResult>>;

export interface StandingRow {
  teamId: string;
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  /** 2 per win, 1 per draw. */
  points: number;
  setsFor: number;
  setsAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
}

const WIN_POINTS = 2;
const DRAW_POINTS = 1;

/**
 * Ranking of one pool. Criteria are averaged per match played so that pools of
 * different sizes (or still in progress) compare fairly: points, set difference,
 * point difference, then the draw order (order of `teamIds`).
 */
export function poolStandings(
  pool: PoolInput,
  matches: readonly ScheduledMatch[],
  results: Results,
): StandingRow[] {
  const rows = new Map(pool.teamIds.map((teamId) => [teamId, emptyRow(teamId)]));
  for (const m of matches) {
    const sets = results[m.id];
    const a = rows.get(m.teamAId);
    const b = rows.get(m.teamBId);
    if (!sets || !a || !b) continue;
    const o = outcome(sets);
    record(a, o.setsA, o.setsB, o.pointsA, o.pointsB, o.winner === 'a', o.winner === null);
    record(b, o.setsB, o.setsA, o.pointsB, o.pointsA, o.winner === 'b', o.winner === null);
  }
  const order = new Map(pool.teamIds.map((t, i) => [t, i]));
  const ranked = [...rows.values()].sort(
    (x, y) => compareRows(x, y) || (order.get(x.teamId) ?? 0) - (order.get(y.teamId) ?? 0),
  );
  return ranked.map((row, i) => ({ ...row, rank: i + 1 }));
}

/**
 * Overall morning ranking: every pool winner first, then every runner-up, and so on;
 * teams with the same pool rank are compared with the per-match averages.
 */
export function overallRanking(
  pools: readonly PoolInput[],
  matches: readonly ScheduledMatch[],
  results: Results,
): string[] {
  const rows = pools.flatMap((pool, poolIndex) =>
    poolStandings(pool, matches, results).map((row) => ({ row, poolIndex })),
  );
  rows.sort(
    (x, y) => x.row.rank - y.row.rank || compareRows(x.row, y.row) || x.poolIndex - y.poolIndex,
  );
  return rows.map((r) => r.row.teamId);
}

/** Afternoon pools: consecutive blocks of the overall ranking, best teams in the first pool. */
export function levelPools(ranking: readonly string[]): PoolInput[] {
  return splitIntoPools(ranking, 'N');
}

/** True when every match of the pool has a score. */
export function isPoolComplete(
  poolId: string,
  matches: readonly ScheduledMatch[],
  results: Results,
): boolean {
  return matches.filter((m) => m.poolId === poolId).every((m) => results[m.id] !== undefined);
}

function compareRows(x: StandingRow, y: StandingRow): number {
  const avg = (value: number, row: StandingRow) => (row.played === 0 ? 0 : value / row.played);
  return (
    avg(y.points, y) - avg(x.points, x) ||
    avg(y.setsFor - y.setsAgainst, y) - avg(x.setsFor - x.setsAgainst, x) ||
    avg(y.pointsFor - y.pointsAgainst, y) - avg(x.pointsFor - x.pointsAgainst, x)
  );
}

function emptyRow(teamId: string): StandingRow {
  return {
    teamId,
    rank: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    points: 0,
    setsFor: 0,
    setsAgainst: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  };
}

function record(
  row: StandingRow,
  setsFor: number,
  setsAgainst: number,
  pointsFor: number,
  pointsAgainst: number,
  won: boolean,
  drawn: boolean,
): void {
  row.played++;
  if (won) row.won++;
  else if (drawn) row.drawn++;
  else row.lost++;
  row.points += won ? WIN_POINTS : drawn ? DRAW_POINTS : 0;
  row.setsFor += setsFor;
  row.setsAgainst += setsAgainst;
  row.pointsFor += pointsFor;
  row.pointsAgainst += pointsAgainst;
}
