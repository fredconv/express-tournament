import type { StandingRow } from '../../domain/standings';
import { fr } from '../i18n/fr';

interface StandingsTableProps {
  title: string;
  rows: readonly StandingRow[];
  teamName: (id: string) => string;
  teamId: string | null;
}

export function StandingsTable({ title, rows, teamName, teamId }: StandingsTableProps) {
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
  return (
    <table className="standings">
      <caption>{fr.standings.caption(title)}</caption>
      <thead>
        <tr>
          <th scope="col">{fr.standings.rank}</th>
          <th scope="col">{fr.standings.team}</th>
          <th scope="col">{fr.standings.played}</th>
          <th scope="col">{fr.standings.points}</th>
          <th scope="col">{fr.standings.sets}</th>
          <th scope="col">{fr.standings.diff}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.teamId} className={row.teamId === teamId ? 'team--highlight' : undefined}>
            <td>{row.rank}</td>
            <th scope="row">{teamName(row.teamId)}</th>
            <td>{row.played}</td>
            <td>{row.points}</td>
            <td>
              {row.setsFor}-{row.setsAgainst}
            </td>
            <td>{signed(row.pointsFor - row.pointsAgainst)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
