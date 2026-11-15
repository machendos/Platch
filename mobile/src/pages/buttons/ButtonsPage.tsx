import './ButtonsPage.css';

import { IonContent, IonPage } from '@ionic/react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { ellipsisVertical } from 'ionicons/icons';
import { IconButton } from '../../ui/buttons/icon-button/IconButton';
import { TextButton } from '../../ui/buttons/text-button/TextButton';
import { Pressable } from '../../ui/buttons/press/Pressable';
import { PopoverMenu } from '../../ui/menu/PopoverMenu';
import { layoutCssVariables } from '../main-page/layout-config';

/* The app's real controls on one unauthenticated page, so a press can be judged
   on a device without logging in or reaching app state. */

const MENU = [
  { id: 'a', label: 'First', lucideIcon: 'pencil' as const, onSelect: () => {} },
  { id: 'b', label: 'Second', lucideIcon: 'trash' as const, onSelect: () => {} },
];

export const ButtonsPage = () => (
  <IonPage>
    <IonContent>
      <div className="buttons-page" style={layoutCssVariables}>
        <p className="buttons-note">Press and hold each one.</p>

        <section className="buttons-section">
          <h2>Text</h2>
          <div className="buttons-row">
            <TextButton size="large" onClick={() => {}}>
              Today
            </TextButton>
            <TextButton size="large" outlined onClick={() => {}}>
              Today
            </TextButton>
            <TextButton size="medium" onClick={() => {}}>
              Medium
            </TextButton>
          </div>
        </section>

        <section className="buttons-section">
          <h2>Icon</h2>
          <div className="buttons-row">
            <IconButton size="large" label="Previous" onClick={() => {}}>
              <ChevronLeft />
            </IconButton>
            <IconButton size="large" label="Next" onClick={() => {}}>
              <ChevronRight />
            </IconButton>
            <IconButton size="medium" label="Add" onClick={() => {}}>
              <Plus />
            </IconButton>
            <PopoverMenu label="More" items={MENU} />
          </div>
        </section>

        <section className="buttons-section">
          <h2>Rows</h2>
          {/* The dispatcher card: rows fused into one clipped surface, each a
              `row` press with its own chevron and menu to press past. */}
          <div className="buttons-card">
            {['Platch mobile', 'Calendar refactor', 'Icon set'].map((name) => (
              <Pressable as="div" shape="row" className="button-row" key={name}>
                <IconButton
                  size="large"
                  label={`Expand ${name}`}
                  onClick={() => {}}
                >
                  <ChevronRight />
                </IconButton>
                <span className="button-row-name">{name}</span>
                <PopoverMenu
                  label={`${name} actions`}
                  icon={ellipsisVertical}
                  items={MENU}
                />
              </Pressable>
            ))}
          </div>
        </section>

        <section className="buttons-section">
          <h2>Card</h2>
          {/* The shape the modal's add-card is: row-sized, but a `control`,
              so its box stays put and only the shade answers. */}
          <Pressable as="div" className="buttons-add-card">
            <span className="buttons-add-ordinal">1.</span>
            <Plus className="buttons-add-glyph" aria-hidden="true" />
          </Pressable>
        </section>
      </div>
    </IonContent>
  </IonPage>
);
