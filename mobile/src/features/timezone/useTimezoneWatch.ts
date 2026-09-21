/* When to look for a zone change, and what to say about it.
 *
 * Triggered by the app coming back rather than by a timer: iOS suspends the
 * app for the whole flight. See docs/timezone.md.
 */

import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { recordDeviceZone } from './recordDeviceZone';

export const useTimezoneWatch = () => {
  const [movedToZone, setMovedToZone] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const zone = await recordDeviceZone();

      if (zone !== null) setMovedToZone(zone);
    };

    void check();

    const onBecameVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };

    document.addEventListener('visibilitychange', onBecameVisible);

    const appStateListener = App.addListener(
      'appStateChange',
      ({ isActive }) => {
        if (isActive) void check();
      },
    );

    return () => {
      document.removeEventListener('visibilitychange', onBecameVisible);
      void appStateListener.then((listener) => listener.remove());
    };
  }, []);

  return { movedToZone, dismiss: () => setMovedToZone(null) };
};
