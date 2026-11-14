import type { BackToBackLink } from '../../domain/consecutive';
import { formatTime } from '../../domain/time';
import { fr } from '../i18n/fr';

interface BackToBackBadgeProps {
  link: BackToBackLink;
  teamName: string;
  courtName: string;
}

/**
 * One team, one back-to-back (SPEC F13). Two variants of the same badge:
 * orange "plays again right after" on the first match, red "just played" on the second.
 * Time and court of the other match are a button that scrolls to it.
 */
export function BackToBackBadge({ link, teamName, courtName }: BackToBackBadgeProps) {
  return (
    <span className={b2bClassName(link.direction)}>
      <B2bIcon direction={link.direction} />
      <strong>{teamName}</strong>
      {' · '}
      {b2bLabel(link.direction)}{' '}
      <button
        type="button"
        className="b2b__jump"
        title={fr.planning.b2bJump}
        onClick={() => scrollToMatch(link.other.id)}
      >
        {fr.planning.b2bWhere(formatTime(link.other.startMinute), courtName)}
      </button>
    </span>
  );
}

type Direction = BackToBackLink['direction'];

const b2bClassName = (direction: Direction) =>
  `b2b ${direction === 'next' ? 'b2b--next' : 'b2b--previous'}`;

const b2bLabel = (direction: Direction) =>
  direction === 'next' ? fr.planning.b2bNext : fr.planning.b2bPrevious;

function B2bIcon({ direction }: { direction: Direction }) {
  return <span aria-hidden="true">{direction === 'next' ? '↻ ' : '↳ '}</span>;
}

/** Same badge without a team, for the legend. */
export function BackToBackSample({ direction }: { direction: Direction }) {
  return (
    <span className={b2bClassName(direction)}>
      <B2bIcon direction={direction} />
      {b2bLabel(direction)}
    </span>
  );
}

/** Scrolls to the visible card or grid cell of a match (list on mobile, grid on desktop). */
function scrollToMatch(matchId: string): void {
  const target = [...document.querySelectorAll<HTMLElement>(`[data-match-id="${matchId}"]`)].find(
    (element) => element.offsetParent !== null,
  );
  if (!target) return;
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  target.classList.add('is-target');
  window.setTimeout(() => target.classList.remove('is-target'), 1600);
}
