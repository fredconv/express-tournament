import { useState } from 'react';
import { formatTime } from '../../domain/time';
import { describeFormat } from '../draft/labels';
import { draftIssues, generate, isScheduleStale } from '../draft/model';
import { fr } from '../i18n/fr';
import { ScheduleView } from './ScheduleView';
import type { StepProps } from './stepProps';

export function PlanningStep({ draft, update }: StepProps) {
  const [teamId, setTeamId] = useState<string | null>(null);
  const blocking = draftIssues(draft).filter((i) => i !== 'name-missing' && i !== 'date-missing');
  const stale = isScheduleStale(draft);
  const schedule = draft.schedule;
  const selectedTeam = draft.teams.some((t) => t.id === teamId) ? teamId : null;

  return (
    <div className="form">
      {blocking.length > 0 ? (
        <div className="notice notice--warning">
          <p>{fr.planning.blocked}</p>
          <ul>
            {blocking.map((issue) => (
              <li key={issue}>{fr.issues[issue]}</li>
            ))}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          className="button button--primary button--block"
          onClick={() => update((d) => generate(d))}
        >
          {schedule ? fr.planning.regenerate : fr.planning.generate}
        </button>
      )}

      {schedule && stale && <p className="notice notice--warning">{fr.planning.stale}</p>}

      {schedule && (
        <div className={stale ? 'planning planning--stale' : 'planning'}>
          <p className="planning__summary">
            <strong>
              {fr.planning.summary(
                schedule.matches.length,
                schedule.slotCount,
                formatTime(schedule.matches[0]?.startMinute ?? 0),
                formatTime(schedule.endMinute),
              )}
            </strong>
            <br />
            <span className="muted">{describeFormat(draft.matchFormat)}</span>
          </p>
          <Warnings warnings={schedule.warnings} />

          <label className="field">
            <span className="field__label">{fr.planning.filter}</span>
            <select
              className="input"
              value={selectedTeam ?? ''}
              onChange={(e) => setTeamId(e.target.value || null)}
            >
              <option value="">{fr.planning.allTeams}</option>
              {draft.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <ScheduleView
            matches={schedule.matches}
            teams={draft.teams}
            courts={draft.courts}
            teamId={selectedTeam}
          />
        </div>
      )}
    </div>
  );
}

function Warnings({
  warnings,
}: {
  warnings: NonNullable<StepProps['draft']['schedule']>['warnings'];
}) {
  const backToBack = warnings.reduce(
    (n, w) => n + (w.kind === 'back-to-back' ? w.teamIds.length : 0),
    0,
  );
  const messages: string[] = [];
  if (backToBack > 0) messages.push(fr.warnings.backToBack(backToBack));
  for (const w of warnings) {
    if (w.kind === 'exceeds-target-end')
      messages.push(fr.warnings.exceedsTarget(formatTime(w.endMinute)));
    if (w.kind === 'past-midnight') messages.push(fr.warnings.pastMidnight);
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
