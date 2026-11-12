const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Short random id matching the document id format (letters, digits, max 24 chars). */
export function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let id = prefix;
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
  return id;
}

/** Local date as YYYY-MM-DD (not UTC: a tournament happens where the organizer is). */
export function todayIso(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Random 32-bit seed for the pool draw. */
export function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] as number;
}
