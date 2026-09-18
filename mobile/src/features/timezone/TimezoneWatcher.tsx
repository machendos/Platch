/* Says that the device has changed zone, once it already has been recorded.
 *
 * The alert is mounted fresh for each zone and opened on the next tick: Ionic
 * reads `header` when the element is created, and only presents when `isOpen`
 * changes from false to true. See docs/timezone.md.
 */

import { useEffect, useState } from 'react';
import { IonAlert } from '@ionic/react';
import { useTimezoneWatch } from './useTimezoneWatch';
import { zoneDisplayName } from './helpers';

const ZoneNotice = ({
  zone,
  onDismissed,
}: {
  zone: string;
  onDismissed: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const openTimer = setTimeout(() => setIsOpen(true), 0);

    return () => clearTimeout(openTimer);
  }, []);

  return (
    <IonAlert
      isOpen={isOpen}
      header={`You're now in ${zoneDisplayName(zone)}`}
      message="Your calendar has moved with you."
      buttons={[{ text: 'Got it', role: 'confirm' }]}
      onDidDismiss={onDismissed}
    />
  );
};

export const TimezoneWatcher = () => {
  const { movedToZone, dismiss } = useTimezoneWatch();

  return movedToZone === null ? null : (
    <ZoneNotice key={movedToZone} zone={movedToZone} onDismissed={dismiss} />
  );
};
