import './Warning.css';

import type { ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import { alertCircle } from 'ionicons/icons';

type WarningProps = {
  children: ReactNode;
  className?: string;
};

/* A pill that says "this is allowed, but know about it". Not an error: nothing
   it appears beside is blocked, which is why it has no dismiss, no title and
   no severity — one shape, one colour, one meaning.
   `role="status"` rather than `alert`: it arrives as a consequence of what the
   user just did, so it is announced politely instead of interrupting. */
export const Warning = ({ children, className }: WarningProps) => (
  <p className={className ? `warning ${className}` : 'warning'} role="status">
    <IonIcon className="warning-icon" icon={alertCircle} aria-hidden="true" />
    {children}
  </p>
);
