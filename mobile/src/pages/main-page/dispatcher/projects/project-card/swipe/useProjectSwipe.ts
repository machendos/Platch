import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { clamp } from '../../../../../../system/helpers/helpers';
import { prefersReducedMotion } from '../../../../../../system/helpers/prefersReducedMotion';
import { setScrollLocked } from '../../../../../../system/helpers/scrollLock';
import {
  DRAG_TOUCH_DELAY_MS,
  PROJECT_REVEAL_DURATION_MS,
  PROJECT_SWIPE_EXIT_MS,
  PROJECT_SWIPE_RETURN_MS,
} from '../../../layoutConfig';
import type { LucideIcon } from '../../../../../../system/lucideIcons';
import { decideAxis, swipeCommitDistance } from './swipeAxisManager';
import type { SwipeAxisManager } from './swipeAxisManager';

const TOP_PROPERTY = '--project-swipe-top';
const HEIGHT_PROPERTY = '--project-swipe-height';
const RETURNING_CLASS = 'project-row-swipe-returning';
const LEAVING_CLASS = 'project-row-swipe-leaving';
const DEPARTING_ATTRIBUTE = 'data-departing';

/* How long after a motion's nominal end to give up waiting for its event. Only
   ever reached when the event cannot arrive at all — reduced motion, or a
   transition the browser decided was a no-op. */
const SETTLE_GRACE_MS = 80;

/* How long to leave a departed row collapsed before deciding it is not going
   anywhere. Only reached when the move was rejected and the reload put the row
   back; on the happy path React has unmounted it long before. */
const REJECTED_RESTORE_MS = 400;

export type SwipeAction = {
  label: string;
  lucideIcon: LucideIcon;
  onCommit: (id: string) => void;
};

type SwipeOptions = {
  action: SwipeAction | null;
  /** Everything that leaves with the swiped row, in drawn order, itself first. */
  rowsLeavingWith: (id: string) => string[];
};

/**
 * Swipe a row sideways to commit the action its list offers.
 *
 * It does not know what that action is. The caller hands it a label, an icon and
 * a callback taking the swiped row's id, and decides for itself which rows get
 * one — so a section built over entirely different data can take the gesture as
 * it stands, by rendering the same card.
 *
 * Three gestures share this element, and the whole job is telling them apart.
 * The browser owns vertical panning (`touch-action: pan-y`), dnd-kit owns the
 * long press, and this owns sideways travel. Two thresholds separate them and
 * they are deliberately the same numbers dnd-kit is configured with:
 *
 * - inside 8px, the long press is still pending, so the touch is not ours;
 * - past 8px within 250ms, dnd-kit has aborted itself and the axis decides
 *   between a scroll (we do nothing at all) and a swipe;
 * - past 250ms still undecided, the drag has already started and we stay out.
 *
 * Bound to the list rather than to each row, because rows unmount constantly —
 * an ancestor collapsing, the reveal animation, a snapshot arriving mid-gesture
 * — and React tears a per-row listener down with them, mid-touch.
 *
 * Releasing the scroll lock is the part that must not be missed: leave
 * `overflow: hidden` on the section and it silently stops scrolling. Ending on
 * the document rather than the list covers a finger that lifts elsewhere. It
 * does not cover the row being detached mid-gesture — once React removes it,
 * neither its moves nor its end reach anything, wherever the listener sits — so
 * `touchstart` unlocks unconditionally before doing anything else. That is the
 * real guarantee: the section is at worst unscrollable until the next touch,
 * which is the very thing someone does when scrolling appears stuck.
 *
 * State is split to match what it describes: the list carries the gesture (which
 * side, whether it is armed, where the action surface sits), the row carries only
 * its own offset.
 */
