import { useState } from 'react';
import { newId } from '../../client/ids';
import { LIMITS } from '../../domain/limits';
import {
  type AddTeamsResult,
  addTeams,
  removeTeam,
  renameTeam,
  teamNameIssue,
} from '../draft/model';
import { fr } from '../i18n/fr';
import type { StepProps } from './stepProps';

export function TeamsStep({ draft, update }: StepProps) {
  const [text, setText] = useState('');
  const [report, setReport] = useState<Omit<AddTeamsResult, 'draft'> | null>(null);

  const submit = () => {
    const result = addTeams(draft, text, newId);
    update(() => result.draft);
    setReport({ added: result.added, rejected: result.rejected });
    setText(result.rejected.map((r) => r.name).join('\n'));
  };

  return (
    <div className="form">
      <label className="field">
        <span className="field__label">{fr.teams.paste}</span>
        <textarea
          className="input input--multiline"
          rows={4}
          value={text}
          placeholder={fr.teams.pastePlaceholder}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="button button--primary"
        onClick={submit}
        disabled={text.trim() === ''}
      >
        {fr.teams.add}
      </button>

      {report && (
        <div className="notice" role="status">
          {report.added > 0 && <p>{fr.teams.added(report.added)}</p>}
          {report.rejected.map((r) => (
            <p key={r.name} className="notice__error">
              « {r.name} » : {fr.teams.issue[r.issue]}
            </p>
          ))}
        </div>
      )}

      <p className="muted small">{fr.teams.count(draft.teams.length, LIMITS.maxTeams)}</p>
      {draft.teams.length === 0 ? (
        <p className="muted">{fr.teams.empty}</p>
      ) : (
        <ol className="team-list">
          {draft.teams.map((team) => (
            <TeamRow
              key={team.id}
              name={team.name}
              issue={(name) => teamNameIssue(draft.teams, name, team.id)}
              onRename={(name) => update((d) => renameTeam(d, team.id, name))}
              onRemove={() => update((d) => removeTeam(d, team.id))}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

interface TeamRowProps {
  name: string;
  issue: (name: string) => keyof typeof fr.teams.issue | null;
  onRename: (name: string) => void;
  onRemove: () => void;
}

function TeamRow({ name, issue, onRename, onRemove }: TeamRowProps) {
  const [value, setValue] = useState(name);
  const problem = value === name ? null : issue(value);

  const commit = () => {
    if (value !== name && !problem) onRename(value);
    else setValue(name);
  };

  return (
    <li className="team-list__item">
      <input
        className={`input${problem ? ' input--invalid' : ''}`}
        value={value}
        maxLength={LIMITS.teamNameMax}
        aria-label={fr.teams.rename(name)}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      <button
        type="button"
        className="button button--ghost button--icon"
        onClick={onRemove}
        aria-label={fr.teams.remove(name)}
      >
        ✕
      </button>
      {problem && <span className="field__error">{fr.teams.issue[problem]}</span>}
    </li>
  );
}
