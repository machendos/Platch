import './Modal.css';

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from 'react';
import { IonContent, IonModal, useIonAlert } from '@ionic/react';

export type ModalPresentation = 'sheet' | 'page';

/* Closing goes through here rather than by flipping `isOpen`, because that is
   the only route Ionic runs `canDismiss` on. A Cancel button that unset
   `isOpen` would walk straight past the discard prompt — and would then be
   stuck, since the caller's state would say closed while the modal stayed
   open. Callers keep `isOpen` true for as long as the modal is mounted and
   unmount on `onDismiss`. */
export type ModalHandle = { dismiss: () => void };

type ModalProps = {
  isOpen: boolean;
  onDismiss: () => void;
  presentation?: ModalPresentation;
  title?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  footer?: ReactNode;
  /* Set when the form holds edits that closing would throw away. The modal
     owns the asking rather than each caller, so every form in the app loses
     work the same way — or rather, does not. */
  isDirty?: boolean;
  children?: ReactNode;
};

// The 0 stop is what makes the sheet dismissible by dragging it down; without
// it the sheet can only be collapsed to its smallest breakpoint.
const SHEET_BREAKPOINTS = [0, 0.5, 1];
const SHEET_INITIAL_BREAKPOINT = 0.5;

export const Modal = forwardRef<ModalHandle, ModalProps>(function Modal(
  {
    isOpen,
    onDismiss,
    presentation = 'page',
    title,
    leading,
    trailing,
    footer,
    isDirty = false,
    children,
  },
  ref,
) {
  const isSheet = presentation === 'sheet';
  const [presentAlert] = useIonAlert();
  const element = useRef<HTMLIonModalElement>(null);

  useImperativeHandle(
    ref,
    () => ({ dismiss: () => void element.current?.dismiss() }),
    [],
  );

  /* Ionic's own gate, not a handler on the buttons, because a sheet is
     dismissed by dragging it away — there is no press to intercept. Returning
     false from here is what stops the drag as well as the button. */
  const canDismiss = useCallback(
    () =>
      !isDirty
        ? Promise.resolve(true)
        : new Promise<boolean>((resolve) => {
            presentAlert({
              header: 'Discard changes?',
              message: 'Anything you have edited here will be lost.',
              buttons: [
                {
                  text: 'Keep editing',
                  role: 'cancel',
                  handler: () => resolve(false),
                },
                {
                  text: 'Discard',
                  role: 'destructive',
                  handler: () => resolve(true),
                },
              ],
              // Dismissing the alert itself — a backdrop tap or the back
              // gesture — is not an answer, so it keeps the form.
              onDidDismiss: () => resolve(false),
            });
          }),
    [isDirty, presentAlert],
  );

  return (
    <IonModal
      ref={element}
      className={`modal modal-as-${presentation}`}
      mode="ios"
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      canDismiss={canDismiss}
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
});
