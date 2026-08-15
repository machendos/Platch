import './Modal.css';

import type { ReactNode } from 'react';
import { IonContent, IonModal } from '@ionic/react';

export type ModalPresentation = 'sheet' | 'page';

type ModalProps = {
  isOpen: boolean;
  onDismiss: () => void;
  presentation?: ModalPresentation;
  title?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
};

// The 0 stop is what makes the sheet dismissible by dragging it down; without
// it the sheet can only be collapsed to its smallest breakpoint.
const SHEET_BREAKPOINTS = [0, 0.5, 1];
const SHEET_INITIAL_BREAKPOINT = 0.5;

export const Modal = ({
  isOpen,
  onDismiss,
  presentation = 'page',
  title,
  leading,
  trailing,
  footer,
  children,
}: ModalProps) => {
  const isSheet = presentation === 'sheet';

  return (
    <IonModal
      className={`modal modal-as-${presentation}`}
      mode="ios"
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      breakpoints={isSheet ? SHEET_BREAKPOINTS : undefined}
      initialBreakpoint={isSheet ? SHEET_INITIAL_BREAKPOINT : undefined}
      handle={isSheet}
    >
      <header className="modal-header">
        <div className="modal-header-slot">{leading}</div>
        {title && <h2 className="modal-title">{title}</h2>}
        <div className="modal-header-slot modal-header-slot-trailing">
          {trailing}
        </div>
      </header>

      <IonContent className="modal-body">{children}</IonContent>

      {footer && <footer className="modal-footer">{footer}</footer>}
    </IonModal>
  );
};
