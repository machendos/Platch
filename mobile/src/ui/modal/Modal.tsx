import './Modal.css';

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from 'react';
import { IonContent, IonModal, useIonAlert } from '@ionic/react';
import { useKeyboardInset } from '../../system/keyboard/useKeyboardInset';
import { useReleaseKeyboardPan } from '../../system/keyboard/useReleaseKeyboardPan';

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
  const body = useRef<HTMLIonContentElement>(null);

  /* The keyboard costs the content reach at both ends, for two unrelated
     reasons, and neither half works without the other: iOS pans the locked
     document to lift the caret, which puts that many pixels beyond any
     scroller's reach at the top, and the keyboard covers the bottom of the
     viewport without shrinking it, leaving nowhere to scroll the last lines
     to. One hook each. */
  useReleaseKeyboardPan(body);
  useKeyboardInset();

  useImperativeHandle(
    ref,
    () => ({ dismiss: () => void element.current?.dismiss() }),
    [],
  );

  /* A dismissal asks this **twice**, and the second ask is Ionic answering
     itself. `ion-modal` watches `isOpen` and calls `dismiss()` — with no role,
     so nothing exempts it — whenever the prop goes true → false. Discarding
     therefore runs: backdrop dismiss → alert → Ionic dismisses → didDismiss →
     our `onDismiss` → the caller drops `isOpen` → the watcher dismisses again
     → a second "Discard changes?" over a modal already on its way out.

     Cancel escapes it only by accident of order: it drops `isOpen` first, so
     by the time `didDismiss` calls `onDismiss` there is no change left to
     watch. That asymmetry is the tell.

     So the gate remembers whether the modal is still there to guard. Ionic
     knows too — it clears `presented` before emitting `didDismiss` — but that
     is internal state and absent from `HTMLIonModalElement`, so this tracks the
     same fact through the events it does publish. An ask that arrives after the
     modal is gone is guarding nothing and is let through.

     `asking` covers the other direction, two asks racing while an alert is
     already up. Those cannot come from `dismiss()`, which serialises behind a
     lock — they come from the sheet gesture, which calls `canDismiss` directly
     on its way past the dismiss threshold. */
  const asking = useRef<Promise<boolean> | null>(null);
  const gone = useRef(false);

  /* Ionic's own gate, not a handler on the buttons, because a sheet is
     dismissed by dragging it away — there is no press to intercept. Returning
     false from here is what stops the drag as well as the button. */
  const canDismiss = useCallback(() => {
    if (!isDirty || gone.current) return Promise.resolve(true);
    if (asking.current) return asking.current;

    const asked = new Promise<boolean>((resolve) => {
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
    }).then((discard) => {
      if (!discard) asking.current = null;
      return discard;
    });

    asking.current = asked;
    return asked;
  }, [isDirty, presentAlert]);

  return (
    <IonModal
      ref={element}
      className={`modal modal-as-${presentation}`}
      mode="ios"
      isOpen={isOpen}
      /* Reset on the way in, not on the way out. `onDidDismiss` looks like the
         bookend and is the one place it must not go: the very next thing it
         does is call `onDismiss`, which is what provokes the second ask. */
      onWillPresent={() => {
        asking.current = null;
        gone.current = false;
      }}
      /* Marked before `onDismiss`, not after — that call is what sends the
         watcher back here. */
      onDidDismiss={() => {
        gone.current = true;
        onDismiss();
      }}
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

      <IonContent ref={body} className="modal-body">
        <div className="modal-form">{children}</div>
      </IonContent>

      {footer && <footer className="modal-footer">{footer}</footer>}
    </IonModal>
  );
});
