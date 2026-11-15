import { useEffect, useState } from 'react';
import { getConfig } from '../../client/api';

let cached: Promise<boolean> | null = null;

/**
 * Whether this deployment offers test tournaments (SPEC F15): previews yes, production
 * no. Only shows or hides UI; the server refuses test documents where it is off.
 */
export function useSimulationAllowed(): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    cached ??= getConfig().then((config) => config.simulation);
    let active = true;
    void cached.then((value) => {
      if (active) setAllowed(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return allowed;
}
