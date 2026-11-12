// Times are minutes since midnight: the tournament happens in one place on one day,
// so no time zone handling is needed (ARCHITECTURE.md §5).

export const MINUTES_PER_DAY = 24 * 60;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** Parses "HH:mm" (00:00–23:59) into minutes since midnight. */
export function parseTime(value: string): number {
  const match = TIME_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`Invalid time "${value}", expected HH:mm`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Formats minutes since midnight as "HH:mm", wrapping past midnight. */
export function formatTime(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new RangeError(`Invalid minute value ${minutes}`);
  }
  const inDay = minutes % MINUTES_PER_DAY;
  const hours = Math.floor(inDay / 60);
  const mins = inDay % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
