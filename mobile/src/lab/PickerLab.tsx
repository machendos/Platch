import './PickerLab.css';

import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Modal } from '../ui/modal/Modal';
import { PickerSpecimens } from './PickerSpecimens';

export const PickerLab = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <IonPage>
      <IonContent className="picker-lab">
        <h1 className="picker-lab-title">Date input and toggle group</h1>

        <button
          className="picker-lab-open"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          Open the same set inside a modal
        </button>

        <PickerSpecimens />

        <Modal
          isOpen={isModalOpen}
          onDismiss={() => setIsModalOpen(false)}
          presentation="page"
          title="Date input and toggle group"
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
          <PickerSpecimens />
        </Modal>
      </IonContent>
    </IonPage>
  );
};
