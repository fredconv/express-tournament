import { useState } from 'react';
import { newSeed } from '../../client/ids';
import { outcome } from '../../domain/scores';
import { poolStandings } from '../../domain/standings';
import { formatTime } from '../../domain/time';
import type { PoolInput, ScheduledMatch, ScheduleResult } from '../../domain/types';
import { describeFormat } from '../draft/labels';
import {
  blockingIssues,
  canGenerateAfternoon,
  canGenerateFinal,
  type Draft,
  exceedsTargetEnd,
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
import { ScheduleView } from './ScheduleView';
import { ScoreForm } from './ScoreForm';
import { StandingsTable } from './StandingsTable';
import type { StepProps } from './stepProps';

/** The tournament day: morning pools, scores, afternoon and final (SPEC F10–F12). */
export function PlanningStep({ draft, update }: StepProps) {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const blocking = blockingIssues(draft);
  const stale = isScheduleStale(draft);
  const selectedTeam = draft.teams.some((t) => t.id === teamId) ? teamId : null;
  const teamName = (id: string) => draft.teams.find((t) => t.id === id)?.name ?? '?';

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

  const morningLabel = poolLabeler(draft.pools, (i) => fr.planning.pool(letter(i)));
  const afternoonLabel = poolLabeler(
    draft.afternoon?.pools ?? [],
    (i) => fr.planning.levels[i] ?? fr.planning.level(i + 1),
  );
  const poolLabel = (poolId: string) =>
    poolId === 'F' ? fr.planning.final : morningLabel(poolId) || afternoonLabel(poolId);

  const phaseProps = { draft, teamId: selectedTeam, teamName, poolLabel, renderScore };

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
        (!draft.schedule || stale || !hasResults(draft)) && (
          <button
            type="button"
            className="button button--primary button--block"
            onClick={drawMorning}
          >
            {!draft.schedule
              ? fr.planning.generate
              : stale
                ? fr.planning.regenerate
                : fr.planning.redraw}
          </button>
        )
      )}

      {draft.schedule && stale && <p className="notice notice--warning">{fr.planning.stale}</p>}

      {draft.schedule && (
        <div className={stale ? 'planning planning--stale' : 'planning'}>
          <DaySummary draft={draft} />

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

          <PhaseSection
            {...phaseProps}
            title={fr.planning.morning}
            pools={draft.pools}
            schedule={draft.schedule}
          />

          <AfternoonSection {...phaseProps} update={update} />
        </div>
      )}
    </div>
  );
}

interface PhaseProps {
  draft: Draft;
  teamId: string | null;
  teamName: (id: string) => string;
  poolLabel: (poolId: string) => string;
  renderScore: (m: ScheduledMatch) => React.ReactNode;
}

function AfternoonSection(props: PhaseProps & Pick<StepProps, 'update'>) {
  const { draft, update } = props;
  const morning = draft.schedule;
  if (!morning) return null;
  const afternoonStale = isAfternoonStale(draft);

  if (!draft.afternoon) {
    const missing = missingScores(morning.matches, draft.results);
    return missing > 0 ? (
      <p className="notice">{fr.planning.missingScores(missing)}</p>
    ) : (
      <GenerateButton
        label={fr.planning.generateAfternoon}
        disabled={!canGenerateAfternoon(draft)}
        onClick={() => update(generateAfternoon)}
      />
    );
  }

  const final = draft.final;
  const finalSets = final && draft.results[final.schedule.matches[0]?.id ?? ''];
  const finalMatch = final?.schedule.matches[0];
  const champion =
    finalSets && finalMatch
      ? outcome(finalSets).winner === 'a'
        ? finalMatch.teamAId
        : finalMatch.teamBId
      : null;

  return (
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
        {...props}
        title={fr.planning.afternoon}
        pools={draft.afternoon.pools}
        schedule={draft.afternoon.schedule}
      />

      {!final &&
        !afternoonStale &&
        (canGenerateFinal(draft) ? (
          <GenerateButton
            label={fr.planning.generateFinal}
            disabled={false}
            onClick={() => update(generateFinal)}
          />
        ) : (
          <p className="notice">{fr.planning.finalWaiting}</p>
        ))}
      {final && isFinalStale(draft) && (
        <div className="notice notice--warning">
          <p>{fr.planning.finalStale}</p>
          <GenerateButton
            label={fr.planning.regenerateFinal}
            disabled={!canGenerateFinal(draft)}
            onClick={() => update(generateFinal)}
          />
        </div>
      )}
      {final && (
        <PhaseSection {...props} title={fr.planning.final} pools={[]} schedule={final.schedule} />
      )}
      {champion && (
        <p className="notice notice--success">{fr.planning.winner(props.teamName(champion))}</p>
      )}
    </>
  );
}

function PhaseSection({
  draft,
  teamId,
  teamName,
  poolLabel,
  renderScore,
  title,
  pools,
  schedule,
}: PhaseProps & { title: string; pools: readonly PoolInput[]; schedule: ScheduleResult }) {
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
      <Warnings draft={draft} schedule={schedule} />
      {pools.length > 0 && (
        <div className="standings-list">
          {pools.map((pool) => (
            <StandingsTable
              key={pool.id}
              title={poolLabel(pool.id)}
              rows={poolStandings(pool, schedule.matches, draft.results)}
              teamName={teamName}
              teamId={teamId}
            />
          ))}
        </div>
      )}
      <ScheduleView
        matches={schedule.matches}
        teams={draft.teams}
        courts={draft.courts}
        teamId={teamId}
        results={draft.results}
        poolLabel={poolLabel}
        renderScore={renderScore}
      />
    </section>
  );
}

function DaySummary({ draft }: { draft: Draft }) {
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

function GenerateButton(props: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="button button--primary button--block"
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
}

function Warnings({ draft, schedule }: { draft: Draft; schedule: ScheduleResult }) {
  const { warnings } = schedule;
  const backToBack = warnings.reduce(
    (n, w) => n + (w.kind === 'back-to-back' ? w.teamIds.length : 0),
    0,
  );
  const messages: string[] = [];
  if (backToBack > 0) messages.push(fr.warnings.backToBack(backToBack));
  const lateEnd = exceedsTargetEnd(draft, schedule);
  if (lateEnd !== null) messages.push(fr.warnings.exceedsTarget(formatTime(lateEnd)));
  if (warnings.some((w) => w.kind === 'past-midnight')) messages.push(fr.warnings.pastMidnight);
  if (messages.length === 0) return null;
  return (
    <ul className="notice notice--info">
      {messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}

function poolLabeler(pools: readonly PoolInput[], label: (index: number) => string) {
  const index = new Map(pools.map((p, i) => [p.id, i]));
  return (poolId: string) => {
    const i = index.get(poolId);
    return i === undefined ? '' : label(i);
  };
}

function letter(index: number): string {
  return String.fromCharCode(65 + index);
}
