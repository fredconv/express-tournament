import { useCallback, useState } from 'react';
import { draftStore } from '../../client/storage';
import type { Draft } from './model';

/** Loads a draft from this device and saves every change immediately (CA1.2). */
export function useDraft(id: string) {
  const [draft, setDraft] = useState<Draft | null>(() => draftStore.get(id));

  const update = useCallback((change: (current: Draft) => Draft) => {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...change(current), updatedAt: new Date().toISOString() };
      draftStore.save(next);
      return next;
    });
  }, []);

  return { draft, update };
}
