import { useEffect, useState } from 'react';

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}

/** Integer input that keeps what is typed and only reports values within bounds. */
export function NumberField({ label, value, min, max, suffix, onChange }: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const parsed = Number(text);
  const valid = text.trim() !== '' && Number.isInteger(parsed) && parsed >= min && parsed <= max;

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="field__row">
        <input
          className={`input input--number${valid ? '' : ' input--invalid'}`}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const next = Number(e.target.value);
            if (
              e.target.value.trim() !== '' &&
              Number.isInteger(next) &&
              next >= min &&
              next <= max
            ) {
              onChange(next);
            }
          }}
          onBlur={() => setText(String(value))}
        />
        {suffix && <span className="muted">{suffix}</span>}
      </span>
      {!valid && (
        <span className="field__error">
          {min}–{max}
        </span>
      )}
    </label>
  );
}

interface OptionalNumberFieldProps {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  onChange: (value: number | undefined) => void;
}

/** Like NumberField but may be left empty; partial input does not clear the value. */
export function OptionalNumberField({
  label,
  value,
  min,
  max,
  onChange,
}: OptionalNumberFieldProps) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const parsed = Number(text);
  const valid = text.trim() === '' || (Number.isInteger(parsed) && parsed >= min && parsed <= max);

  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        className={`input input--number${valid ? '' : ' input--invalid'}`}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const n = Number(next);
          if (next.trim() === '') onChange(undefined);
          else if (Number.isInteger(n) && n >= min && n <= max) onChange(n);
        }}
      />
      {!valid && (
        <span className="field__error">
          {min}–{max}
        </span>
      )}
    </label>
  );
}