export const useProjectSwipe = (
  listRef: RefObject<HTMLElement | null>,
  { action, rowsLeavingWith }: SwipeOptions,
) => {
  const latest = useRef({ action, rowsLeavingWith });
  latest.current = { action, rowsLeavingWith };

  /* The action is read through the ref, so a caller rebuilding it every render
     cannot restart the gesture. Only whether there is one at all is a dependency. */
  const enabled = action !== null;

  useEffect(() => {
    const list = listRef.current;
    if (!list || !enabled) return;

    const scroller = list.closest<HTMLElement>('.section-body');

    let row: HTMLElement | null = null;
    let axis: SwipeAxisManager | null = null;
    let abandoned = false;
    let startX = 0;
    let startY = 0;
    /* Where the finger was when the axis locked, which is not where it landed.
       The row follows it from here: painting the distance from `startX` instead
       pops the row by the whole activation distance on the frame it is claimed —
       8px at the very least, and as far as the finger travelled in one frame at
       speed. Measuring from the lock also means the commit distance is the
       travel actually seen, rather than that plus a threshold. */
    let originX = 0;
    let startedAt = 0;
    let travel = 0;
    let rowWidth = 0;
    let commitAt = 0;
    let suppressClick = false;

    /* Held apart from `row`, which is dropped the moment the finger lifts. The
       settle outlives the touch, so without its own handle a second swipe
       starting inside it strands the first row wearing its offset for good. */
    let settling: HTMLElement | null = null;
    let stopWaiting: (() => void) | null = null;

    const ms = (value: number) => (prefersReducedMotion() ? 0 : value);

    /**
     * Switches a transition on and *then* moves, with the row committed in
     * between.
     *
     * WebKit will not start a transition when the property that carries it and
     * the property's new value arrive in the same task — it has nothing to
     * animate from, so the row jumps and `transitionend` never fires. The whole
     * exit was then spent waiting out the backstop, which is the delay between
     * lifting a finger and anything happening. Chromium starts it regardless,
     * which is why this only ever showed up on a device.
     *
     * `pageOffset.ts` carries the same forced reflow, for the same reason.
     */
    const transitionTo = (
      target: HTMLElement,
      className: string,
      dx: number,
      durationMs: number,
    ) => {
      /* Duration first: the commit below bakes in whatever is current, so a
         duration set afterwards would not apply until the next change. */
      target.style.transitionDuration = `${durationMs}ms`;
      target.classList.add(className);
      void target.offsetWidth;
      paint(target, dx);
    };

    /**
     * Runs `then` when the row has *actually* finished moving.
     *
     * The event is the authority and the timer only a backstop, which is the
     * opposite of how this started. A timer is late whenever the tab is not in
     * front — measurably by most of a second — and everything downstream of it
     * was visible: the action surface stayed lit long after the row had left,
     * which is exactly the complaint. `transitionend` and `animationend` are tied
     * to the motion the eye is following, so they cannot drift from it.
     */
    const whenDone = (
      target: HTMLElement,
      type: 'transitionend' | 'animationend',
      nominalMs: number,
      then: () => void,
    ) => {
      const finish = () => {
        stopWaiting?.();
        then();
      };

      const onEnd = (event: Event) => {
        if (event.target !== target) return;
        // The row also transitions its spacing; only its travel ends the phase.
        if (
          type === 'transitionend' &&
          (event as TransitionEvent).propertyName !== 'transform'
        )
          return;
        finish();
      };

      target.addEventListener(type, onEnd);
      const timer = window.setTimeout(finish, nominalMs + SETTLE_GRACE_MS);

      stopWaiting = () => {
        target.removeEventListener(type, onEnd);
        window.clearTimeout(timer);
        stopWaiting = null;
      };
    };

    const paint = (target: HTMLElement, dx: number) => {
      const side = dx < 0 ? 'end' : 'start';
      if (list.dataset.swipeSide !== side) list.dataset.swipeSide = side;
      list.toggleAttribute('data-swipe-armed', Math.abs(dx) >= commitAt);
      /* Written straight onto `transform`, not through a custom property the
         stylesheet reads. WebKit does not reliably start a transition when the
         transitioned property only changed because a var() it depends on did —
         on device the exit fired no `transitionend` at all, the row jumped off
         instead of travelling, and its space sat there until the backstop. */
      target.style.transform = `translateX(${dx}px)`;
    };

    /* The surface only. Split from the row because a departing row outlives it:
       the line goes dark the moment the row is off it, while the row itself
       still has its space to close. */
    const clearSurface = () => {
      delete list.dataset.swipeSide;
      delete list.dataset.swipePhase;
      list.removeAttribute('data-swipe-armed');
      list.style.removeProperty(TOP_PROPERTY);
      list.style.removeProperty(HEIGHT_PROPERTY);
    };

    const clearRow = (target: HTMLElement | null) => {
      if (!target) return;
      target.classList.remove(RETURNING_CLASS, LEAVING_CLASS);
      target.style.removeProperty('transition-duration');
      target.style.removeProperty('transform');
    };

    const clear = (target: HTMLElement | null) => {
      stopWaiting?.();
      settling = null;
      clearSurface();
      clearRow(target);
      list
        .querySelectorAll(`[${DEPARTING_ATTRIBUTE}]`)
        .forEach((element) => element.removeAttribute(DEPARTING_ATTRIBUTE));
    };

    /* Nothing happened, so nothing should feel decided: the row eases back over
       the longer of the two durations, and the surface stays lit the whole way —
       it is the row that has to cover it again, not a fade that beats it there. */
    const returnHome = (target: HTMLElement) => {
      settling = target;
      list.dataset.swipePhase = 'returning';
      transitionTo(target, RETURNING_CLASS, 0, ms(PROJECT_SWIPE_RETURN_MS));

      whenDone(target, 'transitionend', ms(PROJECT_SWIPE_RETURN_MS), () =>
        clear(target),
      );
    };

    /* Committed, in two beats: the row leaves the line, and only then does the
       space it held close — the same wipe a landing row plays, in reverse. */
    const leave = (target: HTMLElement, dx: number, id: string) => {
      const direction = Math.sign(dx);
      settling = target;
      list.dataset.swipePhase = 'leaving';
      /* How much of the row the finger actually left on screen — and so how
         much exit there is worth watching.

         A swipe that carried the row clear has none. On a narrow pane that is
         every swipe, because the drag clamps at roughly the list's own width:
         the row is already gone at the moment of release, and the exit is then a
         fixed pause spent sliding an off-screen row further off-screen while the
         action surface sits frozen at full height and the space stays open. That
         pause was the wait before anything happened.

         The travel still goes past the clamp, because transitioning a value to
         itself starts no transition at all — and without one, `transitionend`
         never fires and the backstop becomes the pause instead. */
      const showing =
        dx > 0
          ? list.clientWidth - (target.offsetLeft + dx)
          : target.offsetLeft + rowWidth + dx;
      const exitMs = Math.round(
        ms(PROJECT_SWIPE_EXIT_MS) * clamp(showing / rowWidth, 0, 1),
      );
      transitionTo(
        target,
        LEAVING_CLASS,
        direction * (travel + rowWidth),
        exitMs,
      );

      const depart = () => {
        /* The whole subtree goes, so the whole subtree has to close. Collapsing
           only the swiped row left its children standing in the gap it left,
           then blinking out when the move landed and dropping everything below
           them a full tree's height with no animation at all. */
        const leaving = latest.current
          .rowsLeavingWith(id)
          .map((each) =>
            list.querySelector<HTMLElement>(`[data-project-id="${each}"]`),
          )
          .filter((element): element is HTMLElement => element !== null);

        /* Still one line, and deliberately not resized over the run that is
           leaving. Stretching it across the whole subtree made the action fill a
           block the size of the tree, which reads as the tree being highlighted
           rather than the row that was swiped. It closes on the same duration
           and easing as the rows do, so the line and the space it sits in run
           out together. */
        list.dataset.swipePhase = 'departing';

        leaving.forEach((element) =>
          element.setAttribute(DEPARTING_ATTRIBUTE, ''),
        );
        whenDone(target, 'animationend', ms(PROJECT_REVEAL_DURATION_MS), () => {
          /* Sent once the space has finished closing, so the rows below have
             already arrived where the move would have jumped them to. */
          latest.current.action?.onCommit(id);
          clearSurface();

          /* The row keeps its collapsed, travelled-off styling until React has
             actually taken it away. Restoring it here — which is what "React
             flushes before the next paint" appeared to justify — put one painted
             frame of the whole subtree back at full height in its old place
             before it vanished. It does not flush that soon: frame-by-frame, the
             restore painted a frame ahead of React's commit.

             So the only thing that undoes it is finding it still here afterwards,
             which means the move was rejected and the list reloaded around it. */
          stopWaiting?.();
          settling = null;
          clearSurface();

          window.setTimeout(() => {
            if (!target.isConnected) return;
            clearRow(target);
            target.removeAttribute(DEPARTING_ATTRIBUTE);
          }, REJECTED_RESTORE_MS);
        });
      };

      /* Nothing left to watch travel, so do not wait for it — not even for the
         backstop, which would be its own dead pause. */
      if (exitMs <= 0) depart();
      else whenDone(target, 'transitionend', exitMs, depart);
    };

    const release = (target: HTMLElement | null, dx: number) => {
      if (scroller) setScrollLocked(scroller, false);
      if (!target) return;

      suppressClick = true;

      const id = target.dataset.projectId;
      if (Math.abs(dx) < commitAt || id === undefined) {
        returnHome(target);
        return;
      }

      leave(target, dx, id);
    };

    const onTouchStart = (event: TouchEvent) => {
      suppressClick = false;
      /* Unconditional, and the last line of defence: if a previous gesture lost
         its end — its row detached before the finger lifted — this is what gives
         the section its scrolling back. */
      if (scroller) setScrollLocked(scroller, false);

      /* Whatever is still easing back has run out of turn — a new touch owns the
         list's gesture state from here. */
      if (settling) clear(settling);
      if (row) clear(row);

      row = null;
      axis = null;
      abandoned = event.touches.length !== 1;
      if (abandoned) return;

      const target =
        (event.target as Element | null)?.closest<HTMLElement>(
          '.project-row',
        ) ?? null;

      /* A placeholder is dnd-kit's clone of a row being carried elsewhere, and a
         row marked dragging is that row. Neither is a thing to swipe. */
      if (
        !target ||
        target.hasAttribute('data-dnd-placeholder') ||
        target.getAttribute('data-dnd-dragging') === 'true'
      ) {
        abandoned = true;
        return;
      }

      row = target;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      startedAt = performance.now();
      rowWidth = target.getBoundingClientRect().width;
      commitAt = swipeCommitDistance(rowWidth);
      /* Far enough that a committing row leaves the section entirely, whichever
         side it started from and however deeply it is indented. */
      travel = list.getBoundingClientRect().width + target.offsetLeft;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (abandoned || !row || event.touches.length !== 1) return;

      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;

      if (axis === null) {
        /* Past dnd-kit's delay with the axis still open, the long press has
           already won — the finger held still long enough to start a drag, and
           whatever it does now belongs to that. */
        if (performance.now() - startedAt >= DRAG_TOUCH_DELAY_MS) {
          abandoned = true;
          return;
        }

        axis = decideAxis(dx, dy);
        if (axis === null) return;

        /* Decided once and kept. Nobody swipes perfectly horizontally, and a
           vertical lock that could be revisited turns every scroll that drifts
           sideways into a half-open drawer. */
        if (axis === 'vertical') {
          abandoned = true;
          return;
        }

        if (scroller) setScrollLocked(scroller, true);
        originX = event.touches[0].clientX;

        /* The surface is one element for the whole list, so it has to be told
           which row it is under. Read once — the row does not move vertically
           for the rest of the touch. */
        list.style.setProperty(TOP_PROPERTY, `${row.offsetTop}px`);
        list.style.setProperty(HEIGHT_PROPERTY, `${row.offsetHeight}px`);
      }

      // Covers the case where iOS has not yet committed to a scroll; the
      // overflow lock above covers the case where it has.
      if (event.cancelable) event.preventDefault();
      paint(row, clamp(event.touches[0].clientX - originX, -travel, travel));
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length > 0 || (!row && !settling)) return;

      const target = axis === 'horizontal' ? row : null;
      const touch = event.changedTouches[0];

      row = null;
      axis = null;
      abandoned = false;

      release(target, touch ? touch.clientX - originX : 0);
    };

    const onTouchCancel = () => {
      if (!row) return;
      const target = axis === 'horizontal' ? row : null;

      row = null;
      axis = null;
      abandoned = false;

      release(target, 0);
    };

    /* The ⋮ trigger spans the row's full height at its trailing edge, which is
       exactly where a right-to-left swipe starts. Preventing `touchmove` does
       not prevent the click iOS synthesises on release, so the swipe would open
       the menu it just finished sliding past. */
    const onClick = (event: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    /* The gesture starts on the list, but it has to *end* on the document.
       `touchend` targets whatever `touchstart` did, and a finger that lifts
       outside the list would otherwise never release it. */
    list.addEventListener('touchstart', onTouchStart, { passive: false });
    list.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchCancel);
    list.addEventListener('click', onClick, { capture: true });

    return () => {
      clear(settling ?? row);
      if (scroller) setScrollLocked(scroller, false);
      list.removeEventListener('touchstart', onTouchStart);
      list.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
      list.removeEventListener('click', onClick, { capture: true });
    };
  }, [listRef, enabled]);
};
