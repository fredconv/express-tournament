import type { CSSProperties, ReactNode } from 'react';
import { courtColor, textColorOn } from '../../domain/courtColors';
import { outcome } from '../../domain/scores';
import { poolStandings } from '../../domain/standings';
import { formatTime } from '../../domain/time';
import type { PoolInput, ScheduledMatch, ScheduleResult } from '../../domain/types';
import { describeFormat } from '../draft/labels';
import { type Draft, exceedsTargetEnd, teamMatchCount } from '../draft/model';
import { fr } from '../i18n/fr';
import { ScheduleView } from './ScheduleView';
import { StandingsTable } from './StandingsTable';

// Read-only pieces of the tournament day, shared by the editor and the public page.

export interface PhaseProps {
  draft: Draft;
  teamId: string | null;
  /** Editor only: score entry under each match. */
  renderScore?: (m: ScheduledMatch) => ReactNode;
}

export function PhaseSection({
  draft,
  teamId,
  renderScore,
  title,
  pools,
  schedule,
  beforeSchedule,
}: PhaseProps & {
  title: string;
  pools: readonly PoolInput[];
  schedule: ScheduleResult;
  /** Controls acting on the schedule (team filter), placed right above the first slot. */
  beforeSchedule?: ReactNode;
}) {
  const poolLabel = poolLabelOf(draft);
  return (
    <section className="phase">
      <h2>
        {title}{' '}
        <span className="muted small">
          {fr.planning.range(
            formatTime(schedule.matches[0]?.startMinute ?? 0),
            formatTime(schedule.endMinute),
            schedule.matches.length,
          )}
        </span>
      </h2>
      {renderScore && <Warnings draft={draft} schedule={schedule} />}
      {pools.length > 0 && (
        <div className="standings-list">
          {pools.map((pool) => (
            <StandingsTable
              key={pool.id}
              title={poolLabel(pool.id)}
              rows={poolStandings(pool, schedule.matches, draft.results)}
              teamName={teamNameOf(draft)}
              teamId={teamId}
            />
          ))}
        </div>
      )}
      {beforeSchedule}
      {teamId && !schedule.matches.some((m) => m.teamAId === teamId || m.teamBId === teamId) && (
        <p className="muted small">{fr.planning.noMatchForTeam}</p>
      )}
      <ScheduleView
        matches={schedule.matches}
        teams={draft.teams}
        courts={draft.courts}
        teamId={teamId}
        results={draft.results}
        poolLabel={poolLabel}
        {...(renderScore ? { renderScore } : {})}
      />
    </section>
  );
}

export function DaySummary({ draft }: { draft: Draft }) {
  const morning = draft.schedule;
  if (!morning) return null;
  const sizes = draft.pools.map((p) => p.teamIds.length).join('-');
  const afternoonStart = morning.endMinute + draft.lunchMinutes;
  return (
    <div className="planning__summary">
      <p>
        <strong>{describeFormat(draft.matchFormat)}</strong> · {fr.planning.poolSizes(sizes)}
      </p>
      <p className="muted small">
        {fr.planning.morning} {formatTime(morning.matches[0]?.startMinute ?? 0)} →{' '}
        {formatTime(morning.endMinute)} · {fr.planning.lunch} → {formatTime(afternoonStart)}
      </p>
    </div>
  );
}

/**
 * The single team selector (SPEC F6): only the selected team's matches are shown,
 * the others are hidden (not deleted). Shared by the editor and the public page.
 */
export function TeamFilter({
  draft,
  teamId,
  onChange,
  teamActions,
}: {
  draft: Draft;
  teamId: string | null;
  onChange: (teamId: string | null) => void;
  /** Editor only: actions on the selected team (withdrawal). */
  teamActions?: ReactNode;
}) {
  return (
    <div className={`team-filter${teamId ? ' team-filter--active' : ''}`}>
      <label className="field no-print">
        <span className="field__label">{fr.planning.filter}</span>
        <select
          className="input"
          value={teamId ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">{fr.planning.allTeams}</option>
          {draft.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {teamNameOf(draft)(t.id)}
            </option>
          ))}
        </select>
      </label>
      {teamId && (
        <p className="team-filter__status" role="status">
          <span>
            <span aria-hidden="true">⏷ </span>
            {fr.planning.filtered(teamNameOf(draft)(teamId), teamMatchCount(draft, teamId))}
          </span>
          <button type="button" className="button" onClick={() => onChange(null)}>
            {fr.planning.showAll}
          </button>
        </p>
      )}
      {teamId && teamActions}
    </div>
  );
}

/** Court colors and back-to-back marker (SPEC F13). */
export function Legend({ draft }: { draft: Draft }) {
  return (
    <div className="legend">
      <p className="legend__title">{fr.planning.legend}</p>
      <ul className="legend__items">
        {draft.courts.map((court, i) => {
          const color = courtColor(court, i);
          const style = { '--court': color, '--court-text': textColorOn(color) } as CSSProperties;
          return (
            <li key={court.id}>
              <span className="court-badge" style={style}>
                {court.name}
              </span>
            </li>
          );
        })}
        <li>
          <span className="consecutive consecutive--sample">↻ {fr.planning.consecutive('…')}</span>{' '}
          <span className="small">{fr.planning.legendConsecutive}</span>
        </li>
      </ul>
    </div>
  );
}

export function Champion({ draft }: { draft: Draft }) {
  const match = draft.final?.schedule.matches[0];
  const sets = match && draft.results[match.id];
  if (!match || !sets) return null;
  const winner = outcome(sets).winner === 'a' ? match.teamAId : match.teamBId;
  return <p className="notice notice--success">{fr.planning.winner(teamNameOf(draft)(winner))}</p>;
}

function Warnings({ draft, schedule }: { draft: Draft; schedule: ScheduleResult }) {
  const backToBack = schedule.warnings.reduce(
    (n, w) => n + (w.kind === 'back-to-back' ? w.teamIds.length : 0),
    0,
  );
  const messages: string[] = [];
  if (backToBack > 0) messages.push(fr.warnings.backToBack(backToBack, schedule.backToBackMinimal));
  const lateEnd = exceedsTargetEnd(draft, schedule);
  if (lateEnd !== null) messages.push(fr.warnings.exceedsTarget(formatTime(lateEnd)));
  if (schedule.warnings.some((w) => w.kind === 'past-midnight')) {
    messages.push(fr.warnings.pastMidnight);
  }
  if (messages.length === 0) return null;
  return (
    <ul className="notice notice--info">
      {messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}

/** Team names; withdrawn teams are marked so tables and the filter stay explicit. */
export function teamNameOf(draft: Draft) {
  const names = new Map(draft.teams.map((t) => [t.id, t.name]));
  const gone = new Set(draft.withdrawn ?? []);
  return (id: string) => (names.get(id) ?? '?') + (gone.has(id) ? fr.planning.withdrawnSuffix : '');
}

/** "Poule A"… in the morning, "Poule Or"… in the afternoon, "Finale". */
export function poolLabelOf(draft: Draft) {
  const labels = new Map<string, string>();
  for (const [i, p] of draft.pools.entries()) {
    labels.set(p.id, fr.planning.pool(String.fromCharCode(65 + i)));
  }
  for (const [i, p] of (draft.afternoon?.pools ?? []).entries()) {
    labels.set(p.id, fr.planning.levels[i] ?? fr.planning.level(i + 1));
  }
  return (poolId: string) => (poolId === 'F' ? fr.planning.final : (labels.get(poolId) ?? ''));
}
