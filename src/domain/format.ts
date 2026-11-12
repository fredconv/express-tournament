import type { MatchFormat } from './types';

/** Minutes added between two sets (side change, short break). */
export const SET_CHANGEOVER_MINUTES = 2;

/** Field estimates for a volleyball set played to N points (decision D1). */
const KNOWN_SET_ESTIMATES: Readonly<Record<number, number>> = {
  15: 12,
  21: 17,
  25: 20,
};

/** Estimated minutes for one set played to `points` points. */
export function estimateSetMinutes(points: number): number {
  return KNOWN_SET_ESTIMATES[points] ?? Math.max(1, Math.round(points * 0.8));
}

/**
 * Suggested court slot length for one match (decision D1).
 * Time format: exact. Points format: an estimate the organizer can change.
 * Best-of formats are sized for the maximum number of sets so a slot never overruns.
 */
export function suggestSlotMinutes(format: MatchFormat): number {
  const changeovers = (format.setCount - 1) * SET_CHANGEOVER_MINUTES;
  if (format.kind === 'time') {
    return format.setCount * format.minutesPerSet + changeovers;
  }
  const regularSets =
    format.decidingSetPoints === undefined ? format.setCount : format.setCount - 1;
  const decidingSet =
    format.decidingSetPoints === undefined ? 0 : estimateSetMinutes(format.decidingSetPoints);
  return regularSets * estimateSetMinutes(format.pointsPerSet) + decidingSet + changeovers;
}

/** Whether the suggested slot length is exact (time) or an estimate (points). */
export function isSlotEstimate(format: MatchFormat): boolean {
  return format.kind === 'points';
}
