import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { InfoStep } from '../components/InfoStep';
import { PlanningStep } from '../components/PlanningStep';
import { SettingsStep } from '../components/SettingsStep';
import { TeamsStep } from '../components/TeamsStep';
import { isScheduleStale } from '../draft/model';
import { useDraft } from '../draft/useDraft';
import { fr } from '../i18n/fr';

const STEPS = ['info', 'teams', 'settings', 'planning'] as const;
type Step = (typeof STEPS)[number];

export function EditorPage() {
  const { draftId = '' } = useParams();
  const { draft, update } = useDraft(draftId);
  const [step, setStep] = useState<Step>('info');

  if (!draft) {
    return (
      <main className="page">
        <p>{fr.editor.notFound}</p>
        <Link to="/">{fr.notFound.backHome}</Link>
      </main>
    );
  }

  const stepIndex = STEPS.indexOf(step);
  const next = STEPS[stepIndex + 1];
  const stale = isScheduleStale(draft);

  return (
    <main className="page page--editor">
      <header className="editor-header">
        <Link to="/" className="back-link">
          ← {fr.common.back}
        </Link>
        <h1 className="editor-title">{draft.name.trim() || fr.home.untitled}</h1>
      </header>

      <nav className="tabs" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            className={`tabs__tab${s === step ? ' tabs__tab--active' : ''}`}
            aria-current={s === step ? 'step' : undefined}
            onClick={() => setStep(s)}
          >
            <span className="tabs__number">{i + 1}</span>
            {fr.editor.steps[s]}
            {s === 'teams' && draft.teams.length > 0 && ` (${draft.teams.length})`}
            {s === 'planning' && stale && (
              <>
                <span className="tabs__dot" />
                <span className="visually-hidden"> (à régénérer)</span>
              </>
            )}
          </button>
        ))}
      </nav>

      <section className="step">
        {step === 'info' && <InfoStep draft={draft} update={update} />}
        {step === 'teams' && <TeamsStep draft={draft} update={update} />}
        {step === 'settings' && <SettingsStep draft={draft} update={update} />}
        {step === 'planning' && <PlanningStep draft={draft} update={update} />}
      </section>

      {next && (
        <button
          type="button"
          className="button button--primary button--block"
          onClick={() => setStep(next)}
        >
          {fr.editor.next} : {fr.editor.steps[next]}
        </button>
      )}
    </main>
  );
}
