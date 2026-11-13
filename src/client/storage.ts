import type { Draft } from '../app/draft/model';

// Only module allowed to touch localStorage (AGENTS.md §4).
// Drafts never leave the device until published (SPEC CA1.3).

const DRAFTS_KEY = 'et:drafts:v2';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Storage can be disabled (private mode, blocked cookies).
    return null;
  }
}

export function createDraftStore(store: KeyValueStore | null = defaultStore()) {
  const memory = new Map<string, Draft>();

  const readAll = (): Record<string, Draft> => {
    if (!store) return Object.fromEntries(memory);
    try {
      const raw = store.getItem(DRAFTS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, Draft>) : {};
    } catch {
      return {};
    }
  };

  const writeAll = (drafts: Record<string, Draft>) => {
    if (!store) {
      memory.clear();
      for (const [id, d] of Object.entries(drafts)) memory.set(id, d);
      return;
    }
    store.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  };

  return {
    persistent: store !== null,
    list(): Draft[] {
      return Object.values(readAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    get(id: string): Draft | null {
      return readAll()[id] ?? null;
    },
    save(draft: Draft): void {
      writeAll({ ...readAll(), [draft.id]: draft });
    },
    remove(id: string): void {
      const { [id]: _removed, ...rest } = readAll();
      writeAll(rest);
    },
  };
}

export type DraftStore = ReturnType<typeof createDraftStore>;

export const draftStore = createDraftStore();

const OWNER_CODES_KEY = 'et:owner-codes:v1';
const MY_TEAM_PREFIX = 'et:my-team:';

/**
 * Management codes of the tournaments published from this device (SPEC F9), by public
 * id, and the team each participant follows on a public page (SPEC F6).
 */
export function createDeviceStore(store: KeyValueStore | null = defaultStore()) {
  const memory = new Map<string, string>();
  const read = (key: string) => (store ? safe(() => store.getItem(key)) : memory.get(key)) ?? null;
  const write = (key: string, value: string) => {
    if (store) safe(() => store.setItem(key, value));
    else memory.set(key, value);
  };
  const codes = (): Record<string, string> => {
    try {
      const parsed: unknown = JSON.parse(read(OWNER_CODES_KEY) ?? '{}');
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  };

  return {
    ownerCode: (tournamentId: string): string | null => codes()[tournamentId] ?? null,
    saveOwnerCode: (tournamentId: string, code: string) =>
      write(OWNER_CODES_KEY, JSON.stringify({ ...codes(), [tournamentId]: code })),
    myTeam: (tournamentId: string): string | null => read(MY_TEAM_PREFIX + tournamentId),
    saveMyTeam: (tournamentId: string, teamId: string | null) =>
      write(MY_TEAM_PREFIX + tournamentId, teamId ?? ''),
  };
}

function safe<T>(action: () => T): T | undefined {
  try {
    return action();
  } catch {
    return undefined;
  }
}

export const deviceStore = createDeviceStore();
