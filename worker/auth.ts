// Management code (ARCHITECTURE.md §8): 160 random bits, only its SHA-256 hash is stored,
// sent by the client in `Authorization: Bearer`, never in a URL, a log or a response
// other than the creation one.

const CODE_BYTES = 20;
const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const ID_LENGTH = 10;

export function newOwnerCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_BYTES));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** Short public id, unambiguous characters only. */
export function newPublicId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  let id = '';
  for (const byte of bytes) id += ID_ALPHABET[byte % ID_ALPHABET.length];
  return id;
}

export async function hashCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison of two hex hashes of equal length. */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function bearerCode(header: string | undefined): string | null {
  const match = /^Bearer ([A-Za-z0-9_-]{16,64})$/.exec(header ?? '');
  return match ? (match[1] as string) : null;
}
