import { describe, expect, it } from 'vitest';
import { formatTime, isValidTime, parseTime } from '../../src/domain/time';

describe('time', () => {
  it('parses HH:mm into minutes since midnight', () => {
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('09:05')).toBe(545);
    expect(parseTime('23:59')).toBe(1439);
  });

  it('rejects invalid times', () => {
    for (const bad of ['24:00', '9:00', '12:60', '', 'ab:cd', '12:5']) {
      expect(isValidTime(bad)).toBe(false);
      expect(() => parseTime(bad)).toThrow(RangeError);
    }
  });

  it('formats minutes and wraps past midnight', () => {
    expect(formatTime(545)).toBe('09:05');
    expect(formatTime(1440 + 30)).toBe('00:30');
    expect(() => formatTime(-1)).toThrow(RangeError);
    expect(() => formatTime(1.5)).toThrow(RangeError);
  });

  it('round-trips every minute of the day', () => {
    for (let m = 0; m < 1440; m++) expect(parseTime(formatTime(m))).toBe(m);
  });
});
