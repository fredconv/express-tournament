import { useState } from 'react';
import { newId, newSeed } from '../../client/ids';
import { type AddTeamsResult, freeTeamSlots, generateTeams, removeTeam } from '../draft/model';
import { fr } from '../i18n/fr';
import { NumberField } from './NumberField';
import type { StepProps } from './stepProps';

const DEFAULT_COUNT = 15;

/**
 * Fictional teams (SPEC F2): add to the current list, or replace it after confirmation.
 * "Nouvelle liste" swaps only the teams added by the last generation.
 */
export function GenerateTeams({
  draft,
  update,
  onReport,
}: StepProps & { onReport: (report: Omit<AddTeamsResult, 'draft'>) => void }) {
  const hasTeams = draft.teams.length > 0;
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [lastIds, setLastIds] = useState<string[]>([]);
  const max = Math.max(1, hasTeams ? freeTeamSlots(draft) : freeTeamSlots({ ...draft, teams: [] }));
  const wanted = Math.min(count, max);

  const run = (mode: 'add' | 'replace', base = draft) => {
    const result = generateTeams(base, wanted, mode, newSeed(), newId);
    const before = new Set(base.teams.map((t) => t.id));
    update(() => result.draft);
    setLastIds(result.draft.teams.filter((t) => !before.has(t.id)).map((t) => t.id));
    onReport({ added: result.added, rejected: result.rejected });
  };

  const replace = () => {
    if (window.confirm(fr.teams.confirmReplace(draft.teams.length))) run('replace');
  };

  const regenerate = () => {
    const kept = lastIds.reduce((d, id) => removeTeam(d, id), draft);
    run('add', kept);
  };

  const stillGenerated =
    lastIds.length > 0 && lastIds.every((id) => draft.teams.some((t) => t.id === id));
  if (hasTeams && freeTeamSlots(draft) === 0 && !stillGenerated) {
    return <p className="muted">{fr.teams.full}</p>;
  }

  return (
    <div className="form">
      <NumberField
        label={fr.teams.generateCount}
        value={wanted}
        min={1}
        max={max}
        onChange={setCount}
      />
      <p className="muted small">{fr.teams.generateHelp}</p>
      <div className="button-row">
        {stillGenerated && (
          <button type="button" className="button" onClick={regenerate}>
            {fr.teams.regenerate}
          </button>
        )}
        {!hasTeams ? (
          <button type="button" className="button button--primary" onClick={() => run('add')}>
            {fr.teams.generate(wanted)}
          </button>
        ) : (
          <>
            {freeTeamSlots(draft) > 0 && (
              <button type="button" className="button button--primary" onClick={() => run('add')}>
                {fr.teams.generateAdd(wanted)}
              </button>
            )}
            <button type="button" className="button" onClick={replace}>
              {fr.teams.generateReplace}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
