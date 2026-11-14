import { LIMITS } from '../../domain/limits';
import { normalizeName } from '../../domain/names';
import type { IdFactory, NamedItem } from './model';

// Team library (SPEC F14): names the organizer chose to keep for later tournaments.
// A library team is NOT a tournament team: adding it to a tournament copies its name
// into a new tournament team, so renaming or deleting it here never changes a
// tournament, its matches, scores or rankings.

export type LibraryTeam = NamedItem;
export type Library = readonly LibraryTeam[];

export type LibraryIssue = 'empty' | 'too-long' | 'duplicate';

function clean(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ');
}

function nameIssue(library: Library, name: string, exceptId?: string): LibraryIssue | null {
  if (name === '') return 'empty';
  if (name.length > LIMITS.teamNameMax) return 'too-long';
  const key = normalizeName(name);
  return library.some((t) => t.id !== exceptId && normalizeName(t.name) === key)
    ? 'duplicate'
    : null;
}

export function libraryHas(library: Library, name: string): boolean {
  const key = normalizeName(name);
  return library.some((t) => normalizeName(t.name) === key);
}

/** Saves names not yet in the library; existing ones are reported, never duplicated. */
export function saveToLibrary(
  library: Library,
  names: readonly string[],
  newId: IdFactory,
): { library: LibraryTeam[]; added: string[]; skipped: string[] } {
  const next = [...library];
  const added: string[] = [];
  const skipped: string[] = [];
  for (const raw of names) {
    const name = clean(raw);
    if (name === '') continue;
    if (nameIssue(next, name) === null) {
      next.push({ id: newId('l'), name });
      added.push(name);
    } else {
      skipped.push(name);
    }
  }
  return { library: next, added, skipped };
}

export function renameInLibrary(
  library: Library,
  id: string,
  name: string,
): { library: LibraryTeam[] } | { issue: LibraryIssue } {
  const cleaned = clean(name);
  const issue = nameIssue(library, cleaned, id);
  if (issue) return { issue };
  return { library: library.map((t) => (t.id === id ? { ...t, name: cleaned } : t)) };
}

export function removeFromLibrary(library: Library, ids: readonly string[]): LibraryTeam[] {
  const gone = new Set(ids);
  return library.filter((t) => !gone.has(t.id));
}

/** Alphabetical, filtered on a part of the name (case, accents and spaces ignored). */
export function searchLibrary(library: Library, query: string): LibraryTeam[] {
  const key = fold(query);
  return library
    .filter((t) => key === '' || fold(t.name).includes(key))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
}

function fold(text: string): string {
  return normalizeName(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
