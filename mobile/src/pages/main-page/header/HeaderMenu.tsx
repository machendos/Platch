import './HeaderMenu.css';

import { useIonRouter } from '@ionic/react';
import { logOutOutline, settingsOutline } from 'ionicons/icons';
import { PopoverMenu } from '../../../ui/menu/PopoverMenu';
import type { MenuItem } from '../../../ui/menu/PopoverMenu';
import { authStorage } from '../../login/save.tokens';

export const HeaderMenu = () => {
  const router = useIonRouter();

  const items: MenuItem[] = [
    {
      id: 'settings',
      label: 'Settings',
      ionIcon: settingsOutline,
      showBorderAfter: true,
      // TODO: no settings screen yet.
      onSelect: () => {},
    },
    {
      id: 'logout',
      label: 'Logout',
      ionIcon: logOutOutline,
      isDestructive: true,
      onSelect: async () => {
        await authStorage.clearTokens();
        router.push('/login', 'root');
      },
    },
  ];

  return (
    <PopoverMenu
      items={items}
      label="Main menu"
      /* The trigger is a standalone control with nothing behind it worth
         seeing, so the panel covers it and grows out of it. */
      placement="cover"
      triggerClassName="header-menu-trigger"
    />
  );
};
