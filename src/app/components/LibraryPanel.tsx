import { useState } from 'react';
import { newId } from '../../client/ids';
import { normalizeName } from '../../domain/names';
import {
  type Library,
  type LibraryTeam,
  removeFromLibrary,
  renameInLibrary,
  searchLibrary,
} from '../draft/library';
import { type AddTeamsResult, addTeams } from '../draft/model';
import { fr } from '../i18n/fr';
import type { StepProps } from './stepProps';

interface LibraryPanelProps extends StepProps {
  library: Library;
  updateLibrary: (change: (current: Library) => LibraryTeam[]) => void;
  onReport: (report: Omit<AddTeamsResult, 'draft'>) => void;
}

/**
 * "Réutiliser" (SPEC F14): pick saved teams for this tournament, or manage the library.
 * Picking copies names into the tournament; managing never touches any tournament.
 */
export function LibraryPanel(props: LibraryPanelProps) {
  const [view, setView] = useState<'pick' | 'manage'>('pick');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const { draft, library } = props;

  const inTournament = new Set(draft.teams.map((t) => normalizeName(t.name)));
  const isIn = (team: LibraryTeam) => view === 'pick' && inTournament.has(normalizeName(team.name));
  const visible = searchLibrary(library, query);
  const selectable = visible.filter((t) => !isIn(t));
  const chosen = library.filter((t) => selected.has(t.id));

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const switchView = (next: 'pick' | 'manage') => {
    setView(next);
    setSelected(new Set());
    setMessage(null);
  };

  const addSelection = () => {
    const result = addTeams(draft, chosen.map((t) => t.name).join('\n'), newId);
    props.update(() => result.draft);
    props.onReport({ added: result.added, rejected: result.rejected });
    setSelected(new Set());
  };

  const remove = (ids: string[]) => {
    if (ids.length === 0 || !window.confirm(fr.library.confirmDelete(ids.length))) return;
    props.updateLibrary((current) => removeFromLibrary(current, ids));
    setSelected(new Set());
    setMessage(fr.library.deleted(ids.length));
  };

  return (
    <div className="form library">
      <div className="library__header">
        <strong>{view === 'pick' ? fr.library.pickTitle : fr.library.manageTitle}</strong>
        <button
          type="button"
          className="link-button"
          onClick={() => switchView(view === 'pick' ? 'manage' : 'pick')}
        >
          {view === 'pick' ? fr.library.manage : fr.library.backToPick}
        </button>
      </div>
      <p className="muted small">
        {fr.library.total(library.length)} · {fr.library.help}
      </p>

      {library.length === 0 ? (
        <p className="muted">{fr.library.empty}</p>
      ) : (
        <>
          <input
            className="input"
            type="search"
            value={query}
            placeholder={fr.library.search}
            aria-label={fr.library.search}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="button-row">
            <button
              type="button"
              className="button"
              disabled={selectable.length === 0}
              onClick={() => setSelected(new Set(selectable.map((t) => t.id)))}
            >
              {fr.library.selectAll}
            </button>
            <button
              type="button"
              className="button"
              disabled={selected.size === 0}
              onClick={() => setSelected(new Set())}
            >
              {fr.library.selectNone}
            </button>
            <span className="muted small" aria-live="polite">
              {fr.library.selected(chosen.length)}
            </span>
          </div>

          {visible.length === 0 ? (
            <p className="muted">{fr.library.noMatch}</p>
          ) : (
            <ul className="library__list">
              {visible.map((team) =>
                view === 'pick' ? (
                  <li key={team.id}>
                    <label className={`checkbox${isIn(team) ? ' checkbox--disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(team.id)}
                        disabled={isIn(team)}
                        onChange={() => toggle(team.id)}
                      />
                      <span>
                        {team.name}
                        {isIn(team) && (
                          <span className="muted small"> · {fr.library.alreadyIn}</span>
                        )}
                      </span>
                    </label>
                  </li>
                ) : (
                  <ManageRow
                    key={team.id}
                    team={team}
                    selected={selected.has(team.id)}
                    onToggle={() => toggle(team.id)}
                    onRename={(name) => {
                      const result = renameInLibrary(library, team.id, name);
                      if ('issue' in result) return fr.library.issue[result.issue];
                      props.updateLibrary(() => result.library);
                      setMessage(fr.library.renamed(name.trim()));
                      return null;
                    }}
                    onDelete={() => remove([team.id])}
                  />
                ),
              )}
            </ul>
          )}

          {view === 'pick' ? (
            <button
              type="button"
              className="button button--primary"
              disabled={chosen.length === 0}
              onClick={addSelection}
            >
              {fr.library.addSelection(chosen.length)}
            </button>
          ) : (
            <button
              type="button"
              className="button button--danger-soft"
              disabled={chosen.length === 0}
              onClick={() => remove(chosen.map((t) => t.id))}
            >
              {fr.library.deleteSelected(chosen.length)}
            </button>
          )}
        </>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

function ManageRow({
  team,
  selected,
  onToggle,
  onRename,
  onDelete,
}: {
  team: LibraryTeam;
  selected: boolean;
  onToggle: () => void;
  onRename: (name: string) => string | null;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(team.name);
  const [error, setError] = useState<string | null>(null);
  const commit = () => {
    if (value.trim() === team.name) return setValue(team.name);
    const problem = onRename(value);
    setError(problem);
    if (problem) setValue(team.name);
  };
  return (
    <li className="library__manage-row">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        aria-label={fr.library.select(team.name)}
        className="library__check"
      />
      <input
        className="input"
        value={value}
        aria-label={fr.library.rename(team.name)}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      <button
        type="button"
        className="button button--ghost button--icon"
        aria-label={fr.library.delete(team.name)}
        onClick={onDelete}
      >
        🗑
      </button>
      {error && <span className="field__error">{error}</span>}
    </li>
  );
}
