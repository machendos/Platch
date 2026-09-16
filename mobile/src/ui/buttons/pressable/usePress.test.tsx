import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { usePress } from './usePress';
import { pressHaptic } from '../../../system/feedback/pressHaptic';

vi.mock('../../../system/feedback/pressHaptic', () => ({
  pressHaptic: vi.fn(),
}));

/* The look is CSS and is not testable here — jsdom applies no stylesheet, so
   the hover and press fills are a browser question. What is testable is the
   half that is not CSS: who gets a haptic and who does not. */

const Probe = ({ disabled = false, ariaDisabled = false, haptic = true }) => {
  const press = usePress({ haptic });

  return (
    <button
      ref={press.ref}
      className={press.className}
      onPointerDown={press.onPointerDown}
      disabled={disabled}
      aria-disabled={ariaDisabled || undefined}
    >
      press me
    </button>
  );
};

const press = () => fireEvent.pointerDown(screen.getByRole('button'));

beforeEach(() => vi.mocked(pressHaptic).mockClear());

describe('usePress', () => {
  it('marks the host as pressable', () => {
    render(<Probe />);
    expect(screen.getByRole('button')).toHaveClass('pressable');
  });

  it('fires a haptic at the moment of contact', () => {
    render(<Probe />);
    press();
    expect(pressHaptic).toHaveBeenCalledTimes(1);
  });

  it('stays silent on a disabled host', () => {
    render(<Probe disabled />);
    press();
    expect(pressHaptic).not.toHaveBeenCalled();
  });

  /* aria-disabled rather than disabled, because a control that is unavailable
     for a stated reason has to stay focusable to say so. */
  it('stays silent on an aria-disabled host', () => {
    render(<Probe ariaDisabled />);
    press();
    expect(pressHaptic).not.toHaveBeenCalled();
  });

  it('stays silent when the haptic is turned off', () => {
    render(<Probe haptic={false} />);
    press();
    expect(pressHaptic).not.toHaveBeenCalled();
  });
});
