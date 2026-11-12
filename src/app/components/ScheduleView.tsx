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
}

/**
 * Planning display reused by the editor preview and, later, the public page (SPEC F6).
 * Mobile: chronological list grouped by slot. Wide screens: slot × court grid.
 */
export function ScheduleView({ matches, teams, courts, teamId }: ScheduleViewProps) {
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const courtName = new Map(courts.map((c) => [c.id, c.name]));
  const visible = teamId
    ? matches.filter((m) => m.teamAId === teamId || m.teamBId === teamId)
    : matches;
  const slots = groupBySlot(visible);
  const name = (id: string) => teamName.get(id) ?? '?';

  return (
    <>
      <ol className="schedule-list">
        {slots.map(([slot, slotMatches]) => (
          <li key={slot} className="schedule-list__slot">
            <h3 className="schedule-list__time">{formatTime(slotMatches[0]?.startMinute ?? 0)}</h3>
            <ul className="schedule-list__matches">
              {slotMatches.map((m) => (
                <li key={m.id} className="match-card">
                  <span className="match-card__meta">
                    {courtName.get(m.courtId)} · {fr.planning.match(m.number)}
                  </span>
                  <span className="match-card__teams">
                    <Team name={name(m.teamAId)} highlight={m.teamAId === teamId} />
                    <span className="match-card__vs">{fr.planning.vs}</span>
                    <Team name={name(m.teamBId)} highlight={m.teamBId === teamId} />
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

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
            {slots.map(([slot, slotMatches]) => (
              <tr key={slot}>
                <th scope="row">{formatTime(slotMatches[0]?.startMinute ?? 0)}</th>
                {courts.map((c) => {
                  const m = slotMatches.find((x) => x.courtId === c.id);
                  return (
                    <td key={c.id}>
                      {m && (
                        <>
                          <span className="schedule-grid__number">#{m.number}</span>{' '}
                          <Team name={name(m.teamAId)} highlight={m.teamAId === teamId} /> –{' '}
                          <Team name={name(m.teamBId)} highlight={m.teamBId === teamId} />
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
    </>
  );
}

function Team({ name, highlight }: { name: string; highlight: boolean }) {
  return highlight ? <strong className="team--highlight">{name}</strong> : <span>{name}</span>;
}

function groupBySlot(matches: readonly ScheduledMatch[]): [number, ScheduledMatch[]][] {
  const groups = new Map<number, ScheduledMatch[]>();
  for (const m of matches) groups.set(m.slot, [...(groups.get(m.slot) ?? []), m]);
  return [...groups.entries()].sort(([a], [b]) => a - b);
}
