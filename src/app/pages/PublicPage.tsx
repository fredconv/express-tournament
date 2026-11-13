import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { getTournament, type PublishedTournament } from '../../client/api';
import { deviceStore } from '../../client/storage';
import { Champion, DaySummary, Legend, PhaseSection, TeamFilter } from '../components/DayView';
import { fromDoc } from '../draft/publish';
import { fr } from '../i18n/fr';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; notFound: boolean }
  | { kind: 'ready'; data: PublishedTournament };

/** Participant view behind the QR code (SPEC F6, F7): read-only, printable. */
export function PublicPage() {
  const { id = '' } = useParams();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [teamId, setTeamId] = useState<string | null>(() => deviceStore.myTeam(id) || null);

  const load = useCallback(async () => {
    const result = await getTournament(id);
    setState((current) => {
      if (result.ok) return { kind: 'ready', data: result.value };
      // Keep the last version on screen if a refresh fails.
      if (current.kind === 'ready') return current;
      return { kind: 'error', notFound: result.error === 'not-found' };
    });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'loading') return <Shell>{fr.publicPage.loading}</Shell>;
  if (state.kind === 'error') {
    return <Shell>{state.notFound ? fr.publicPage.notFound : fr.publicPage.error}</Shell>;
  }

  const { doc, updatedAt } = state.data;
  const draft = fromDoc(doc);
  const selected = draft.teams.some((t) => t.id === teamId) ? teamId : null;
  const chooseTeam = (next: string | null) => {
    setTeamId(next);
    deviceStore.saveMyTeam(id, next);
  };
  const updated = new Date(updatedAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const date = new Date(`${doc.date}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const phaseProps = { draft, teamId: selected };

  return (
    <main className="page page--public">
      <header className="public-header">
        <h1>{doc.name}</h1>
        <p className="muted">
          {date}
          {doc.location && ` · ${doc.location}`}
        </p>
        <DaySummary draft={draft} />
        <div className="public-actions no-print">
          <button type="button" className="button" onClick={() => void load()}>
            {fr.publicPage.refresh}
          </button>
          <button type="button" className="button" onClick={() => window.print()}>
            {fr.publicPage.print}
          </button>
          <span className="muted small">{fr.publicPage.updatedAt(updated)}</span>
        </div>
      </header>

      <TeamFilter draft={draft} teamId={selected} onChange={chooseTeam} />
      <Legend draft={draft} />
      <Champion draft={draft} />
      {draft.final && (
        <PhaseSection
          {...phaseProps}
          title={fr.planning.final}
          pools={[]}
          schedule={draft.final.schedule}
        />
      )}
      {draft.afternoon && (
        <PhaseSection
          {...phaseProps}
          title={fr.planning.afternoon}
          pools={draft.afternoon.pools}
          schedule={draft.afternoon.schedule}
        />
      )}
      {draft.schedule && (
        <PhaseSection
          {...phaseProps}
          title={fr.planning.morning}
          pools={draft.pools}
          schedule={draft.schedule}
        />
      )}
      {!draft.afternoon && <p className="muted no-print">{fr.publicPage.afternoonPending}</p>}
    </main>
  );
}

function Shell({ children }: { children: string }) {
  return (
    <main className="page">
      <p>{children}</p>
    </main>
  );
}
