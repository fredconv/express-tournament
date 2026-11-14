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
  const next = link.direction === 'next';
  return (
    <span className={`b2b ${next ? 'b2b--next' : 'b2b--previous'}`}>
      <span aria-hidden="true">{next ? '↻ ' : '↳ '}</span>
      <strong>{teamName}</strong>
      {' · '}
      {next ? fr.planning.b2bNext : fr.planning.b2bPrevious}{' '}
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
