/** Team names are unique ignoring case and surrounding/multiple spaces (SPEC F2). */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
}
