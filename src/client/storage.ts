import type { Draft } from '../app/draft/model';

// Only module allowed to touch localStorage (AGENTS.md §4).
// Drafts never leave the device until published (SPEC CA1.3).

const DRAFTS_KEY = 'et:drafts:v1';

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
