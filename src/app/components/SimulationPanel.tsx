import { useState } from 'react';
import type { SimulationMode } from '../../domain/simulate';
import {
  missingInPhase,
  resetSimulated,
  SIM_PHASES,
  type SimPhase,
  simulatePhase,
  simulateToEnd,
  simulationIssue,
} from '../draft/simulation';
import { useSimulationAllowed } from '../draft/useSimulationAllowed';
import { fr } from '../i18n/fr';
import type { StepProps } from './stepProps';
import { TestBadge } from './TestBadge';

/**
 * Test tournaments only (SPEC F15): fills missing scores phase by phase, through the
 * same validation as manual entry. Moving to the next phase stays the normal button,
 * so rankings and afternoon pools can be checked between steps.
 */
export function SimulationPanel({ draft, update }: StepProps) {
  const allowed = useSimulationAllowed();
  const [mode, setMode] = useState<SimulationMode>('random');
  const [seed, setSeed] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  if (!draft.test) return null;

  const options = { mode, seed };
  const simulated = (draft.simulated ?? []).filter((id) => draft.results[id] !== undefined).length;

  const runPhase = (phase: SimPhase) => {
    const result = simulatePhase(draft, phase, options);
    if ('issue' in result) return setMessage(fr.simulation.status[result.issue]);
    update(() => result.draft);
    setMessage(fr.simulation.filled(result.filled, fr.simulation.phases[phase]));
  };

  const runToEnd = () => {
    const result = simulateToEnd(draft, options);
    if (result.draft !== draft) update(() => result.draft);
    const reached = fr.simulation.reached[result.reached ?? 'none'];
    setMessage(result.stop ? `${reached} ${fr.simulation.stop[result.stop]}` : reached);
  };

  const reset = () => {
    if (!window.confirm(fr.simulation.confirmReset(simulated))) return;
    const result = resetSimulated(draft);
    update(() => result.draft);
    setMessage(fr.simulation.removed(result.removed));
  };

  return (
    <details className="simulation no-print">
      <summary className="simulation__summary">
        <TestBadge /> {fr.simulation.title}
      </summary>
      {!allowed ? (
        <p className="notice notice--warning">{fr.simulation.disabled}</p>
      ) : (
        <div className="simulation__body">
          <p className="muted small">{fr.simulation.help}</p>
          <ol className="simulation__phases">
            {SIM_PHASES.map((phase) => {
              const issue = simulationIssue(draft, phase);
              const missing = missingInPhase(draft, phase);
              return (
                <li key={phase} className="simulation__phase">
                  <span>
                    <strong>{fr.simulation.phases[phase]}</strong>
                    <span className="muted small"> · {fr.simulation.phaseHelp[phase]}</span>
                    <br />
                    <span className="small">
                      {issue === null
                        ? fr.simulation.status.ready(missing)
                        : fr.simulation.status[issue]}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="button"
                    disabled={issue !== null}
                    onClick={() => runPhase(phase)}
                  >
                    {fr.simulation.simulate(fr.simulation.phases[phase])}
                  </button>
                </li>
              );
            })}
          </ol>
          <fieldset className="simulation__options">
            <legend className="field__label">{fr.simulation.mode}</legend>
            {(['random', 'favorites'] as const).map((value) => (
              <label key={value} className="checkbox">
                <input
                  type="radio"
                  name="simulation-mode"
                  checked={mode === value}
                  onChange={() => setMode(value)}
                />
                <span>{fr.simulation.modes[value]}</span>
              </label>
            ))}
            <label className="field">
              <span className="field__label">{fr.simulation.seed}</span>
              <input
                className="input input--short"
                type="number"
                min={1}
                value={seed}
                onChange={(e) => setSeed(Math.max(1, Math.trunc(Number(e.target.value)) || 1))}
              />
            </label>
          </fieldset>
          <div className="button-row">
            <button type="button" className="button button--primary" onClick={runToEnd}>
              {fr.simulation.toEnd}
            </button>
            <button
              type="button"
              className="button button--danger-soft"
              disabled={simulated === 0}
              onClick={reset}
            >
              {fr.simulation.reset}
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </details>
  );
}
