import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { newId, todayIso } from '../../client/ids';
import { draftStore } from '../../client/storage';
import { createDraft, type Draft, duplicateDraft } from '../draft/model';
import { fr } from '../i18n/fr';

export function HomePage() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState(() => draftStore.list());

  const start = () => {
    const draft = createDraft(todayIso(), newId, new Date().toISOString());
    draftStore.save(draft);
    navigate(`/edit/${draft.id}`);
  };

  const duplicate = (source: Draft) => {
    const copy = duplicateDraft(
      source,
      fr.home.copySuffix,
      todayIso(),
      newId,
      new Date().toISOString(),
    );
    draftStore.save(copy);
    navigate(`/edit/${copy.id}`);
  };

  const remove = (id: string) => {
    if (!window.confirm(fr.home.confirmDelete)) return;
    draftStore.remove(id);
    setDrafts(draftStore.list());
  };

  return (
    <main className="page">
      <h1>{fr.appName}</h1>
      <p className="lead">{fr.home.tagline}</p>
      <button type="button" className="button button--primary button--block" onClick={start}>
        {fr.home.newTournament}
      </button>
      {!draftStore.persistent && <p className="notice notice--warning">{fr.home.noStorage}</p>}

      <h2>{fr.home.myDrafts}</h2>
      {drafts.length === 0 ? (
        <p className="muted">{fr.home.noDrafts}</p>
      ) : (
        <ul className="card-list">
          {drafts.map((d) => (
            <li key={d.id} className="card">
              <Link to={`/edit/${d.id}`} className="card__link">
                <strong>{d.name.trim() || fr.home.untitled}</strong>
                <span className="muted">
                  {formatDate(d.date)} · {fr.home.teamsCount(d.teams.length)}
                </span>
              </Link>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => duplicate(d)}
                aria-label={fr.home.duplicateOf(d.name.trim() || fr.home.untitled)}
              >
                {fr.home.duplicate}
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => remove(d.id)}
                aria-label={`${fr.common.delete} ${d.name}`}
              >
                {fr.common.delete}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">{fr.home.localOnly}</p>
    </main>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('fr-BE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
