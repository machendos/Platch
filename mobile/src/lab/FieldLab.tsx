import './FieldLab.css';

import { useRef, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Modal, type ModalHandle } from '../ui/modal/Modal';
import { useFormState } from '../modals/useFormState';
import { ChromeComparison } from './ChromeComparison';
import { FieldForm, OPENED_WITH } from './FieldForm';
import { FieldSpecimens } from './FieldSpecimens';

export const FieldLab = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <IonPage>
      <IonContent className="field-lab">
        <h1 className="field-lab-title">Text fields</h1>

        <button
          className="field-lab-open"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          Open a form in a modal
        </button>

        <ChromeComparison />

        <FieldSpecimens />

        {/* Mounted per opening, so the form always compares against the values
            it was actually opened with. */}
        {isModalOpen && <FieldModal onClosed={() => setIsModalOpen(false)} />}
      </IonContent>
    </IonPage>
  );
};

const FieldModal = ({ onClosed }: { onClosed: () => void }) => {
  const { values, set, isDirty, markSaved } = useFormState(OPENED_WITH);
  const modal = useRef<ModalHandle>(null);

  /* Saving rebaselines before closing, so the modal is clean on the way out
     and does not offer to discard the changes just written. */
  const save = () => {
    markSaved();
    modal.current?.dismiss();
  };

  return (
    <Modal
      ref={modal}
      isOpen
      onDismiss={onClosed}
      isDirty={isDirty}
      presentation="page"
      title="Edit project"
      leading={
        <button
          className="modal-action"
          type="button"
          onClick={() => modal.current?.dismiss()}
        >
          Cancel
        </button>
      }
      footer={
        <button
          className="modal-action modal-action-primary"
          type="button"
          disabled={!isDirty}
          onClick={save}
        >
          Save
        </button>
      }
    >
      <FieldForm values={values} set={set} />
    </Modal>
  );
};
