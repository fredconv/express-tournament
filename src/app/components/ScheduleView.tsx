import type { CSSProperties, ReactNode } from 'react';
import { consecutiveTeams } from '../../domain/consecutive';
import { courtColor, textColorOn } from '../../domain/courtColors';
import { isForfeit, outcome } from '../../domain/scores';
import type { Results } from '../../domain/standings';
import { formatTime } from '../../domain/time';
import type { ScheduledMatch } from '../../domain/types';
import type { Court, NamedItem } from '../draft/model';
import { fr } from '../i18n/fr';

interface ScheduleViewProps {
  matches: readonly ScheduledMatch[];
  teams: readonly NamedItem[];
  courts: readonly Court[];
  /** Show only this team's matches, or everything when null. */
  teamId: string | null;
  results: Results;
  poolLabel: (poolId: string) => string;
  /** Editor only: score entry under each match. Forces the list layout. */
  renderScore?: (match: ScheduledMatch) => ReactNode;
}

/**
 * Planning display shared by the editor and the public page (SPEC F6, F13).
 * Mobile: list grouped by start time. Wide screens and print: time × court grid.
 * Court color, back-to-back marker and highlight always come with text.
 */
export function ScheduleView(props: ScheduleViewProps) {
  const { matches, teams, courts, teamId, results, poolLabel, renderScore } = props;
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const name = (id: string) => teamName.get(id) ?? '?';
  const courtIndex = new Map(courts.map((c, i) => [c.id, i]));
  const consecutive = consecutiveTeams(matches);
  const visible = teamId
    ? matches.filter((m) => m.teamAId === teamId || m.teamBId === teamId)
    : matches;
  const times = groupByStart(visible);

  const courtStyle = (courtId: string): CSSProperties => {
    const index = courtIndex.get(courtId) ?? 0;
    const color = courtColor(courts[index] ?? {}, index);
    return { '--court': color, '--court-text': textColorOn(color) } as CSSProperties;
  };
  const team = (id: string, won: boolean) => {
    const className = [id === teamId && 'team--highlight', won && 'team--winner']
      .filter(Boolean)
      .join(' ');
    return <span className={className || undefined}>{name(id)}</span>;
  };

  const body = (m: ScheduledMatch) => {
    const sets = results[m.id];
    const winner = sets ? outcome(sets).winner : null;
    const tired = consecutive.get(m.id);
    return (
      <>
        <span className="match-card__teams">
          {team(m.teamAId, winner === 'a')}
          <span
            className={`match-card__vs${sets && isForfeit(sets) ? ' match-card__vs--forfeit' : ''}`}
          >
            {!sets
              ? fr.planning.vs
              : isForfeit(sets)
                ? fr.score.forfeitBy(name(sets.forfeit === 'a' ? m.teamAId : m.teamBId))
                : formatScore(sets)}
          </span>
          {team(m.teamBId, winner === 'b')}
        </span>
        {tired && (
          <span className="consecutive">
            <span aria-hidden="true">↻ </span>
            {fr.planning.consecutive(tired.map(name).join(', '))}
          </span>
        )}
      </>
    );
  };

  const courtBadge = (courtId: string) => (
    <span className="court-badge" style={courtStyle(courtId)}>
      {courts[courtIndex.get(courtId) ?? 0]?.name}
    </span>
  );

  return (
    <>
      <ol className={`schedule-list${renderScore ? ' schedule-list--always' : ''}`}>
        {times.map(([start, timeMatches]) => (
          <li key={start} className="schedule-list__slot">
            <h4 className="slot-head">
              <span className="slot-head__time">{formatTime(start)}</span>
              {/* Filtered: other matches of the slot are hidden, so no misleading count. */}
              {!teamId && (
                <span className="slot-head__count">
                  {fr.planning.simultaneous(timeMatches.length)}
                </span>
              )}
            </h4>
            <ul className="schedule-list__matches">
              {timeMatches.map((m) => (
                <li key={m.id} className="match-card" style={courtStyle(m.courtId)}>
                  <span className="match-card__meta">
                    {courtBadge(m.courtId)} {fr.planning.match(m.number)} · {poolLabel(m.poolId)}
                  </span>
                  {body(m)}
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
                    {courtBadge(c.id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {times.map(([start, timeMatches]) => (
                <tr key={start}>
                  <th scope="row" className="schedule-grid__time">
                    {formatTime(start)}
                  </th>
                  {courts.map((c) => {
                    const m = timeMatches.find((x) => x.courtId === c.id);
                    return m ? (
                      <td key={c.id} className="schedule-grid__cell" style={courtStyle(c.id)}>
                        <span className="schedule-grid__number">
                          #{m.number} · {poolLabel(m.poolId)}
                        </span>
                        {body(m)}
                      </td>
                    ) : (
                      <td key={c.id} />
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

function groupByStart(matches: readonly ScheduledMatch[]): [number, ScheduledMatch[]][] {
  const groups = new Map<number, ScheduledMatch[]>();
  for (const m of matches) groups.set(m.startMinute, [...(groups.get(m.startMinute) ?? []), m]);
  return [...groups.entries()].sort(([a], [b]) => a - b);
}
