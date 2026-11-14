import { useCallback, useState } from 'react';
import { libraryStore } from '../../client/storage';
import type { Library, LibraryTeam } from './library';

/** The team library of this device, saved on every change (SPEC F14). */
export function useLibrary() {
  const [library, setLibrary] = useState<LibraryTeam[]>(() => libraryStore.list());
  const update = useCallback((change: (current: Library) => LibraryTeam[]) => {
    setLibrary((current) => {
      const next = change(current);
      libraryStore.save(next);
      return next;
    });
  }, []);
  return { library, update };
}
