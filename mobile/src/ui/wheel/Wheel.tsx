import './Wheel.css';

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { WHEEL_FEEL } from '../../config/wheelFeel';
import { armTicks, tick } from '../../system/feedback/tick';
import {
  clampOffset,
  decayProgress,
  detentOffset,
  easeOut,
  indexAt,
  isBeyondEnds,
  maxOffset,
  planFling,
  velocityFrom,
  withRubberBand,
} from './wheelPhysics';
import type { PointerSample } from './wheelPhysics';

export type WheelOption = {
  value: number;
  label: string;
};

type WheelProps = {
  options: WheelOption[];
  value: number;
  onChange: (value: number) => void;
  label: string;
  unit?: string;
  className?: string;
};

export const Wheel = ({
  options,
  value,
  onChange,
  label,
  unit,
  className,
}: WheelProps) => {
  const list = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const row = useRef(0);
  const frame = useRef<number | null>(null);
  const pending = useRef<number | null>(null);
  const dragging = useRef(false);
  const samples = useRef<PointerSample[]>([]);
  const origin = useRef({ y: 0, offset: 0, moved: 0 });

  const scrolling = useRef(false);
  const scrollFrom = useRef(0);
  const scrollBy = useRef(0);
  const scrollSamples = useRef<PointerSample[]>([]);
  const scrollEnded = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spent = useRef(false);
  const spentInto = useRef(0);

  // The animation loop outlives the render that started it, so it reads these
  // rather than the closure it was created in.
  const live = useRef({ options, value, onChange });
  live.current = { options, value, onChange };

  const selected = options.findIndex((option) => option.value === value);
  const index = Math.max(selected, 0);

  const settleOn = (landed: number, notify: boolean) => {
    const { options: current, value: held, onChange: emit } = live.current;

    if (landed === row.current) return;
    row.current = landed;
    if (!notify) return;

    tick();
    const option = current[landed];
    if (option && option.value !== held) emit(option.value);
  };

  const place = (next: number, notify: boolean) => {
    offset.current = next;
    if (list.current) {
      list.current.style.transform = `translate3d(0, ${-next}px, 0)`;
    }

    settleOn(
      indexAt(next, WHEEL_FEEL.itemHeight, live.current.options.length),
      notify,
    );
  };

  const stop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    pending.current = null;
  };

  const glide = (
    to: number,
    duration: number,
    {
      curve = easeOut,
      onArrival,
    }: {
      curve?: (progress: number) => number;
      onArrival?: () => void;
    } = {},
  ) => {
    // Whatever was animating is cancelled first. Two loops writing the same
    // offset from different starting points fight each other into a crawl.
    stop();

    const from = offset.current;
    const distance = to - from;

    if (Math.abs(distance) < 0.5) {
      place(to, true);
      onArrival?.();
      return;
    }

    const started = performance.now();
    pending.current = to;

    const step = () => {
      const progress = Math.min((performance.now() - started) / duration, 1);
      place(from + distance * curve(progress), true);

      if (progress < 1) {
        frame.current = requestAnimationFrame(step);
        return;
      }

      frame.current = null;
      pending.current = null;
      onArrival?.();
    };

    frame.current = requestAnimationFrame(step);
  };

  // What happens when the input lets go — a finger lifting, or a scroll going
  // quiet. Both come through here, so the two cannot drift apart: the same
  // momentum, the same meeting with the band at the ends, the same bounce.
  const release = (velocity: number) => {
    const count = live.current.options.length;

    // Let go past an end and it comes back to it, rather than the throw being
    // measured from a position the wheel is not allowed to rest at.
    if (isBeyondEnds(offset.current, count, WHEEL_FEEL.itemHeight)) {
      glide(
        clampOffset(offset.current, count, WHEEL_FEEL.itemHeight),
        WHEEL_FEEL.bounceMs,
      );
      return;
    }

    const { to, duration, bounce } = planFling(
      offset.current,
      velocity,
      count,
      WHEEL_FEEL.itemHeight,
      WHEEL_FEEL,
    );

    glide(to, duration, {
      curve: (progress) =>
        decayProgress(
          progress * duration,
          duration,
          WHEEL_FEEL.decelerationRate,
        ),
      onArrival: bounce ? () => glide(bounce.to, bounce.duration) : undefined,
    });
  };

  useLayoutEffect(() => {
    place(index * WHEEL_FEEL.itemHeight, false);
    return stop;
    // Mount only. Later moves come from the gesture or the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A value changed from outside — usually the parent snapping this wheel onto
  // a coarser grid — is followed silently. A gesture or a fling in flight owns
  // the wheel and is left alone.
  useEffect(() => {
    if (dragging.current || scrolling.current || frame.current !== null) return;

    const target = index * WHEEL_FEEL.itemHeight;
    if (Math.abs(offset.current - target) < 0.5) return;

    place(target, false);
  }, [index, options.length]);

  // Mouse and trackpad. Attached natively rather than through onWheel because
  // preventDefault is needed to stop the page scrolling behind the wheel, and
  // React's wheel listener is passive. Same reason useCalendarZoom does it.
  useEffect(() => {
    const element = surface.current;
    if (!element) return;

    // A scroll has no equivalent of lifting a finger, so a gap in the events
    // stands in for one.
    const scrollFinished = () => {
      scrollEnded.current = null;
      scrolling.current = false;
      spent.current = false;
    };

    const waitForTheStreamToStop = () => {
      if (scrollEnded.current) clearTimeout(scrollEnded.current);
      scrollEnded.current = setTimeout(() => {
        const wasSpent = spent.current;
        scrollFinished();
        if (!wasSpent) {
          release(-velocityFrom(scrollSamples.current, performance.now()));
        }
      }, WHEEL_FEEL.scrollEndMs);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      // Firefox reports lines rather than pixels.
      const lines = event.deltaMode === 1 ? 16 : 1;
      const delta = event.deltaY * lines;
      const now = performance.now();

      // The throw is already spent against an end and bouncing back. A
      // trackpad goes on sending momentum for a second or more after the
      // fingers lift, and letting that keep the wheel pinned is what held the
      // stretch on screen long after a finger would have released it.
      //
      // Only the momentum still running into that end is ignored. A scroll the
      // other way is a new intent and is answered at once — waiting for the
      // stream to go quiet first left the wheel refusing to move until the
      // scrolling paused, which is not something the user can see a reason for.
      if (spent.current) {
        if (delta === 0 || Math.sign(delta) === spentInto.current) {
          waitForTheStreamToStop();
          return;
        }

        spent.current = false;
        scrolling.current = false;
      }

      // A scroll is a drag. The wheel moves pixel for pixel with it, through
      // the band at the ends, and its speed is read in the same px/ms a finger
      // is. Quantising it into rows instead moved the wheel at a third of the
      // scroll and never reached the band, which is why the two inputs did not
      // feel like the same control.
      if (!scrolling.current) {
        stop();
        armTicks();
        scrolling.current = true;
        scrollFrom.current = offset.current;
        scrollBy.current = 0;
        scrollSamples.current = [{ time: now, y: 0 }];
      }

      const count = live.current.options.length;
      const end = maxOffset(count, WHEEL_FEEL.itemHeight);
      scrollBy.current += delta;

      // A trackpad keeps sending momentum long after the wheel has reached the
      // end, and unchecked that piles up an offset the band hides but which
      // still has to be scrolled back before the wheel moves again. Bounding
      // the raw position keeps the stretch honest and the way back immediate.
      const raw = scrollFrom.current + scrollBy.current;
      const reach = WHEEL_FEEL.overscroll * 3;
      const bounded = Math.min(Math.max(raw, -reach), end + reach);
      scrollBy.current = bounded - scrollFrom.current;

      // Recorded the way a finger is — travel inverted — so one velocity
      // reading and one sign convention serve both inputs.
      scrollSamples.current.push({ time: now, y: -scrollBy.current });
      if (scrollSamples.current.length > 12) scrollSamples.current.shift();

      place(
        withRubberBand(
          bounded,
          count,
          WHEEL_FEEL.itemHeight,
          WHEEL_FEEL.overscroll,
        ),
        true,
      );

      // Pushing into the end with momentum to spare. The throw is over, so it
      // is released now rather than when the momentum happens to run out — a
      // finger reaching the end releases the moment it lifts, and waiting for
      // the stream instead left the wheel stretched for as long as the
      // trackpad kept talking.
      if (raw < -WHEEL_FEEL.overscroll || raw > end + WHEEL_FEEL.overscroll) {
        spent.current = true;
        spentInto.current = raw > end ? 1 : -1;
        release(-velocityFrom(scrollSamples.current, now));
      }

      waitForTheStreamToStop();
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', onWheel);
      if (scrollEnded.current) clearTimeout(scrollEnded.current);
    };
    // Subscribed once: `glide` and `place` are rebuilt every render, and
    // re-attaching a non-passive listener that often would drop wheel events
    // mid-scroll. Both read live state through refs, so they do not go stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A hidden page suspends requestAnimationFrame, which would strand a fling
  // between two detents with its value never committed. Switching away lands it
  // on the row it was heading for.
  useEffect(() => {
    const settleNow = () => {
      if (!document.hidden || pending.current === null) return;

      const target = pending.current;
      stop();
      place(target, true);
    };

    document.addEventListener('visibilitychange', settleNow);
    return () => document.removeEventListener('visibilitychange', settleNow);
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    stop();
    armTicks();
    spent.current = false;
    dragging.current = true;
    origin.current = { y: event.clientY, offset: offset.current, moved: 0 };
    samples.current = [{ time: performance.now(), y: event.clientY }];
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;

    const travelled = event.clientY - origin.current.y;
    origin.current.moved = Math.max(origin.current.moved, Math.abs(travelled));

    samples.current.push({ time: performance.now(), y: event.clientY });
    if (samples.current.length > 12) samples.current.shift();

    place(
      withRubberBand(
        origin.current.offset - travelled,
        live.current.options.length,
        WHEEL_FEEL.itemHeight,
        WHEEL_FEEL.overscroll,
      ),
      true,
    );
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);

    // A tap is not a throw: it moves by the number of rows between the pill and
    // the finger, which is the only way to reach a row without dragging — and
    // the only way at all to pick the row already under the pill.
    if (origin.current.moved <= WHEEL_FEEL.tapSlop) {
      const box = event.currentTarget.getBoundingClientRect();
      const rows = Math.round(
        (event.clientY - (box.top + box.height / 2)) / WHEEL_FEEL.itemHeight,
      );

      glide(
        clampOffset(
          (row.current + rows) * WHEEL_FEEL.itemHeight,
          live.current.options.length,
          WHEEL_FEEL.itemHeight,
        ),
        WHEEL_FEEL.minSettleMs,
      );
      return;
    }

    // Dragging down moves the wheel to earlier values, so the throw is the
    // finger's velocity inverted.
    release(-velocityFrom(samples.current, performance.now()));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    const count = options.length;

    if (step) {
      event.preventDefault();
      glide(
        clampOffset(
          (row.current + step) * WHEEL_FEEL.itemHeight,
          count,
          WHEEL_FEEL.itemHeight,
        ),
        WHEEL_FEEL.minSettleMs,
      );
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      glide(
        event.key === 'Home'
          ? 0
          : detentOffset(Infinity, WHEEL_FEEL.itemHeight, count),
        WHEEL_FEEL.minSettleMs,
      );
    }
  };

  return (
    <div
      ref={surface}
      className={className ? `wheel ${className}` : 'wheel'}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      style={
        {
          '--wheel-item-height': `${WHEEL_FEEL.itemHeight}px`,
          '--wheel-rows': WHEEL_FEEL.visibleRows,
        } as CSSProperties
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <div className="wheel-viewport">
        <div className="wheel-list" ref={list}>
          {options.map((option) => (
            <div
              key={option.value}
              className={
                option.value === value
                  ? 'wheel-item wheel-item-selected'
                  : 'wheel-item'
              }
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </div>
          ))}
        </div>
      </div>

      {unit && (
        <span className="wheel-unit" aria-hidden="true">
          {unit}
        </span>
      )}
    </div>
  );
};
