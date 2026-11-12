import { LIMITS } from '../../domain/limits';
import { fr } from '../i18n/fr';
import type { StepProps } from './stepProps';

export function InfoStep({ draft, update }: StepProps) {
  return (
    <div className="form">
      <label className="field">
        <span className="field__label">{fr.info.name}</span>
        <input
          className="input"
          value={draft.name}
          maxLength={LIMITS.tournamentNameMax}
          placeholder={fr.info.namePlaceholder}
          onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
        />
      </label>
      <label className="field">
        <span className="field__label">{fr.info.date}</span>
        <input
          className="input"
          type="date"
          value={draft.date}
          onChange={(e) => update((d) => ({ ...d, date: e.target.value }))}
        />
      </label>
      <label className="field">
        <span className="field__label">{fr.info.location}</span>
        <input
          className="input"
          value={draft.location}
          maxLength={LIMITS.locationMax}
          placeholder={fr.info.locationPlaceholder}
          onChange={(e) => update((d) => ({ ...d, location: e.target.value }))}
        />
      </label>
    </div>
  );
}
