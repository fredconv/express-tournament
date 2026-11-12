import type { ReactNode } from 'react';
import { outcome } from '../../domain/scores';
import type { Results } from '../../domain/standings';
import { formatTime } from '../../domain/time';
import type { ScheduledMatch } from '../../domain/types';
import type { NamedItem } from '../draft/model';
import { fr } from '../i18n/fr';

interface ScheduleViewProps {
  matches: readonly ScheduledMatch[];
  teams: readonly NamedItem[];
  courts: readonly NamedItem[];
  /** Show only this team's matches, or everything when null. */
  teamId: string | null;
  results: Results;
  poolLabel: (poolId: string) => string;
  /** Editor only: score entry under each match. Forces the list layout. */
  renderScore?: (match: ScheduledMatch) => ReactNode;
}

/**
 * Planning display reused by the editor and, later, the public page (SPEC F6).
 * Mobile: chronological list grouped by start time. Wide screens: time × court grid.
 */
export function ScheduleView(props: ScheduleViewProps) {
  const { matches, teams, courts, teamId, results, poolLabel, renderScore } = props;
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const courtName = new Map(courts.map((c) => [c.id, c.name]));
  const visible = teamId
    ? matches.filter((m) => m.teamAId === teamId || m.teamBId === teamId)
    : matches;
  const times = groupByStart(visible);
  const name = (id: string) => teamName.get(id) ?? '?';
  const teamsOf = (m: ScheduledMatch) => {
    const sets = results[m.id];
    const winner = sets ? outcome(sets).winner : null;
    return (
      <>
        <Team name={name(m.teamAId)} highlight={m.teamAId === teamId} won={winner === 'a'} />
        <span className="match-card__vs">{sets ? formatScore(sets) : fr.planning.vs}</span>
        <Team name={name(m.teamBId)} highlight={m.teamBId === teamId} won={winner === 'b'} />
      </>
    );
  };

  return (
    <>
      <ol className={`schedule-list${renderScore ? ' schedule-list--always' : ''}`}>
        {times.map(([start, timeMatches]) => (
          <li key={start} className="schedule-list__slot">
            <h4 className="schedule-list__time">{formatTime(start)}</h4>
            <ul className="schedule-list__matches">
              {timeMatches.map((m) => (
                <li key={m.id} className="match-card">
                  <span className="match-card__meta">
                    {courtName.get(m.courtId)} · {fr.planning.match(m.number)} ·{' '}
                    {poolLabel(m.poolId)}
                  </span>
                  <span className="match-card__teams">{teamsOf(m)}</span>
                  {renderScore?.(m)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {!renderScore && (
        <div className="schedule-grid-wrapper">
          <table className="schedule-grid">
            <thead>
              <tr>
                <th scope="col">{fr.planning.time}</th>
                {courts.map((c) => (
                  <th key={c.id} scope="col">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {times.map(([start, timeMatches]) => (
                <tr key={start}>
                  <th scope="row">{formatTime(start)}</th>
                  {courts.map((c) => {
                    const m = timeMatches.find((x) => x.courtId === c.id);
                    return (
                      <td key={c.id}>
                        {m && (
                          <>
                            <span className="schedule-grid__number">
                              #{m.number} · {poolLabel(m.poolId)}
                            </span>{' '}
                            {teamsOf(m)}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function formatScore(sets: readonly { a: number; b: number }[]): string {
  return sets.map((s) => `${s.a}-${s.b}`).join(', ');
}

function Team({ name, highlight, won }: { name: string; highlight: boolean; won: boolean }) {
  const className = [highlight && 'team--highlight', won && 'team--winner']
    .filter(Boolean)
    .join(' ');
  return <span className={className || undefined}>{name}</span>;
}

function groupByStart(matches: readonly ScheduledMatch[]): [number, ScheduledMatch[]][] {
  const groups = new Map<number, ScheduledMatch[]>();
  for (const m of matches) groups.set(m.startMinute, [...(groups.get(m.startMinute) ?? []), m]);
  return [...groups.entries()].sort(([a], [b]) => a - b);
}
