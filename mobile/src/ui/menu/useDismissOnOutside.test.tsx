import { describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { useDismissOnOutside } from './useDismissOnOutside';

type HarnessProps = { isOpen: boolean; onOutside: () => void };

const Harness = ({ isOpen, onOutside }: HarnessProps) => {
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useDismissOnOutside(isOpen, [panel, trigger], onOutside);

  return (
    <>
      <button ref={trigger} type="button">
        trigger
      </button>
      <div ref={panel}>
        panel
        <button type="button">inside the panel</button>
      </div>
      <div>elsewhere</div>
    </>
  );
};

const pointerDownOn = (text: string) =>
  screen
    .getByText(text)
    .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

describe('useDismissOnOutside', () => {
  it('fires for an interaction outside every listed node', () => {
    const onOutside = vi.fn();
    render(<Harness isOpen onOutside={onOutside} />);

    pointerDownOn('elsewhere');

    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it('stays quiet inside the panel, including its descendants', () => {
    const onOutside = vi.fn();
    render(<Harness isOpen onOutside={onOutside} />);

    pointerDownOn('inside the panel');

    expect(onOutside).not.toHaveBeenCalled();
  });

  it('stays quiet on the trigger, so opening does not immediately close', () => {
    const onOutside = vi.fn();
    render(<Harness isOpen onOutside={onOutside} />);

    pointerDownOn('trigger');

    expect(onOutside).not.toHaveBeenCalled();
  });

  it('listens for nothing while closed', () => {
    const onOutside = vi.fn();
    render(<Harness isOpen={false} onOutside={onOutside} />);

    pointerDownOn('elsewhere');

    expect(onOutside).not.toHaveBeenCalled();
  });

  /* `wheel` is not fired by touch scrolling, so `scroll` is what covers the
     phone. HeaderMenu had only `wheel` before this hook existed. */
  it('fires on a scroll as well as a pointer, so a phone dismisses too', () => {
    const onOutside = vi.fn();
    render(<Harness isOpen onOutside={onOutside} />);

    screen
      .getByText('elsewhere')
      .dispatchEvent(new Event('scroll', { bubbles: true }));

    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it('stops listening once it closes', () => {
    const onOutside = vi.fn();
    const { rerender } = render(<Harness isOpen onOutside={onOutside} />);

    rerender(<Harness isOpen={false} onOutside={onOutside} />);
    pointerDownOn('elsewhere');

    expect(onOutside).not.toHaveBeenCalled();
  });
});
