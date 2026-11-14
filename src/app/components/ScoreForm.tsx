import { useState } from 'react';
import {
  allowsDraw,
  isForfeit,
  type MatchResult,
  type SetScore,
  scoreIssue,
} from '../../domain/scores';
import type { MatchFormat } from '../../domain/types';
import { fr } from '../i18n/fr';

interface ScoreFormProps {
  format: MatchFormat;
  /** The final needs a winner: a deciding set row is offered when draws are possible. */
  isFinal: boolean;
  initial: MatchResult | undefined;
  teamA: string;
  teamB: string;
  onSave: (sets: SetScore[]) => void;
  /** Forfeit by side A or B: the other team wins without playing. */
  onForfeit: (side: 'a' | 'b') => void;
  onClear: () => void;
  onCancel: () => void;
}

type Row = { a: string; b: string };

/** Set-by-set score entry (SPEC F11). Empty rows are ignored. */
export function ScoreForm(props: ScoreFormProps) {
  const { format, isFinal, initial, teamA, teamB } = props;
  const rowCount = format.setCount + (isFinal && allowsDraw(format) ? 1 : 0);
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: rowCount }, (_, i) => {
      const set = initial && !isForfeit(initial) ? initial[i] : undefined;
      return set ? { a: String(set.a), b: String(set.b) } : { a: '', b: '' };
    }),
  );
  const [error, setError] = useState<string | null>(null);

  const change = (index: number, side: keyof Row, value: string) =>
    setRows((current) => current.map((r, i) => (i === index ? { ...r, [side]: value } : r)));

  const save = () => {
    const filled = rows.filter((r) => r.a.trim() !== '' || r.b.trim() !== '');
    const sets = filled.map((r) => ({ a: toScore(r.a), b: toScore(r.b) }));
    const issue = scoreIssue(sets, format, isFinal);
    if (issue) setError(fr.score.issue[issue]);
    else props.onSave(sets);
  };

  return (
    <div className="score-form">
      <div className="score-form__grid">
        <span />
        <span className="score-form__team">{teamA}</span>
        <span className="score-form__team">{teamB}</span>
        {rows.map((row, i) => {
          const label = i < format.setCount ? fr.score.set(i + 1) : fr.score.extraSet;
          return (
            <ScoreRow
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are fixed set positions
              key={i}
              label={label}
              row={row}
              onChange={(side, value) => change(i, side, value)}
            />
          );
        })}
      </div>
      {error && <p className="field__error">{error}</p>}
      <div className="score-form__forfeit">
        <span className="small muted">{fr.score.forfeitHelp}</span>
        <button type="button" className="button" onClick={() => props.onForfeit('a')}>
          {fr.score.forfeitOf(teamA)}
        </button>
        <button type="button" className="button" onClick={() => props.onForfeit('b')}>
          {fr.score.forfeitOf(teamB)}
        </button>
      </div>
      <div className="score-form__actions">
        <button type="button" className="button button--primary" onClick={save}>
          {fr.score.save}
        </button>
        <button type="button" className="button" onClick={props.onCancel}>
          {fr.score.cancel}
        </button>
        {initial && (
          <button type="button" className="button button--ghost" onClick={props.onClear}>
            {fr.score.clear}
          </button>
        )}
      </div>
    </div>
  );
}

function ScoreRow({
  label,
  row,
  onChange,
}: {
  label: string;
  row: Row;
  onChange: (side: keyof Row, value: string) => void;
}) {
  return (
    <>
      <span className="score-form__label">{label}</span>
      {(['a', 'b'] as const).map((side) => (
        <input
          key={side}
          className="input input--score"
          type="number"
          inputMode="numeric"
          min={0}
          max={99}
          aria-label={`${label} ${side === 'a' ? 'A' : 'B'}`}
          value={row[side]}
          onChange={(e) => onChange(side, e.target.value)}
        />
      ))}
    </>
  );
}

/** Empty or malformed input becomes -1 so that validation reports it. */
function toScore(text: string): number {
  const n = Number(text);
  return text.trim() === '' || !Number.isInteger(n) ? -1 : n;
}
