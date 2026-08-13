import './HeaderMenu.css';

import { useEffect, useId, useRef, useState } from 'react';
import { IonIcon, IonPopover, useIonRouter } from '@ionic/react';
import {
  ellipsisHorizontal,
  logOutOutline,
  settingsOutline,
} from 'ionicons/icons';
import { authStorage } from '../../login/save.tokens';

export const HeaderMenu = () => {
  const router = useIonRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const popover = useRef<HTMLIonPopoverElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const triggerId = `header-menu-${useId().replace(/[^\w-]/g, '')}`;

  useEffect(() => {
    if (!isOpen) return;

    const dismissUnlessInsideMenu = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) return;
      // This menu's own nodes, by identity rather than by selector, so a
      // second HeaderMenu elsewhere on the page cannot suppress this one.
      if (popover.current?.contains(target)) return;
      if (trigger.current?.contains(target)) return;
      popover.current?.dismiss();
    };

    const options: AddEventListenerOptions = { capture: true, passive: true };
    document.addEventListener('pointerdown', dismissUnlessInsideMenu, options);
    document.addEventListener('wheel', dismissUnlessInsideMenu, options);

    return () => {
      document.removeEventListener(
        'pointerdown',
        dismissUnlessInsideMenu,
        options,
      );
      document.removeEventListener('wheel', dismissUnlessInsideMenu, options);
    };
  }, [isOpen]);

  return (
    <>
      <button
        id={triggerId}
        ref={trigger}
        className="header-menu-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => isOpen && popover.current?.dismiss()}
      >
        <IonIcon icon={ellipsisHorizontal} aria-hidden="true" />
      </button>

      <IonPopover
        ref={popover}
        className={
          isLeaving ? 'header-menu header-menu-leaving' : 'header-menu'
        }
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
        }}
        onWillDismiss={() => setIsLeaving(true)}
        onDidDismiss={() => {
          setIsOpen(false);
          setIsLeaving(false);
        }}
      >
        <div className="header-menu-list">
          <button className="header-menu-item" type="button">
            <IonIcon
              className="header-menu-icon"
              icon={settingsOutline}
              aria-hidden="true"
            />
            Settings
          </button>
          <button
            className="header-menu-item header-menu-item-destructive"
            type="button"
            onClick={async () => {
              await authStorage.clearTokens();
              router.push('/login', 'root');
            }}
          >
            <IonIcon
              className="header-menu-icon"
              icon={logOutOutline}
              aria-hidden="true"
            />
            Logout
          </button>
        </div>
      </IonPopover>
    </>
  );
};
