import { describe, expect, it } from 'vitest';
import {
  addTeams,
  createDraft,
  type Draft,
  generate,
  generateAfternoon,
  generateFinal,
  setResult,
} from '../../src/app/draft/model';
import { fromDoc, toDoc } from '../../src/app/draft/publish';
import { normalizeName, type TournamentDoc, tournamentDocSchema } from '../../src/domain/schemas';

const WIN = [
  { a: 21, b: 15 },
  { a: 21, b: 17 },
];

function playedDay(): Draft {
  let n = 0;
  const ids = (prefix: string) => `${prefix}${++n}`;
  const base = { ...createDraft('2026-06-20', ids, 'now'), name: 'Beach', location: 'Plage' };
  const names = Array.from({ length: 13 }, (_, i) => `Équipe ${i + 1}`).join('\n');
  let day = generate(addTeams(base, names, ids).draft, 3);
  for (const m of day.schedule?.matches ?? []) day = setResult(day, m.id, WIN);
  day = generateAfternoon(day);
  for (const m of day.afternoon?.schedule.matches ?? []) day = setResult(day, m.id, WIN);
  return generateFinal(day);
}

const accepts = (doc: unknown) => tournamentDocSchema.safeParse(doc).success;

describe('tournamentDocSchema', () => {
  it('accepts a full published day and trims labels', () => {
    const doc = toDoc(playedDay());
    expect(accepts(doc)).toBe(true);
    expect(tournamentDocSchema.parse({ ...doc, name: '  Beach  ' }).name).toBe('Beach');
  });

  it('round-trips through the public view', () => {
    const day = playedDay();
    const view = fromDoc(toDoc(day));
    expect(view.afternoon?.schedule.endMinute).toBe(day.afternoon?.schedule.endMinute);
    expect(view.final?.schedule.matches).toEqual(day.final?.schedule.matches);
    expect(view.results).toEqual(day.results);
  });

  it('CA2.2: rejects duplicate team names ignoring case and spaces', () => {
    const doc = toDoc(playedDay());
    doc.teams[1] = { id: doc.teams[1]?.id as string, name: '  équipe   1 ' };
    expect(accepts(doc)).toBe(false);
    expect(normalizeName('  Les  Aigles ')).toBe('les aigles');
  });

  it('CA3.3: rejects values outside the limits', () => {
    const doc = toDoc(playedDay());
    expect(accepts({ ...doc, name: '' })).toBe(false);
    expect(accepts({ ...doc, date: '2026-02-30' })).toBe(false);
    expect(accepts({ ...doc, lunchMinutes: 500 })).toBe(false);
    expect(accepts({ ...doc, startTime: '25:00' })).toBe(false);
    const sevenCourts = Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, name: `T${i}` }));
    expect(accepts({ ...doc, courts: sevenCourts })).toBe(false);
    expect(accepts({ ...doc, sport: 'football' })).toBe(false);
  });

  it('rejects forged schedules and phases', () => {
    const doc = toDoc(playedDay());
    const forged: TournamentDoc = structuredClone(doc);
    (forged.morning.matches[0] as { courtId: string }).courtId = 'nowhere';
    expect(accepts(forged)).toBe(false);
    const shifted = structuredClone(doc);
    for (const m of shifted.afternoon?.matches ?? []) m.startMinute -= 30;
    expect(accepts(shifted)).toBe(false);
    expect(accepts({ ...doc, afternoon: null })).toBe(false);
    const missingTeam = structuredClone(doc);
    missingTeam.morning.pools[0]?.teamIds.pop();
    expect(accepts(missingTeam)).toBe(false);
  });

  it('rejects a published schedule where a team plays three in a row', () => {
    const doc = toDoc(playedDay());
    const forged = structuredClone(doc);
    const [first] = forged.morning.matches;
    const team = (first as { teamAId: string }).teamAId;
    // Put the team's matches on slots 0, 1, 2 by swapping slot numbers only.
    const own = forged.morning.matches.filter((m) => m.teamAId === team || m.teamBId === team);
    own.slice(0, 3).forEach((m, slot) => {
      m.slot = slot;
    });
    const result = tournamentDocSchema.safeParse(forged);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('three matches in a row');
  });

  it('rejects invalid or orphan scores', () => {
    const doc = toDoc(playedDay());
    const finalId = doc.final?.matches[0]?.id as string;
    expect(accepts({ ...doc, results: { ...doc.results, ghost: WIN } })).toBe(false);
    const tied = [
      { a: 21, b: 15 },
      { a: 15, b: 21 },
    ];
    expect(accepts({ ...doc, results: { ...doc.results, [finalId]: tied } })).toBe(false);
    expect(accepts({ ...doc, results: { ...doc.results, [finalId]: WIN } })).toBe(true);
  });
});
