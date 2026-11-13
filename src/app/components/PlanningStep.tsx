import { useState } from 'react';
import { newSeed } from '../../client/ids';
import type { ScheduledMatch } from '../../domain/types';
import {
  blockingIssues,
  canGenerateAfternoon,
  canGenerateFinal,
  generate,
  generateAfternoon,
  generateFinal,
  hasResults,
  isAfternoonStale,
  isFinalMatch,
  isFinalStale,
  isScheduleStale,
  missingScores,
  setResult,
} from '../draft/model';
import { fr } from '../i18n/fr';
import { Champion, DaySummary, Legend, PhaseSection, TeamFilter, teamNameOf } from './DayView';
import { ScoreForm } from './ScoreForm';
import type { StepProps } from './stepProps';

/** The tournament day: morning pools, scores, afternoon and final (SPEC F10–F12). */
export function PlanningStep({ draft, update }: StepProps) {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [focusTeam, setFocusTeam] = useState<string | null>(null);
  const blocking = blockingIssues(draft);
  const stale = isScheduleStale(draft);
  const selectedTeam = draft.teams.some((t) => t.id === teamId) ? teamId : null;
  const teamName = teamNameOf(draft);

  const confirmReset = () => !hasResults(draft) || window.confirm(fr.planning.confirmReset);
  const drawMorning = () => {
    if (confirmReset()) update((d) => generate(d, newSeed()));
  };

  const renderScore = (m: ScheduledMatch) =>
    editing === m.id ? (
      <ScoreForm
        format={draft.matchFormat}
        isFinal={isFinalMatch(draft, m.id)}
        initial={draft.results[m.id]}
        teamA={teamName(m.teamAId)}
        teamB={teamName(m.teamBId)}
        onSave={(sets) => {
          update((d) => setResult(d, m.id, sets));
          setEditing(null);
        }}
        onClear={() => {
          update((d) => setResult(d, m.id, null));
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />
    ) : (
      <button type="button" className="link-button score-link" onClick={() => setEditing(m.id)}>
        {draft.results[m.id] ? fr.score.edit : fr.score.enter}
      </button>
    );

  const focusTeamId = draft.teams.some((t) => t.id === focusTeam) ? focusTeam : null;
  const phaseProps = {
    draft,
    teamId: selectedTeam,
    focusTeamId,
    onFocusTeam: setFocusTeam,
    renderScore,
  };
  const morning = draft.schedule;
  const afternoonStale = isAfternoonStale(draft);

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
        (!morning || stale || !hasResults(draft)) && (
          <GenerateButton
            label={
              !morning ? fr.planning.generate : stale ? fr.planning.regenerate : fr.planning.redraw
            }
            onClick={drawMorning}
          />
        )
      )}

      {morning && stale && <p className="notice notice--warning">{fr.planning.stale}</p>}

      {morning && (
        <div className={stale ? 'planning planning--stale' : 'planning'}>
          <DaySummary draft={draft} />
          <TeamFilter draft={draft} teamId={selectedTeam} onChange={setTeamId} />
          <Legend draft={draft} focusTeamId={focusTeamId} onFocusTeam={setFocusTeam} />
          <PhaseSection
            {...phaseProps}
            title={fr.planning.morning}
            pools={draft.pools}
            schedule={morning}
          />

          {!draft.afternoon &&
            (missingScores(morning.matches, draft.results) > 0 ? (
              <p className="notice">
                {fr.planning.missingScores(missingScores(morning.matches, draft.results))}
              </p>
            ) : (
              <GenerateButton
                label={fr.planning.generateAfternoon}
                disabled={!canGenerateAfternoon(draft)}
                onClick={() => update(generateAfternoon)}
              />
            ))}

          {draft.afternoon && (
            <>
              {afternoonStale && (
                <div className="notice notice--warning">
                  <p>{fr.planning.afternoonStale}</p>
                  <GenerateButton
                    label={fr.planning.regenerateAfternoon}
                    disabled={!canGenerateAfternoon(draft)}
                    onClick={() => update(generateAfternoon)}
                  />
                </div>
              )}
              <PhaseSection
                {...phaseProps}
                title={fr.planning.afternoon}
                pools={draft.afternoon.pools}
                schedule={draft.afternoon.schedule}
              />
              {!draft.final &&
                !afternoonStale &&
                (canGenerateFinal(draft) ? (
                  <GenerateButton
                    label={fr.planning.generateFinal}
                    onClick={() => update(generateFinal)}
                  />
                ) : (
                  <p className="notice">{fr.planning.finalWaiting}</p>
                ))}
            </>
          )}

          {draft.final && isFinalStale(draft) && (
            <div className="notice notice--warning">
              <p>{fr.planning.finalStale}</p>
              <GenerateButton
                label={fr.planning.regenerateFinal}
                disabled={!canGenerateFinal(draft)}
                onClick={() => update(generateFinal)}
              />
            </div>
          )}
          {draft.final && (
            <PhaseSection
              {...phaseProps}
              title={fr.planning.final}
              pools={[]}
              schedule={draft.final.schedule}
            />
          )}
          <Champion draft={draft} />
        </div>
      )}
    </div>
  );
}

function GenerateButton(props: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="button button--primary button--block"
      disabled={props.disabled ?? false}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
}
