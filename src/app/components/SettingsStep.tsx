import { newId } from '../../client/ids';
import { isSlotEstimate } from '../../domain/format';
import { LIMITS } from '../../domain/limits';
import type { MatchFormat } from '../../domain/types';
import {
  MAX_LUNCH_MINUTES,
  matchMinutesOf,
  renameCourt,
  setCourtCount,
  setMatchFormat,
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
const COURT_CHOICES = Array.from(
  { length: LIMITS.maxCourts - LIMITS.minCourts + 1 },
  (_, i) => LIMITS.minCourts + i,
);

export function SettingsStep({ draft, update }: StepProps) {
  const format = draft.matchFormat;
  const changeFormat = (next: MatchFormat) => update((d) => setMatchFormat(d, next));

  return (
    <div className="form">
      <fieldset className="fieldset">
        <legend>{fr.settings.courts}</legend>
        <div className="segmented" role="radiogroup" aria-label={fr.settings.courtCount}>
          {COURT_CHOICES.map((count) => (
            <label key={count} className="segmented__option">
              <input
                type="radio"
                name="court-count"
                checked={draft.courts.length === count}
                onChange={() => update((d) => setCourtCount(d, count, newId))}
              />
              {count}
            </label>
          ))}
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
        <p className="field">
          <span className="field__label">{fr.settings.slot}</span>
          <span>
            <strong>{fr.settings.slotValue(matchMinutesOf(draft))}</strong>{' '}
            <span className="muted small">{fr.settings.slotHelp(isSlotEstimate(format))}</span>
          </span>
        </p>
        <NumberField
          label={fr.settings.transition}
          value={draft.transitionMinutes}
          min={0}
          max={LIMITS.maxTransitionMinutes}
          suffix={fr.common.minutes}
          onChange={(transitionMinutes) => update((d) => ({ ...d, transitionMinutes }))}
        />
        <NumberField
          label={fr.settings.lunch}
          value={draft.lunchMinutes}
          min={0}
          max={MAX_LUNCH_MINUTES}
          suffix={fr.common.minutes}
          onChange={(lunchMinutes) => update((d) => ({ ...d, lunchMinutes }))}
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
