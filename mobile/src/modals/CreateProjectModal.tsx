import './CreateProjectModal.css';

import { useCallback, useState } from 'react';
import { Modal } from '../ui/modal/Modal';
import type { ProjectCrumb } from '../ui/breadcrumbs/Breadcrumbs';
import { Breadcrumbs } from '../ui/breadcrumbs/Breadcrumbs';
import { Field } from '../ui/text-field/Field';
import { RichTextToolbar } from '../ui/text-field/RichTextToolbar';
import { ActiveFieldProvider } from '../ui/text-field/toolbar/activeField';
import { CONTEXT_FIELD, GOAL_FIELD, NAME_FIELD } from './fieldPresets';
import { useFormState } from './useFormState';
import { projectName } from '../config/labels';
import { buildCreateProjectDto } from './createProjectPayload';
import { apiClient, getConnection } from '../system/api.client';
import { Checkbox } from '../ui/checkbox/Checkbox';
import { ColorField } from './components/colorComponent/ColorField';
import { TargetComponent } from './components/targetComponent/TargetComponent';
import type { TargetReport } from './components/targetComponent/targetState';
import { EMPTY_TARGET } from './components/targetComponent/targetState';
import { TimeComponentsBlock } from './components/timeComponents/TimeComponentsBlock';
import type { TimeComponentsReport } from './components/timeComponents/timeComponentsState';
import {
  ProjectStatus,
  ProjectStatusSwitch,
} from './components/projectStatusSwitch/ProjectStatusSwitch';

type CreateProjectModalProps = {
  isOpen: boolean;
  onDismiss: () => void;
  projects: ProjectCrumb[];
  parentProjectId: string | null;
  defaultEvenLengthMinutes: number;
  inheritedColorId?: string | null;
};

const OPENED_WITH = {
  name: '',
  goal: '',
  context: '',
  status: 'ACTIVE' as ProjectStatus,
  isTimezoneFlexible: false,
};

export const CreateProjectModal = ({
  isOpen,
  onDismiss,
  projects,
  parentProjectId,
  defaultEvenLengthMinutes,
  inheritedColorId = null,
}: CreateProjectModalProps) => {
  const { values, set, isDirty } = useFormState(OPENED_WITH);
  const [targetReport, setTargetReport] = useState<TargetReport | null>(null);
  const [colorId, setColorId] = useState<string | null>(null);
  const [timeComponentsReport, setTimeComponentsReport] =
    useState<TimeComponentsReport | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  /* Set the moment the record exists, so the sheet closing behind a save is
     not asked whether to discard the work it has just written. */
  const [isSaved, setIsSaved] = useState(false);

  /* Nothing on this form is required — a project may be saved with no name at
     all. What is refused is a half-entered field: a ticked target with no
     number, or a time component missing an end. */
  const canSave =
    !isSaving &&
    targetReport?.isValid !== false &&
    timeComponentsReport?.isValid !== false;

  const save = async () => {
    setIsSaving(true);

    try {
      await apiClient.project.createProject(
        getConnection(),
        buildCreateProjectDto({
          values,
          target: targetReport?.value ?? EMPTY_TARGET,
          /* Everything on a form that is creating something is new, so the
             created list is the whole of it. */
          timeComponents:
            timeComponentsReport?.changes.createdTimeComponents ?? [],
          parentProjectId,
          colorId,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      );

      setIsSaved(true);
      onDismiss();
    } finally {
      setIsSaving(false);
    }
  };

  const handleTarget = useCallback(
    (report: TargetReport) => setTargetReport(report),
    [],
  );

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onDismiss}
      presentation="sheet"
      title="Create project"
      isDirty={
        !isSaved &&
        (isDirty ||
          targetReport?.isDirty === true ||
          timeComponentsReport?.isDirty === true)
      }
      leading={
        <button className="modal-action" type="button" onClick={onDismiss}>
          Cancel
        </button>
      }
      trailing={
        <button
          className="modal-action modal-action-primary"
          type="button"
          disabled={!canSave}
          onClick={save}
        >
          Done
        </button>
      }
    >
      {/* One bar for the whole form, not one per field. It is context, not
          placement: the provider holds whichever formatted field has the caret
          and the toolbar portals itself into that field's shell, so the fields
          it serves may sit anywhere below here and need not be near each other
          or near the bar. Which is why the provider wraps the entire body — a
          formatted field added further down is served without moving it. */}
      <ActiveFieldProvider>
        <RichTextToolbar />

        {/* The leaf tracks the name as it is typed, so the row always says where
          the thing being written will sit.
          TODO: the ancestors are links to nowhere until EditProjectModal gives
          them somewhere to go. */}
        <Breadcrumbs
          projects={projects}
          parentProjectId={parentProjectId}
          currentEntityName={projectName(values.name)}
          onSelect={() => {}}
        />

        <div className="create-project-headline">
          <Field
            {...NAME_FIELD}
            className="create-project-name"
            value={values.name}
            onChange={(name) => set({ name })}
          />

          <ProjectStatusSwitch
            currentValue={values.status}
            onChange={(status: ProjectStatus) => set({ status })}
          />
        </div>

        <Field
          {...GOAL_FIELD}
          className="create-project-field"
          value={values.goal}
          onChange={(goal) => set({ goal: goal })}
        />

        <Field
          {...CONTEXT_FIELD}
          className="create-project-field"
          value={values.context}
          onChange={(context) => set({ context })}
        />

        <div className="create-project-targets">
          <TargetComponent
            initial={EMPTY_TARGET}
            defaultEvenLengthMinutes={defaultEvenLengthMinutes}
            onChange={handleTarget}
          />
        </div>

        <div className="create-project-time-components">
          <TimeComponentsBlock
            initialTimeComponents={[]}
            seedFirstComponent
            onChange={setTimeComponentsReport}
          />

          <div className="create-project-row">
            <Checkbox
              checked={values.isTimezoneFlexible}
              onChange={(isTimezoneFlexible) => set({ isTimezoneFlexible })}
              label="Soft timezone"
            />
          </div>

          <ColorField
            ownColorId={colorId}
            onChange={setColorId}
            editable={true}
            inheritedColorId={inheritedColorId}
          />
        </div>
      </ActiveFieldProvider>
    </Modal>
  );
};
