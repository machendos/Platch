import './PopoverMenu.css';

import { useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { IonIcon, IonPopover } from '@ionic/react';
import { ellipsisHorizontal } from 'ionicons/icons';
import { useDismissOnOutside } from './useDismissOnOutside';
import { usePopoverAnchor } from './usePopoverAnchor';
import { LucideIcon } from '../../system/lucideIcons';
import { DynamicIcon } from 'lucide-react/dynamic';

export type MenuItem = {
  id: string;
  label: string;
  fillIcon?: boolean;
  onSelect: () => void;
  isDestructive?: boolean;
  isDisabled?: boolean;
  showBorderAfter?: boolean;
} & (
  | { ionIcon: string; lucideIcon?: never }
  | { ionIcon?: never; lucideIcon: LucideIcon }
);

type PopoverMenuProps = {
  items: MenuItem[];
  label: string;
  icon?: string;
  triggerSize?: number;
  placement?: 'adjacent' | 'cover';
  triggerClassName?: string;
};

export const PopoverMenu = ({
  items,
  label,
  icon = ellipsisHorizontal,
  triggerSize,
  placement = 'adjacent',
  triggerClassName,
}: PopoverMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const popover = useRef<HTMLIonPopoverElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const triggerId = `popover-menu-${useId().replace(/[^\w-]/g, '')}`;

  useDismissOnOutside(isOpen, [popover, trigger], () =>
    popover.current?.dismiss(),
  );

  const { anchor, watch, reset } = usePopoverAnchor(popover, trigger);

  const sizing = {
    ...(triggerSize === undefined
      ? {}
      : { '--popover-menu-trigger-size': `${triggerSize}px` }),
    ...(anchor === undefined || anchor === null
      ? {}
      : { '--popover-menu-origin-x': `${anchor.originX}px` }),
  } as CSSProperties;

  return (
    <>
      <button
        id={triggerId}
        ref={trigger}
        className={
          triggerClassName
            ? `popover-menu-trigger ${triggerClassName}`
            : 'popover-menu-trigger'
        }
        style={sizing}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => isOpen && popover.current?.dismiss()}
      >
        <IonIcon icon={icon} aria-hidden="true" />
      </button>

      <IonPopover
        ref={popover}
        className={[
          'popover-menu',
          `popover-menu-${placement}`,
          anchor && `popover-menu-side-${anchor.side}`,
          isLeaving && 'popover-menu-leaving',
        ]
          .filter(Boolean)
          .join(' ')}
        style={sizing}
        mode="ios"
        trigger={triggerId}
        side="bottom"
        alignment="end"
        arrow={false}
        dismissOnSelect
        focusTrap={false}
        onWillPresent={() => {
          setIsOpen(true);
          setIsLeaving(false);
          watch();
        }}
        onWillDismiss={() => setIsLeaving(true)}
        onDidDismiss={() => {
          setIsOpen(false);
          setIsLeaving(false);
          reset();
        }}
      >
        <div className="popover-menu-list" role="menu">
          {items.map((item, index) => (
            <button
              key={item.id}
              className={[
                'popover-menu-item',
                item.isDestructive && 'popover-menu-item-destructive',
                item.showBorderAfter &&
                  index < items.length - 1 &&
                  'popover-menu-item-divided',
              ]
                .filter(Boolean)
                .join(' ')}
              type="button"
              role="menuitem"
              disabled={item.isDisabled}
              onClick={item.onSelect}
            >
              {item.ionIcon !== undefined ? (
                <IonIcon
                  className="popover-menu-icon"
                  icon={item.ionIcon}
                  aria-hidden="true"
                />
              ) : (
                <DynamicIcon
                  className={
                    item.fillIcon
                      ? 'popover-menu-icon popover-menu-icon-filled'
                      : 'popover-menu-icon'
                  }
                  name={item.lucideIcon}
                  fill={item.fillIcon ? 'currentColor' : 'none'}
                  aria-hidden="true"
                />
              )}

              {item.label}
            </button>
          ))}
        </div>
      </IonPopover>
    </>
  );
};
