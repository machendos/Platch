import { describe, expect, it } from 'vitest';
import { WHEEL_FEEL } from '../../config/wheelFeel';
import {
  clampOffset,
  decayProgress,
  detentOffset,
  easeOut,
  flingDistance,
  flingDuration,
  indexAt,
  isBeyondEnds,
  maxOffset,
  planFling,
  rubberBand,
  timeToTravel,
  velocityAfter,
  velocityFrom,
  withRubberBand,
} from './wheelPhysics';

const ITEM = 34;
const COUNT = 181;

const feel = WHEEL_FEEL;
const rowsFor = (velocity: number) =>
  flingDistance(velocity, feel.decelerationRate) / ITEM;

describe('velocityFrom', () => {
  it('is zero without two samples inside the window', () => {
    expect(velocityFrom([], 100)).toBe(0);
    expect(velocityFrom([{ time: 100, y: 0 }], 100)).toBe(0);
  });

  it('reads pixels per millisecond over the samples it keeps', () => {
    const samples = [
      { time: 0, y: 0 },
      { time: 50, y: 100 },
    ];

    expect(velocityFrom(samples, 50)).toBeCloseTo(2);
  });

  // A long slow drag that ends in a flick is a flick.
  it('ignores samples older than the window', () => {
    const samples = [
      { time: 0, y: 0 },
      { time: 500, y: 10 },
      { time: 540, y: 90 },
    ];

    expect(velocityFrom(samples, 540)).toBeCloseTo(2);
  });

  it('signs the direction', () => {
    const up = velocityFrom(
      [
        { time: 0, y: 100 },
        { time: 50, y: 0 },
      ],
      50,
    );

    expect(up).toBeLessThan(0);
  });
});

describe('clampOffset', () => {
  it('cannot leave the range, which is what stops the wheel at min and max', () => {
    expect(clampOffset(-500, COUNT, ITEM)).toBe(0);
    expect(clampOffset(999999, COUNT, ITEM)).toBe(maxOffset(COUNT, ITEM));
    expect(maxOffset(COUNT, ITEM)).toBe(180 * ITEM);
  });

  it('handles a single-option wheel', () => {
    expect(clampOffset(500, 1, ITEM)).toBe(0);
    expect(indexAt(500, ITEM, 1)).toBe(0);
  });
});

describe('rubberBand', () => {
  const LIMIT = WHEEL_FEEL.overscroll;

  it('gives no ground at rest', () => {
    expect(rubberBand(0, LIMIT)).toBe(0);
  });

  it('follows the finger, but always less than it moved', () => {
    for (const pull of [5, 20, 60, 200, 1000]) {
      expect(rubberBand(pull, LIMIT)).toBeGreaterThan(0);
      expect(rubberBand(pull, LIMIT)).toBeLessThan(pull);
    }
  });

  it('gives less the further it is pulled', () => {
    const early = rubberBand(10, LIMIT) / 10;
    const late = rubberBand(200, LIMIT) / 200;

    expect(late).toBeLessThan(early);
  });

  it('never passes the limit however hard it is pulled', () => {
    expect(rubberBand(100000, LIMIT)).toBeLessThan(LIMIT);
    expect(rubberBand(100000, LIMIT)).toBeGreaterThan(LIMIT * 0.99);
  });

  it('is symmetric', () => {
    expect(rubberBand(-40, LIMIT)).toBe(-rubberBand(40, LIMIT));
  });
});

describe('withRubberBand', () => {
  const LIMIT = WHEEL_FEEL.overscroll;
  const END = maxOffset(COUNT, ITEM);

  it('leaves an in-range offset untouched', () => {
    for (const offset of [0, 17, ITEM * 40, END]) {
      expect(withRubberBand(offset, COUNT, ITEM, LIMIT)).toBe(offset);
    }
  });

  it('resists past the first row without stopping dead', () => {
    const pulled = withRubberBand(-80, COUNT, ITEM, LIMIT);

    expect(pulled).toBeLessThan(0);
    expect(pulled).toBeGreaterThan(-LIMIT);
  });

  it('resists past the last row', () => {
    const pulled = withRubberBand(END + 80, COUNT, ITEM, LIMIT);

    expect(pulled).toBeGreaterThan(END);
    expect(pulled).toBeLessThan(END + LIMIT);
  });

  // The value must not change while the wheel is stretched past its end.
  it('still reports the edge row while overscrolled', () => {
    expect(indexAt(withRubberBand(-200, COUNT, ITEM, LIMIT), ITEM, COUNT)).toBe(
      0,
    );
    expect(
      indexAt(withRubberBand(END + 200, COUNT, ITEM, LIMIT), ITEM, COUNT),
    ).toBe(COUNT - 1);
  });
});

