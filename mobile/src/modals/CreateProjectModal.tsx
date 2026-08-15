import './CreateProjectModal.css';

import { useState } from 'react';
import { Modal } from '../ui/modal/Modal';
import { Breadcrumbs } from '../ui/breadcrumbs/Breadcrumbs';
import type { BreadcrumbItem } from '../ui/breadcrumbs/Breadcrumbs';
import { SegmentedControl } from '../ui/segmented-control/SegmentedControl';
import type { SegmentedOption } from '../ui/segmented-control/SegmentedControl';

type CreateProjectModalProps = {
  isOpen: boolean;
  onDismiss: () => void;
};

type ProjectStatus = 'ACTIVE' | 'BACKLOG';

const STATUS_OPTIONS: SegmentedOption<ProjectStatus>[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'BACKLOG', label: 'Backlog' },
];

// TODO: hardcoded ancestry until projects can be nested for real.
const ANCESTRY: BreadcrumbItem[] = [
  { id: 'parent-1', label: 'Parent1' },
  { id: 'parent-2', label: 'Parent2' },
  { id: 'parent-3', label: 'Parent3' },
  { id: 'parent-4', label: 'Parent4asdfadfasdfasd asdf asd fasd fasd fasdf' },
  { id: 'parent-5', label: 'Parent5 adf asd sad' },
  { id: 'parent-6', label: 'Parent666' },
  { id: 'this-project', label: 'This project' },
];

export const CreateProjectModal = ({
  isOpen,
  onDismiss,
}: CreateProjectModalProps) => {
  const [status, setStatus] = useState<ProjectStatus>('ACTIVE');
  const [currentId, setCurrentId] = useState('this-project');

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onDismiss}
      presentation="sheet"
      title="Create project"
      leading={
        <button className="modal-action" type="button" onClick={onDismiss}>
          Cancel
        </button>
      }
    >
      <div className="create-project-context">
        <Breadcrumbs
          items={ANCESTRY}
          currentId={currentId}
          onSelect={setCurrentId}
        />
        <SegmentedControl
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          label="Project status"
        />
      </div>

      <p className="create-project-placeholder">create project</p>
    </Modal>
  );
};
