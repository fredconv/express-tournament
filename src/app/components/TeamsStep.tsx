import { useState } from 'react';
import { newId } from '../../client/ids';
import { LIMITS } from '../../domain/limits';
import { poolSizes } from '../../domain/pools';
import { libraryHas, saveToLibrary } from '../draft/library';
import {
  type AddTeamsResult,
  addTeams,
  locksOf,
  morningPoolCount,
  poolLockIssues,
  removeTeam,
  renameTeam,
  setPoolLock,
  teamNameIssue,
} from '../draft/model';
import { useLibrary } from '../draft/useLibrary';
import { fr } from '../i18n/fr';
import { GenerateTeams } from './GenerateTeams';
import { LibraryPanel } from './LibraryPanel';
import type { StepProps } from './stepProps';

type Mode = 'type' | 'generate' | 'reuse';
const MODES: readonly Mode[] = ['type', 'generate', 'reuse'];

/**
 * Teams of this tournament (SPEC F2, F14). Three ways to add them, one at a time:
 * typing or pasting, fictional names, or the library. The tournament list stays below.
 */
export function TeamsStep({ draft, update }: StepProps) {
  const [mode, setMode] = useState<Mode>('type');
  const [text, setText] = useState('');
  const [report, setReport] = useState<Omit<AddTeamsResult, 'draft'> | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const { library, update: updateLibrary } = useLibrary();
  const unsaved = draft.teams.filter((t) => !libraryHas(library, t.name));

  const showReport = (next: Omit<AddTeamsResult, 'draft'>) => {
    setReport(next);
    setSaved(null);
  };

  const submit = () => {
    const result = addTeams(draft, text, newId);
    update(() => result.draft);
    showReport({ added: result.added, rejected: result.rejected });
    setText(result.rejected.map((r) => r.name).join('\n'));
  };

  const save = (names: string[]) => {
    const result = saveToLibrary(library, names, newId);
    updateLibrary(() => result.library);
    setReport(null);
    setSaved(fr.teams.savedReport(result.added.length));
  };

  return (
    <div className="form">
      <div className="segmented" role="radiogroup" aria-label={fr.teams.modesLabel}>
        {MODES.map((m) => (
          <label key={m} className="segmented__option">
            <input
              type="radio"
              name="team-mode"
              checked={mode === m}
              onChange={() => {
                setMode(m);
                setReport(null);
              }}
            />
            {fr.teams.modes[m]}
          </label>
        ))}
      </div>

      {mode === 'generate' && <GenerateTeams draft={draft} update={update} onReport={showReport} />}
      {mode === 'reuse' && (
        <LibraryPanel
          draft={draft}
          update={update}
          library={library}
          updateLibrary={updateLibrary}
          onReport={showReport}
        />
      )}
      {mode === 'type' && (
        <>
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
        </>
      )}

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

      {saved && (
        <p className="notice" role="status">
          {saved}
        </p>
      )}

      <h2 className="team-list__title">{fr.teams.listTitle(draft.teams.length)}</h2>
      <p className="muted small">{fr.teams.count(draft.teams.length, LIMITS.maxTeams)}</p>
      {unsaved.length > 0 && draft.teams.length > 1 && (
        <button type="button" className="button" onClick={() => save(unsaved.map((t) => t.name))}>
          ☆ {fr.teams.saveNew(unsaved.length)}
        </button>
      )}
      {draft.teams.length >= LIMITS.minTeams && <PoolLockSummary draft={draft} />}
      {draft.teams.length === 0 ? (
        <p className="muted">{fr.teams.empty}</p>
      ) : (
        <ol className="team-list">
          {draft.teams.map((team) => (
            <TeamRow
              key={team.id}
              name={team.name}
              inLibrary={libraryHas(library, team.name)}
              onSave={() => save([team.name])}
              lock={locksOf(draft)[team.id] ?? null}
              poolCount={morningPoolCount(draft)}
              onLock={(poolIndex) => update((d) => setPoolLock(d, team.id, poolIndex))}
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

const letter = (index: number) => String.fromCharCode(65 + index);

/** Planned pools, number of locked teams and locks that can no longer be honoured. */
function PoolLockSummary({ draft }: Pick<StepProps, 'draft'>) {
  const sizes = poolSizes(draft.teams.length).join('-');
  const locked = draft.teams.filter((t) => locksOf(draft)[t.id] !== undefined).length;
  const issues = poolLockIssues(draft);
  const name = (id: string) => draft.teams.find((t) => t.id === id)?.name ?? '?';
  return (
    <>
      <p className="small">
        <strong>{fr.teams.poolsPlanned(sizes, locked)}</strong>
        <br />
        <span className="muted">{fr.teams.lockHelp}</span>
      </p>
      {issues.length > 0 && (
        <div className="notice notice--warning" role="alert">
          {issues.map((issue) => (
            <p key={issue.kind === 'missing-pool' ? issue.teamId : `pool-${issue.poolIndex}`}>
              {issue.kind === 'missing-pool'
                ? fr.teams.lockIssue.missing(name(issue.teamId), letter(issue.poolIndex))
                : fr.teams.lockIssue.over(letter(issue.poolIndex), issue.locked, issue.capacity)}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

interface TeamRowProps {
  name: string;
  inLibrary: boolean;
  onSave: () => void;
  lock: number | null;
  poolCount: number;
  onLock: (poolIndex: number | null) => void;
  issue: (name: string) => keyof typeof fr.teams.issue | null;
  onRename: (name: string) => void;
  onRemove: () => void;
}

function TeamRow({
  name,
  inLibrary,
  onSave,
  lock,
  poolCount,
  onLock,
  issue,
  onRename,
  onRemove,
}: TeamRowProps) {
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
      {inLibrary ? (
        <span className="team-list__saved" title={fr.teams.savedOne(name)}>
          <span aria-hidden="true">★</span>
          <span className="visually-hidden">{fr.teams.savedOne(name)}</span>
        </span>
      ) : (
        <button
          type="button"
          className="button button--ghost button--icon team-list__save"
          aria-label={fr.teams.saveOne(name)}
          title={fr.teams.saveOne(name)}
          onClick={onSave}
        >
          ☆
        </button>
      )}
      <select
        className={`input team-list__pool${lock === null ? '' : ' team-list__pool--locked'}`}
        value={lock ?? ''}
        aria-label={fr.teams.poolChoice(name)}
        onChange={(e) => onLock(e.target.value === '' ? null : Number(e.target.value))}
      >
        <option value="">{fr.teams.random}</option>
        {Array.from({ length: poolCount }, (_, i) => (
          <option key={letter(i)} value={i}>
            {fr.teams.lockedPool(letter(i))}
          </option>
        ))}
        {lock !== null && lock >= poolCount && (
          <option value={lock}>{fr.teams.missingPool(letter(lock))}</option>
        )}
      </select>
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