describe('isBeyondEnds', () => {
  it('is true only outside the range', () => {
    expect(isBeyondEnds(-1, COUNT, ITEM)).toBe(true);
    expect(isBeyondEnds(0, COUNT, ITEM)).toBe(false);
    expect(isBeyondEnds(maxOffset(COUNT, ITEM), COUNT, ITEM)).toBe(false);
    expect(isBeyondEnds(maxOffset(COUNT, ITEM) + 1, COUNT, ITEM)).toBe(true);
  });
});

describe('indexAt', () => {
  it('rounds to the nearest row', () => {
    expect(indexAt(0, ITEM, COUNT)).toBe(0);
    expect(indexAt(ITEM * 3 + 16, ITEM, COUNT)).toBe(3);
    expect(indexAt(ITEM * 3 + 18, ITEM, COUNT)).toBe(4);
  });

  it('never leaves the option range', () => {
    expect(indexAt(-999, ITEM, COUNT)).toBe(0);
    expect(indexAt(999999, ITEM, COUNT)).toBe(COUNT - 1);
  });
});

describe('planFling', () => {
  const END = maxOffset(COUNT, ITEM);
  const plan = (offset: number, velocity: number) =>
    planFling(offset, velocity, COUNT, ITEM, feel);

  it('lands on a detent and does not bounce when it stops in time', () => {
    for (const velocity of [-3, -1.2, -0.4, 0.4, 1.2, 3]) {
      const result = plan(ITEM * 90, velocity);
      expect(result.to % ITEM).toBe(0);
      expect(result.bounce).toBeNull();
    }
  });

  it('travels further the faster the throw', () => {
    expect(plan(ITEM * 60, 2.5).to).toBeGreaterThan(plan(ITEM * 60, 0.5).to);
  });

  // Below the threshold a release is a drag, and a drag takes the row it is on.
  it('takes only the nearest detent below the fling threshold', () => {
    expect(plan(ITEM * 12 + 4, 0.01).to).toBe(ITEM * 12);
  });

  it('carries a hard flick across a useful number of rows', () => {
    expect(rowsFor(2.5)).toBeGreaterThan(10);
    expect(rowsFor(2.5)).toBeLessThan(120);
  });

  // The complaint that a gentle spin jumped an unexpected number of values.
  it('keeps an unhurried throw to a handful of rows', () => {
    expect(rowsFor(feel.minFlingVelocity)).toBeLessThan(6);
    expect(rowsFor(0.6)).toBeLessThan(10);
  });

  describe('when the throw runs out of wheel', () => {
    it('overshoots the end and springs back to it', () => {
      const result = plan(END - ITEM * 2, 3);

      expect(result.to).toBeGreaterThan(END);
      expect(result.bounce?.to).toBe(END);
    });

    it('never pushes past the rubber band limit', () => {
      for (const velocity of [1, 3, 10, 100]) {
        expect(plan(END - ITEM, velocity).to).toBeLessThan(
          END + feel.overscroll,
        );
      }
    });

    // The point of the change: a harder throw hits the end harder.
    it('hits the band harder the faster it arrives', () => {
      const gentle = plan(END - ITEM * 2, 1).to;
      const hard = plan(END - ITEM * 2, 4).to;

      expect(hard).toBeGreaterThan(gentle);
      expect(gentle).toBeGreaterThan(END);
    });

    // Depth follows the arrival speed, not the distance the throw had left.
    // Using the leftover distance sank a soft arrival nearly as deep as a
    // violent one, because that distance is large either way.
    it('barely dents the band when it arrives slowly', () => {
      const barely = plan(END - ITEM * 6, feel.minFlingVelocity + 0.05);
      expect(barely.to - END).toBeLessThan(ITEM);
    });

    it('separates a soft arrival from a hard one by more than a row', () => {
      const soft = plan(END - ITEM * 2, 0.6).to - END;
      const hard = plan(END - ITEM * 2, 5).to - END;

      expect(hard - soft).toBeGreaterThan(ITEM);
    });

    it('springs back sooner from a shallow dent than a deep one', () => {
      const soft = plan(END - ITEM * 2, 0.6).bounce;
      const hard = plan(END - ITEM * 2, 5).bounce;

      expect(soft?.duration).toBeLessThan(hard?.duration ?? 0);
      expect(hard?.duration).toBeLessThanOrEqual(feel.bounceMs);
      expect(soft?.duration).toBeGreaterThanOrEqual(feel.minSettleMs);
    });

    // The bug this replaced: the destination was clamped to the last row but
    // the duration stayed the full one for that velocity, so the wheel crawled
    // the little distance it had left.
    it('does not stretch a short run over a long throw time', () => {
      const nearlyThere = plan(END - ITEM, 4);
      expect(nearlyThere.duration).toBeLessThan(flingDuration(4, feel) / 2);
    });

    it('is symmetric at the near end', () => {
      const result = plan(ITEM * 2, -3);

      expect(result.to).toBeLessThan(0);
      expect(result.to).toBeGreaterThan(-feel.overscroll);
      expect(result.bounce?.to).toBe(0);
    });
  });
});

