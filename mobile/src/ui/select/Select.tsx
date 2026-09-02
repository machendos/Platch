import './Select.css';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { IonIcon, IonPopover } from '@ionic/react';
import { chevronDown } from 'ionicons/icons';
import { isCoarsePointer } from '../../system/helpers/pointerKind';
import { useDismissOnOutside } from '../menu/useDismissOnOutside';
import { FieldShell } from '../text-field/FieldShell';
import { optionText, resolveTyped } from './selectOptions';
import type { SelectOption, SelectValue } from './selectOptions';

export type { SelectOption, SelectValue } from './selectOptions';

type SelectProps<T extends SelectValue> = {
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  placeholder?: string;
  className?: string;
  /** Names the trigger element. A form that has to reach a field it did not
      render — to scroll to it, or to mark it — addresses it by this. */
  id?: string;
};

export const Select = <T extends SelectValue>({
  options,
  value,
  onChange,
  label,
  placeholder = 'Not set',
  className,
  id,
}: SelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  // Asked once and cached, the same way TimeInput decides it: swapping the
  // control out from under a focused caret would be worse than being wrong
  // about a hybrid laptop.
  const editable = !isCoarsePointer();

  const popover = useRef<HTMLIonPopoverElement>(null);
  const field = useRef<HTMLElement | null>(null);
  const list = useRef<HTMLDivElement>(null);

  const generatedId = `select-${useId().replace(/[^\w-]/g, '')}`;
  const triggerId = id ?? generatedId;
  const listId = `${triggerId}-list`;

  const selected = options.findIndex((option) => option.value === value);
  const shown = selected >= 0 ? optionText(options[selected]) : '';

  const commit = (index: number) => {
    const option = options[index];
    if (!option) return;

    setTyped(null);
    // Follows the committed row, so a click does not leave the highlight on
    // whatever was active when the panel opened.
    setActive(index);
    if (option.value !== value) onChange(option.value);
  };

  // Keeps the highlight on the row the value is actually on, so opening never
  // proposes a different one. Runs on present rather than on mount because the
  // value can change while the panel is closed.
  const handleWillPresent = () => {
    setIsOpen(true);
    setActive(Math.max(selected, 0));
  };

  // `present` in Ionic's utils/overlays.js calls `restoreElementFocus` for
  // every overlay that is not a toast, and the first thing that does is blur
  // whatever was focused — our field, since a click on it is what opened the
  // panel. Nothing turns it off, so it has to be undone: without this the
  // caret is gone the moment the panel appears and the field cannot be typed
  // into until it is clicked a second time.
  const handleDidPresent = () => {
    if (document.activeElement !== field.current) field.current?.focus();
  };

  // `isOpen` drops here rather than on didDismiss, which is what the field's
  // styling is driven from. didDismiss only fires once the leave animation has
  // finished, so the field went on wearing its open border for the whole
  // animation — the control read as still selected for a beat after the click
  // that closed it, but only when it was open at the time. Closing it by
  // picking a row had already flipped it, so the same click felt instant.
  // Starting and stopping on the two `will` events makes both paths agree.
  const handleWillDismiss = () => setIsOpen(false);

  const handleDidDismiss = () => setIsOpen(false);

  // `restoreElementFocus` snapshots `document.activeElement` the moment the
  // panel presents, and puts focus back there once it closes. If that snapshot
  // is our field, closing this Select reclaims the caret from wherever the user
  // has since moved it — including another Select whose panel is now the one on
  // screen.
  //
  // So the field gives up focus just before Ionic presents, and takes it back
  // in handleDidPresent. Ionic then snapshots `body`, which makes both halves
  // of the restore no-ops: it blurs body going in and focuses body coming out.
  //
  // Blurring *after* the fact instead — on dismiss — cannot work, and is worth
  // remembering: leaving focus on `body` is precisely the condition the restore
  // waits for, so a blur there does not beat the restore, it invites it.
  const releaseBeforePresent = () => field.current?.blur();

  // The row is only reachable once the panel has really been laid out — Ionic
  // lays out asynchronously, so a scroll before that reads zeroes.
  //
  // Deliberately *not* `scrollIntoView`. That is free to scroll any ancestor it
  // likes, and an ancestor scrolling fires a scroll event the dismiss listener
  // below reads as "the page moved" — so the panel dismissed itself. It runs on
  // every change of `active`, which is every keystroke and every arrow press,
  // so the panel could fade out from under the typing that caused it. Moving
  // the list's own scrollTop cannot touch anything outside the list.
  useEffect(() => {
    if (!isOpen) return;

    const view = list.current;
    const row = view?.querySelector(`[data-index="${active}"]`);
    if (!view || !row) return;

    const rowBox = row.getBoundingClientRect();
    const viewBox = view.getBoundingClientRect();

    if (rowBox.top < viewBox.top) {
      view.scrollTop -= viewBox.top - rowBox.top;
    } else if (rowBox.bottom > viewBox.bottom) {
      view.scrollTop += rowBox.bottom - viewBox.bottom;
    }
  }, [isOpen, active]);

  // Touching anything that is neither the panel nor the field closes the panel
  // *and* gives up the caret. Leaving the field focused would mean a second
  // field's panel on screen while the first field still takes the typing.
  useDismissOnOutside(isOpen, [popover, field], () => {
    field.current?.blur();
    popover.current?.dismiss();
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      setTyped(null);
      popover.current?.dismiss();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (isOpen) commit(active);
      popover.current?.dismiss();
      return;
    }

    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];

    if (step !== undefined) {
      event.preventDefault();
      // Closed, an arrow opens rather than stepping blindly through values the
      // user cannot see.
      if (!isOpen) {
        releaseBeforePresent();
        void popover.current?.present();
        return;
      }
      setActive((index) =>
        Math.min(Math.max(index + step, 0), options.length - 1),
      );
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      if (!isOpen) return;
      event.preventDefault();
      setActive(event.key === 'Home' ? 0 : options.length - 1);
    }
  };

  // Open is carried as a class rather than left to the shell's `:focus-within`.
  // The field gives up focus for an instant on the way into `present` (see
  // releaseBeforePresent), and a focus-driven fill would blink off and back on
  // across that gap.
  const rootClassName = ['select', isOpen ? 'select-is-open' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    // The chrome — the hairline, its focus colour and the fill — belongs to
    // FieldShell, the same shell Field/TextField render through. Restating it
    // here would be a second copy of one decision, which is what
    // `--hairline-width` was introduced to stop.
    <FieldShell controlId={triggerId} className={rootClassName}>
      {editable ? (
        <input
          id={triggerId}
          ref={(node) => {
            field.current = node;
          }}
          className="select-field"
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-activedescendant={isOpen ? `${listId}-${active}` : undefined}
          placeholder={placeholder}
          value={typed ?? shown}
          // Capture phase, so it runs before the click listener Ionic put on
          // the trigger — the one that presents the panel.
          onClickCapture={() => {
            if (!isOpen) releaseBeforePresent();
          }}
          onChange={(event) => {
            const text = event.target.value;
            setTyped(text);

            const match = resolveTyped(options, text);
            if (match >= 0) setActive(match);
          }}
          // Typing is resolved only on the way out, so a half-typed "3" on the
          // way to "30" never commits 3. Text that resolves to nothing is
          // discarded rather than guessed at, as TimeInput does.
          onBlur={(event) => {
            const match = resolveTyped(options, event.target.value);
            if (match >= 0) commit(match);
            else setTyped(null);
          }}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <button
          id={triggerId}
          ref={(node) => {
            field.current = node;
          }}
          className="select-field"
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-label={label}
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-activedescendant={isOpen ? `${listId}-${active}` : undefined}
          onClickCapture={() => {
            if (!isOpen) releaseBeforePresent();
          }}
          onClick={() => isOpen && popover.current?.dismiss()}
          onKeyDown={handleKeyDown}
        >
          {selected >= 0 ? (
            options[selected].label
          ) : (
            <span className="select-placeholder">{placeholder}</span>
          )}
        </button>
      )}

      <IonIcon
        className="select-chevron"
        icon={chevronDown}
        aria-hidden="true"
      />

      <IonPopover
        ref={popover}
        className="select-popover"
        mode="ios"
        trigger={triggerId}
        side="bottom"
        // Explicit because `mode="ios"` otherwise defaults it to `center`,
        // which straddles the field instead of lining up with it.
        alignment="start"
        // The panel is exactly as wide as the field. Ionic measures the
        // trigger and writes `--width` itself, so both edges line up without
        // this component measuring anything — and a content-width panel no
        // longer hangs off the left of a field wider than its own rows.
        size="cover"
        arrow={false}
        showBackdrop={false}
        // Focus has to stay on the field: it is what `aria-activedescendant`
        // points from, and on a desktop it is the text box being typed into.
        // Ionic takes it away in three separate places, and each needs its own
        // answer — none of them implies the others:
        //
        //   focusTrap={false}     stops the trap pulling focus back inside.
        //   keyboardClose={false} stops `overlay.el.focus()`, which runs
        //                         *after* didPresent and would overwrite any
        //                         refocus we do there.
        //   handleDidPresent      undoes `restoreElementFocus`, which is called
        //                         unconditionally by `present` and blurs the
        //                         field on the way in. There is no prop for it.
        //
        // Nothing here wants `keyboardClose`'s documented effect either: on
        // touch the field is a button, so there is no keyboard to dismiss.
        focusTrap={false}
        keyboardClose={false}
        onWillPresent={handleWillPresent}
        onDidPresent={handleDidPresent}
        onWillDismiss={handleWillDismiss}
        onDidDismiss={handleDidDismiss}
      >
        <div
          ref={list}
          className="select-list"
          id={listId}
          role="listbox"
          aria-label={label}
          // One delegated handler rather than a closure per row — the lists
          // this holds run to a few dozen options.
          onClick={(event) => {
            const row = (event.target as HTMLElement).closest('[data-index]');
            if (!row) return;

            commit(Number(row.getAttribute('data-index')));
            popover.current?.dismiss();
          }}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${listId}-${index}`}
              data-index={index}
              className={
                index === active
                  ? 'select-option select-option-active'
                  : 'select-option'
              }
              role="option"
              aria-selected={option.value === value}
            >
              <span className="select-option-label">{option.label}</span>
              {option.value === value && (
                <span className="select-option-mark" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </IonPopover>
    </FieldShell>
  );
};
