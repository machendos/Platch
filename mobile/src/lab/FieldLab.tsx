import './FieldLab.css';

import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Modal } from '../ui/modal/Modal';
import { ChromeComparison } from './ChromeComparison';
import { FieldSpecimens } from './FieldSpecimens';
import { ToolbarProbe } from './ToolbarProbe';

export const FieldLab = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <IonPage>
      <ToolbarProbe />
      <IonContent className="field-lab">
        <h1 className="field-lab-title">Text fields</h1>

        <button
          className="field-lab-open"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          Open the same set inside a modal
        </button>

        <ChromeComparison />

        <FieldSpecimens />

        <Modal
          isOpen={isModalOpen}
          onDismiss={() => setIsModalOpen(false)}
          presentation="page"
          title="Text fields"
          leading={
            <button
              className="modal-action"
              type="button"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
          }
        >
          <FieldSpecimens />
        </Modal>
      </IonContent>
    </IonPage>
  );
};
