import './CreateProjectModal.css';

import { useState } from 'react';
import { Modal } from '../ui/modal/Modal';
import { Breadcrumbs } from '../ui/breadcrumbs/Breadcrumbs';
import type { BreadcrumbItem } from '../ui/breadcrumbs/Breadcrumbs';
import { SegmentedControl } from '../ui/segmented-control/SegmentedControl';
import type { SegmentedOption } from '../ui/segmented-control/SegmentedControl';
import { Select } from '../ui/select/Select';
import { numberRange } from '../ui/select/selectOptions';
import type { SelectOption } from '../ui/select/selectOptions';
import { Field } from '../ui/text-field/Field';
import { RichTextToolbar } from '../ui/text-field/RichTextToolbar';
import { ActiveFieldProvider } from '../ui/text-field/toolbar/activeField';
import { CONTEXT_FIELD } from './fieldPresets';

type CreateProjectModalProps = {
  isOpen: boolean;
  onDismiss: () => void;
};

type ProjectStatus = 'ACTIVE' | 'BACKLOG';

const STATUS_OPTIONS: SegmentedOption<ProjectStatus>[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'BACKLOG', label: 'Backlog' },
];

// TODO: demo mount for the Select primitive until the recurrence form exists.
const MONTH_DAYS = numberRange(1, 31);

const WEEKDAYS: SelectOption<string>[] = [
  { value: 'MO', label: 'Monday' },
  { value: 'TU', label: 'Tuesday' },
  { value: 'WE', label: 'Wednesday' },
  { value: 'TH', label: 'Thursday' },
  { value: 'FR', label: 'Friday' },
  { value: 'SA', label: 'Saturday' },
  { value: 'SU', label: 'Sunday' },
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
  const [monthDay, setMonthDay] = useState<number | null>(30);
  const [weekday, setWeekday] = useState<string | null>(null);
  const [context, setContext] = useState('');

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

      <div className="create-project-row">
        <span className="create-project-row-label">on</span>
        <Select
          options={MONTH_DAYS}
          value={monthDay}
          onChange={setMonthDay}
          label="Day of the month"
        />
        <Select
          options={WEEKDAYS}
          value={weekday}
          onChange={setWeekday}
          label="Day of the week"
          placeholder="Any day"
        />
      </div>

      {/* One formatted field so the sheet has something to exercise the
          toolbar against. The provider is per form, not per field: it holds
          whichever formatted field has the caret and the toolbar reads it. */}
      <ActiveFieldProvider>
        <RichTextToolbar />
        <Field {...CONTEXT_FIELD} value={context} onChange={setContext} />
      </ActiveFieldProvider>
    </Modal>
  );
};
