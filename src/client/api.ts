import type { TournamentDoc } from '../domain/schemas';

// Only module that calls /api (AGENTS.md §4). The management code travels in the
// Authorization header, never in a URL.

export type ApiError = 'network' | 'conflict' | 'unauthorized' | 'not-found' | 'invalid' | 'server';

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiError };

export interface PublishedTournament {
  doc: TournamentDoc;
  version: number;
  updatedAt: string;
}

export function createTournament(doc: TournamentDoc) {
  return call<{ id: string; ownerToken: string; version: number }>('/api/tournaments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });
}

export function updateTournament(id: string, code: string, version: number, doc: TournamentDoc) {
  return call<{ version: number }>(`/api/tournaments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${code}`,
      'If-Match': String(version),
    },
    body: JSON.stringify(doc),
  });
}

export function getTournament(id: string) {
  return call<PublishedTournament>(`/api/tournaments/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
}

async function call<T>(url: string, init: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, error: 'network' };
  }
  if (res.ok) return { ok: true, value: (await res.json()) as T };
  return { ok: false, error: errorOf(res.status) };
}

function errorOf(status: number): ApiError {
  if (status === 409) return 'conflict';
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'not-found';
  if (status === 413 || status === 422 || status === 428) return 'invalid';
  return 'server';
}
