import './CheckboxLab.css';

import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Modal } from '../ui/modal/Modal';
import { CheckboxSpecimens } from './CheckboxSpecimens';

export const CheckboxLab = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <IonPage>
      <IonContent className="checkbox-lab">
        <h1 className="checkbox-lab-title">Checkboxes</h1>

        <button
          className="checkbox-lab-open"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          Open the same set inside a modal
        </button>

        <CheckboxSpecimens />

        <Modal
          isOpen={isModalOpen}
          onDismiss={() => setIsModalOpen(false)}
          presentation="page"
          title="Checkboxes"
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
          <CheckboxSpecimens />
        </Modal>
      </IonContent>
    </IonPage>
  );
};
