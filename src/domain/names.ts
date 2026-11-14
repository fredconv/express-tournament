/**
 * Team names are unique ignoring case, surrounding/multiple spaces and Unicode
 * normalization (é typed as one or two code points) (SPEC F2).
 */
export function normalizeName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
}
