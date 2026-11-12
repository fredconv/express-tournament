import { describe, expect, it } from 'vitest';
import { normalizeName, type TournamentDoc, tournamentDocSchema } from '../../src/domain/schemas';
import { schedule } from './helpers';

function validDoc(teamCount = 6): TournamentDoc {
  const result = schedule(teamCount, 2);
  return {
    schemaVersion: 1,
    name: 'Tournoi du club',
    date: '2026-12-05',
    location: 'Salle omnisports',
    sport: 'volleyball',
    matchFormat: { kind: 'time', setCount: 2, minutesPerSet: 10 },
    schedule: { startMinute: 9 * 60, slotMinutes: 20, transitionMinutes: 5, avoidBackToBack: true },
    courts: [
      { id: 'c1', name: 'Terrain 1' },
      { id: 'c2', name: 'Terrain 2' },
    ],
    teams: Array.from({ length: teamCount }, (_, i) => ({
      id: `t${i + 1}`,
      name: `Équipe ${i + 1}`,
    })),
    matches: result.matches,
    warnings: result.warnings,
  };
}

const accepts = (doc: unknown) => tournamentDocSchema.safeParse(doc).success;

describe('tournamentDocSchema', () => {
  it('accepts a generated tournament and trims labels', () => {
    const parsed = tournamentDocSchema.parse({ ...validDoc(), name: '  Tournoi  ' });
    expect(parsed.name).toBe('Tournoi');
  });

  it('accepts a points format with a deciding set', () => {
    const matchFormat = {
      kind: 'points',
      setCount: 3,
      pointsPerSet: 25,
      mode: 'best-of',
      decidingSetPoints: 15,
    };
    expect(accepts({ ...validDoc(), matchFormat })).toBe(true);
  });

  it('CA2.2: rejects duplicate team names ignoring case and spaces', () => {
    const doc = validDoc();
    doc.teams[1] = { id: 't2', name: '  équipe   1 ' };
    expect(accepts(doc)).toBe(false);
    expect(normalizeName('  Les  Aigles ')).toBe('les aigles');
  });

  it('CA3.3: rejects values outside the limits', () => {
    const doc = validDoc();
    expect(accepts({ ...doc, name: '' })).toBe(false);
    expect(accepts({ ...doc, name: 'x'.repeat(81) })).toBe(false);
    expect(accepts({ ...doc, date: '2026-02-30' })).toBe(false);
    expect(accepts({ ...doc, schedule: { ...doc.schedule, slotMinutes: 2 } })).toBe(false);
    expect(accepts({ ...doc, matchFormat: { kind: 'time', setCount: 9, minutesPerSet: 10 } })).toBe(
      false,
    );
    const tooMany = Array.from({ length: 33 }, (_, i) => ({ id: `t${i}`, name: `T${i}` }));
    expect(accepts({ ...doc, teams: tooMany })).toBe(false);
  });

  it('rejects a forged schedule (unknown team)', () => {
    const doc = validDoc();
    const forged = doc.matches.map((m, i) => (i === 0 ? { ...m, teamAId: 'ghost' } : m));
    const result = tournamentDocSchema.safeParse({ ...doc, matches: forged });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('schedule: unknown-team');
  });

  it('rejects duplicate ids, unexpected ids and unknown sports', () => {
    const doc = validDoc();
    expect(accepts({ ...doc, teams: [{ id: '<script>', name: 'x' }, ...doc.teams] })).toBe(false);
    expect(accepts({ ...doc, courts: [doc.courts[0], doc.courts[0]] })).toBe(false);
    expect(accepts({ ...doc, sport: 'football' })).toBe(false);
  });
});