describe('timeToTravel and velocityAfter', () => {
  const rate = feel.decelerationRate;

  it('takes no time and loses no speed over no distance', () => {
    expect(timeToTravel(0, 2, rate)).toBeCloseTo(0);
    expect(velocityAfter(0, 2, rate)).toBe(2);
  });

  it('arrives slower the further it has come', () => {
    expect(velocityAfter(200, 2, rate)).toBeLessThan(
      velocityAfter(50, 2, rate),
    );
  });

  it('reports the whole coast as the time to travel its full distance', () => {
    const distance = flingDistance(2, rate);
    expect(velocityAfter(distance, 2, rate)).toBeCloseTo(0);
    expect(timeToTravel(distance, 2, rate)).toBe(Infinity);
  });

  it('takes longer to cover more ground', () => {
    expect(timeToTravel(300, 2, rate)).toBeGreaterThan(
      timeToTravel(100, 2, rate),
    );
  });
});

describe('flingDuration', () => {
  it('stays inside its bounds', () => {
    for (const velocity of [0, 0.02, 0.3, 3, 40]) {
      const duration = flingDuration(velocity, feel);
      expect(duration).toBeGreaterThanOrEqual(feel.minSettleMs);
      expect(duration).toBeLessThanOrEqual(feel.maxFlingMs);
    }
  });

  // The complaint that the spin stopped abruptly however hard it was thrown:
  // duration has to grow with the throw rather than sit at a ceiling.
  it('coasts longer the harder the throw', () => {
    const gentle = flingDuration(0.4, feel);
    const brisk = flingDuration(1.5, feel);
    const hard = flingDuration(4, feel);

    expect(brisk).toBeGreaterThan(gentle);
    expect(hard).toBeGreaterThan(brisk);
  });

  it('runs a hard throw for over a second', () => {
    expect(flingDuration(3, feel)).toBeGreaterThan(1000);
  });
});

describe('decayProgress', () => {
  it('runs from rest to rest', () => {
    expect(decayProgress(0, 1200, feel.decelerationRate)).toBe(0);
    expect(decayProgress(1200, 1200, feel.decelerationRate)).toBeCloseTo(1);
  });

  it('never goes backwards', () => {
    let previous = -1;
    for (let t = 0; t <= 1200; t += 40) {
      const progress = decayProgress(t, 1200, feel.decelerationRate);
      expect(progress).toBeGreaterThanOrEqual(previous);
      previous = progress;
    }
  });

  // The long slow crawl into the resting row: most of the ground is covered
  // early, and the last stretch is spent easing in.
  it('spends its speed early and crawls at the end', () => {
    const half = decayProgress(600, 1200, feel.decelerationRate);
    expect(half).toBeGreaterThan(0.6);

    const lastTenth = 1 - decayProgress(1080, 1200, feel.decelerationRate);
    expect(lastTenth).toBeLessThan(0.06);
  });

  it('decelerates more gently than a cubic ease-out', () => {
    expect(decayProgress(600, 1200, feel.decelerationRate)).toBeLessThan(
      easeOut(0.5),
    );
  });
});

describe('easeOut', () => {
  it('runs from rest to rest', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
  });

  it('decelerates', () => {
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });
});

describe('detentOffset', () => {
  it('is the offset of the row that indexAt reports', () => {
    for (const offset of [0, 17, 51, 900, 99999]) {
      expect(detentOffset(offset, ITEM, COUNT)).toBe(
        indexAt(offset, ITEM, COUNT) * ITEM,
      );
    }
  });
});
