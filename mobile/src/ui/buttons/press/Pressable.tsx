import './press.css';

import type { ComponentProps, PointerEvent, ReactNode, Ref } from 'react';
import { usePress } from './usePress';

/* A control that answers a press, with the shade already inside it.

   Hover is CSS — :hover, so nothing mirrors what the browser already knows
   and no missed event can leave a control lit. The press is a single boolean
   with a minimum duration, because that is the one thing CSS cannot express
   (see usePress). Every number it animates by lives in press.css.

   Use this for anything whose shade belongs directly under its own edge. A
   control that draws its own inner surface — IconButton's chip — places the
   shade in that surface instead and carries its own three rules. */

/* `none` is haptics without visuals, for a control whose own answer already
   says it: a toggle that changes its selected fill, a header whose section
   collapses. A press state on top of that is a second, quieter reply. */
export type PressShape = 'control' | 'text' | 'row' | 'none';

type Own = {
  shape?: PressShape;
  haptic?: boolean;
  /** Off leaves it inert: no fill, no scale, no haptic. */
  pressable?: boolean;
  children: ReactNode;
};

type ButtonProps = Own & { as?: 'button'; ref?: Ref<HTMLButtonElement> } & Omit<
    ComponentProps<'button'>,
    'ref' | 'children'
  >;

type DivProps = Own & { as: 'div'; ref?: Ref<HTMLDivElement> } & Omit<
    ComponentProps<'div'>,
    'ref' | 'children'
  >;

export const Pressable = ({
  as = 'button',
  shape = 'control',
  haptic = true,
  pressable = true,
  children,
  className,
  onPointerDown,
  ...rest
}: ButtonProps | DivProps) => {
  const Element = as === 'div' ? 'div' : 'button';
  const press = usePress({ enabled: pressable, haptic });

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    /* pointerdown bubbles, so a press on a row's own menu button would reach
       the row too. The nested control answers for itself — the row is not the
       thing being pressed, and must not buzz either. */
    const target = event.target as Element | null;
    if (target?.closest('.press-host, .icon-button') === event.currentTarget)
      press.hold(event);

    (onPointerDown as ((e: PointerEvent<HTMLElement>) => void) | undefined)?.(
      event,
    );
  };

  return (
    <Element
      {...(rest as ComponentProps<'button'> & ComponentProps<'div'>)}
      onPointerDown={handlePointerDown}
      data-pressed={press.pressed ? '' : undefined}
      data-press-off={pressable ? undefined : ''}
      className={[
        'press-host',
        shape === 'text' ? 'press-text' : null,
        shape === 'row' ? 'press-row' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {shape !== 'none' && <span className="press-shade" />}
      {children}
    </Element>
  );
};
