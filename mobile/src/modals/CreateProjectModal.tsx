import './CreateProjectModal.css';

import { useState } from 'react';
import { Modal } from '../ui/modal/Modal';
import { Breadcrumbs } from '../ui/breadcrumbs/Breadcrumbs';
import type { BreadcrumbItem } from '../ui/breadcrumbs/Breadcrumbs';
import { SegmentedControl } from '../ui/segmented-control/SegmentedControl';
import type { SegmentedOption } from '../ui/segmented-control/SegmentedControl';
import { Field } from '../ui/text-field/Field';
import { RichTextToolbar } from '../ui/text-field/RichTextToolbar';
import { ActiveFieldProvider } from '../ui/text-field/richText/activeField';
import { CONTEXT_FIELD } from './fieldPresets';
import { TimeComponentsBlock } from './components/TimeComponentsBlock';
import type { TimeComponentsReport } from './components/timeComponents/timeComponentsState';
import type { TimeComponentWithSlots } from '../api/structures/TimeComponentWithSlots';

type CreateProjectModalProps = {
  isOpen: boolean;
  onDismiss: () => void;
};

type ProjectStatus = 'ACTIVE' | 'BACKLOG';

const STATUS_OPTIONS: SegmentedOption<ProjectStatus>[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'BACKLOG', label: 'Backlog' },
];

// TODO: demo data until the form binds a real project.
const SAMPLE_TIME_COMPONENTS: TimeComponentWithSlots[] = [
  {
    id: 'sample-absolute',
    projectId: 'sample-project',
    type: 'ABSOLUTE',
    absoluteFrom: '2026-06-19T17:45:00.000Z',
    absoluteTo: '2026-06-19T18:45:00.000Z',
    recurringInterval: null,
    recurringFrequency: null,
    recurringByDay: [],
    recurringByMonthDay: null,
    recurringByMonth: null,
    recurringStartDate: null,
    recurringTimeSlots: [],
  },
  {
    id: 'sample-daily',
    projectId: 'sample-project',
    type: 'RECURRING',
    absoluteFrom: null,
    absoluteTo: null,
    recurringInterval: 1,
    recurringFrequency: 'DAY',
    recurringByDay: [],
    recurringByMonthDay: null,
    recurringByMonth: null,
    recurringStartDate: '2026-06-19T00:00:00.000Z',
    recurringTimeSlots: [
      {
        id: 'sample-daily-slot',
        type: 'ABSOLUTE',
        from: '1970-01-01T17:45:00.000Z',
        to: '1970-01-01T18:45:00.000Z',
        flexibleMinutesNeeded: null,
        timeComponentId: 'sample-daily',
      },
    ],
  },
  {
    id: 'sample-weekly',
    projectId: 'sample-project',
    type: 'RECURRING',
    absoluteFrom: null,
    absoluteTo: null,
    recurringInterval: 1,
    recurringFrequency: 'WEEK',
    recurringByDay: ['TU'],
    recurringByMonthDay: null,
    recurringByMonth: null,
    recurringStartDate: '2026-06-19T00:00:00.000Z',
    recurringTimeSlots: [
      {
        id: 'sample-weekly-slot',
        type: 'ABSOLUTE',
        from: '1970-01-01T17:45:00.000Z',
        to: '1970-01-01T18:45:00.000Z',
        flexibleMinutesNeeded: null,
        timeComponentId: 'sample-weekly',
      },
    ],
  },
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
  const [context, setContext] = useState('');
  const [timeComponentsReport, setTimeComponentsReport] =
    useState<TimeComponentsReport | null>(null);

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

      {/* TODO: demo mount with sample data until the form binds a real project. */}
      <div className="create-project-time-components">
        <TimeComponentsBlock
          initialTimeComponents={SAMPLE_TIME_COMPONENTS}
          onChange={setTimeComponentsReport}
        />
        {timeComponentsReport?.isDirty && (
          <p className="create-project-placeholder">
            {[
              timeComponentsReport.isValid ? 'valid' : 'incomplete',
              `+${timeComponentsReport.changes.createdTimeComponents.length}`,
              `~${timeComponentsReport.changes.updatedTimeComponents.length}`,
              `−${timeComponentsReport.changes.deletedTimeComponentIds.length}`,
            ].join(' · ')}
          </p>
        )}
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
