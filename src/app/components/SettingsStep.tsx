import { newId } from '../../client/ids';
import { isSlotEstimate, suggestSlotMinutes } from '../../domain/format';
import { LIMITS } from '../../domain/limits';
import type { MatchFormat } from '../../domain/types';
import {
  renameCourt,
  resetSlotMinutes,
  setCourtCount,
  setMatchFormat,
  setSlotMinutes,
} from '../draft/model';
import { fr } from '../i18n/fr';
import { NumberField, OptionalNumberField } from './NumberField';
import type { StepProps } from './stepProps';

const POINTS_DEFAULT: MatchFormat = {
  kind: 'points',
  setCount: 2,
  pointsPerSet: 25,
  mode: 'all-sets',
};
const TIME_DEFAULT: MatchFormat = { kind: 'time', setCount: 2, minutesPerSet: 10 };

export function SettingsStep({ draft, update }: StepProps) {
  const format = draft.matchFormat;
  const suggested = suggestSlotMinutes(format);
  const changeFormat = (next: MatchFormat) => update((d) => setMatchFormat(d, next));

  return (
    <div className="form">
      <fieldset className="fieldset">
        <legend>{fr.settings.courts}</legend>
        <div className="stepper">
          <button
            type="button"
            className="button button--icon"
            aria-label={fr.settings.lessCourts}
            disabled={draft.courts.length <= LIMITS.minCourts}
            onClick={() => update((d) => setCourtCount(d, d.courts.length - 1, newId))}
          >
            −
          </button>
          <span className="stepper__value">{draft.courts.length}</span>
          <button
            type="button"
            className="button button--icon"
            aria-label={fr.settings.moreCourts}
            disabled={draft.courts.length >= LIMITS.maxCourts}
            onClick={() => update((d) => setCourtCount(d, d.courts.length + 1, newId))}
          >
            +
          </button>
        </div>
        {draft.courts.map((court, i) => (
          <input
            key={court.id}
            className={`input${court.name.trim() === '' ? ' input--invalid' : ''}`}
            value={court.name}
            maxLength={LIMITS.courtNameMax}
            aria-label={fr.settings.courtName(i + 1)}
            onChange={(e) => update((d) => renameCourt(d, court.id, e.target.value))}
          />
        ))}
      </fieldset>

      <fieldset className="fieldset">
        <legend>{fr.settings.format}</legend>
        <div className="segmented" role="radiogroup">
          {(['time', 'points'] as const).map((kind) => (
            <label key={kind} className="segmented__option">
              <input
                type="radio"
                name="format-kind"
                checked={format.kind === kind}
                onChange={() => changeFormat(kind === 'time' ? TIME_DEFAULT : POINTS_DEFAULT)}
              />
              {kind === 'time' ? fr.settings.byTime : fr.settings.byPoints}
            </label>
          ))}
        </div>
        <NumberField
          label={fr.settings.sets}
          value={format.setCount}
          min={LIMITS.minSets}
          max={LIMITS.maxSets}
          onChange={(setCount) => changeFormat({ ...format, setCount })}
        />
        {format.kind === 'time' ? (
          <NumberField
            label={fr.settings.minutesPerSet}
            value={format.minutesPerSet}
            min={LIMITS.minMinutesPerSet}
            max={LIMITS.maxMinutesPerSet}
            suffix={fr.common.minutes}
            onChange={(minutesPerSet) => changeFormat({ ...format, minutesPerSet })}
          />
        ) : (
          <PointsFields format={format} onChange={changeFormat} />
        )}
      </fieldset>

      <fieldset className="fieldset">
        <legend>{fr.settings.timing}</legend>
        <label className="field">
          <span className="field__label">{fr.settings.startTime}</span>
          <input
            className="input"
            type="time"
            value={draft.startTime}
            onChange={(e) => update((d) => ({ ...d, startTime: e.target.value }))}
          />
        </label>
        <NumberField
          label={fr.settings.slot}
          value={draft.slotMinutes}
          min={LIMITS.minSlotMinutes}
          max={LIMITS.maxSlotMinutes}
          suffix={fr.common.minutes}
          onChange={(m) => update((d) => setSlotMinutes(d, m))}
        />
        <p className="muted small">
          {fr.settings.slotSuggested(suggested, isSlotEstimate(format))}{' '}
          {draft.slotMinutes !== suggested && (
            <button
              type="button"
              className="link-button"
              onClick={() => update((d) => resetSlotMinutes(d))}
            >
              {fr.settings.useSuggestion}
            </button>
          )}
        </p>
        <NumberField
          label={fr.settings.transition}
          value={draft.transitionMinutes}
          min={0}
          max={LIMITS.maxTransitionMinutes}
          suffix={fr.common.minutes}
          onChange={(transitionMinutes) => update((d) => ({ ...d, transitionMinutes }))}
        />
        <label className="field">
          <span className="field__label">{fr.settings.targetEnd}</span>
          <input
            className="input"
            type="time"
            value={draft.targetEndTime}
            onChange={(e) => update((d) => ({ ...d, targetEndTime: e.target.value }))}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={draft.avoidBackToBack}
            onChange={(e) => update((d) => ({ ...d, avoidBackToBack: e.target.checked }))}
          />
          {fr.settings.rest}
        </label>
      </fieldset>
    </div>
  );
}

type PointsFormat = Extract<MatchFormat, { kind: 'points' }>;

function PointsFields({
  format,
  onChange,
}: {
  format: PointsFormat;
  onChange: (f: MatchFormat) => void;
}) {
  const { decidingSetPoints, ...withoutDeciding } = format;
  return (
    <>
      <NumberField
        label={fr.settings.pointsPerSet}
        value={format.pointsPerSet}
        min={LIMITS.minPointsPerSet}
        max={LIMITS.maxPointsPerSet}
        onChange={(pointsPerSet) => onChange({ ...format, pointsPerSet })}
      />
      <div className="segmented" role="radiogroup" aria-label={fr.settings.mode}>
        {(['all-sets', 'best-of'] as const).map((mode) => (
          <label key={mode} className="segmented__option">
            <input
              type="radio"
              name="points-mode"
              checked={format.mode === mode}
              onChange={() => onChange({ ...format, mode })}
            />
            {mode === 'all-sets' ? fr.settings.allSets : fr.settings.bestOf}
          </label>
        ))}
      </div>
      <OptionalNumberField
        label={fr.settings.decidingSet}
        value={decidingSetPoints}
        min={LIMITS.minPointsPerSet}
        max={LIMITS.maxPointsPerSet}
        onChange={(value) =>
          onChange(value === undefined ? withoutDeciding : { ...format, decidingSetPoints: value })
        }
      />
    </>
  );
}
