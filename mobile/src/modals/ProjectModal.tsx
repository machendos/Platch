import './ProjectModal.css';

import { useEffect, useRef, useState } from 'react';
import { Modal } from '../ui/modal/Modal';
import { Breadcrumbs } from '../ui/breadcrumbs/Breadcrumbs';
import { ancestorsOf } from '../ui/breadcrumbs/projectAncestry';
import { Field } from '../ui/text-field/Field';
import { RichTextToolbar } from '../ui/text-field/RichTextToolbar';
import { ActiveFieldProvider } from '../ui/text-field/toolbar/activeField';
import { CONTEXT_FIELD, GOAL_FIELD, NAME_FIELD } from './fieldPresets';
import { useEntityForm } from './useEntityForm';
import { projectName } from '../config/labels';
import { toProjectFormValues, toProjectTarget } from './projectFormValues';
import type { ProjectFormValues } from './projectFormValues';
import { NO_PROJECT_CHANGES, projects as projectsApi } from '../api/project';
import type { Project } from '../api/project';
import { events } from '../api/event';
import type { Event } from '../api/event';
import { colors as colorsApi } from '../api/color';
import type { ColorInUse } from '../api/color';
import { ColorField } from './components/colorComponent/ColorField';
import { TargetComponent } from './components/targetComponent/TargetComponent';
import type { TargetReport } from './components/targetComponent/targetState';
import { EMPTY_TARGET } from './components/targetComponent/targetState';
import { TimeComponentsBlock } from './components/recurringTimeComponents/TimeComponentsBlock';
import type { TimeEntriesReport } from './components/recurringTimeComponents/timeEntriesState';
import {
  ProjectStatus,
  ProjectStatusSwitch,
} from './components/projectStatusSwitch/ProjectStatusSwitch';
import {
  ProjectType,
  ProjectTypeSwitch,
} from './components/projectTypeSwitch/ProjectTypeSwitch';
import { deviceZone } from '../features/timezone/helpers';

type ProjectModalProps = {
  isOpen: boolean;
  onDismiss: () => void;
  defaultEvenLengthMinutes: number;
} & (
  | { mode: 'create'; parentProjectId: string | null; status: ProjectStatus }
  | { mode: 'edit'; projectId: string }
);

const BLANK: Omit<ProjectFormValues, 'status'> = {
  name: '',
  goal: '',
  context: '',
  type: ProjectType.EXTERNAL,
  colorId: null,
};

type FormState = { canSave: boolean; isDirty: boolean; save: () => void };

type OpenedData = {
  projects: Project[];
  colors: ColorInUse[];
  projectEvents: Event[];
};

const NOTHING_OPENED: OpenedData = {
  projects: [],
  colors: [],
  projectEvents: [],
};

/* The sheet opens on the tap and fills in when the list arrives, rather than
   waiting to appear at all. The form still seeds once from settled data — it
   just mounts inside a sheet that is already on screen.

   Done lives up here because the header does, so the body reports what it can
   do, the same way the blocks inside it report to the form. */
export const ProjectModal = (props: ProjectModalProps) => {
  const { isOpen, onDismiss } = props;
  const [opened, setOpened] = useState<OpenedData | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const projectId = props.mode === 'edit' ? props.projectId : null;

  useEffect(() => {
    let isCurrent = true;

    Promise.all([
      projectsApi.getProjects(),
      colorsApi.getColors(),
      projectId === null ? [] : events.getEventsOfProject(projectId),
    ])
      .then(([projects, colors, projectEvents]) => {
        if (isCurrent) setOpened({ projects, colors, projectEvents });
      })
      .catch(() => {
        if (isCurrent) setOpened(NOTHING_OPENED);
      });

    return () => {
      isCurrent = false;
    };
  }, [projectId]);

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onDismiss}
      presentation="page"
      title={props.mode === 'edit' ? 'Edit project' : 'Create project'}
      isDirty={form?.isDirty ?? false}
      leading={
        <button className="modal-action" type="button" onClick={onDismiss}>
          Cancel
        </button>
      }
      trailing={
        <button
          className="modal-action modal-action-primary"
          type="button"
          disabled={!form?.canSave}
          onClick={() => form?.save()}
        >
          Done
        </button>
      }
    >
      {opened && (
        <ProjectForm {...props} {...opened} onFormState={setForm} />
      )}
    </Modal>
  );
};

const ProjectForm = (
  props: ProjectModalProps &
    OpenedData & { onFormState: (state: FormState) => void },
) => {
  const {
    onDismiss,
    defaultEvenLengthMinutes,
    onFormState,
    projects,
    colors,
    projectEvents,
  } = props;

  const isEdit = props.mode === 'edit';

  const [opened] = useState(() => {
    const project = isEdit
      ? (projects.find(({ id }) => id === props.projectId) ?? null)
      : null;

    const parentProjectId = project
      ? project.parentProjectId
      : props.mode === 'create'
        ? props.parentProjectId
        : null;

    const ancestors = ancestorsOf(projects, parentProjectId);

    return {
      project,
      ancestors,
      values: project
        ? toProjectFormValues(project)
        : {
            ...BLANK,
            status:
              props.mode === 'create' ? props.status : ProjectStatus.ACTIVE,
          },
      target: project ? toProjectTarget(project) : EMPTY_TARGET,
      recurringTimeComponents: project ? project.recurringTimeComponents : [],
      inheritedColorId:
        ancestors.find(({ colorId }) => colorId !== null)?.colorId ?? null,
      parentProjectId,
    };
  });

  const [targetReport, setTargetReport] = useState<TargetReport | null>(null);
  const [timeEntriesReport, setTimeEntriesReport] =
    useState<TimeEntriesReport | null>(null);

  const form = useEntityForm({
    initialValues: opened.values,
    reports: [targetReport, timeEntriesReport],
    onDismiss,
  });

  const { values, set } = form;

  const save = () =>
    form.save(async () => {
      const changes = timeEntriesReport?.changes ?? NO_PROJECT_CHANGES;

      if (opened.project) {
        await projectsApi.updateProject({
          id: opened.project.id,
          name: values.name,
          goal: values.goal,
          context: values.context,
          projectType: values.type,
          colorId: values.colorId,
          ...(targetReport?.value ?? opened.target),
          ...changes,
        });
      } else {
        await projectsApi.createProject({
          name: values.name,
          goal: values.goal,
          context: values.context,
          projectStatus: values.status,
          projectType: values.type,
          colorId: values.colorId,
          parentProjectId: opened.parentProjectId,
          originalTimezone: deviceZone(),
          ...(targetReport?.value ?? EMPTY_TARGET),
          recurringTimeComponents: changes.createdRecurringTimeComponents,
          events: changes.createdEvents,
        });
      }
    });

  const saveRef = useRef(save);
  saveRef.current = save;

  const { canSave, isDirty } = form;
  useEffect(() => {
    onFormState({ canSave, isDirty, save: () => saveRef.current() });
  }, [canSave, isDirty, onFormState]);

  if (props.mode === 'edit' && !opened.project) return null;

  return (
    <ActiveFieldProvider>
      <RichTextToolbar />

      <Breadcrumbs
        ancestors={opened.ancestors}
        currentEntityName={projectName(values.name)}
        onSelect={() => {}}
      />

      <div className="project-form-headline">
        <Field
          {...NAME_FIELD}
          className="project-form-name"
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
        className="project-form-field"
        value={values.goal}
        onChange={(goal) => set({ goal })}
      />

      <Field
        {...CONTEXT_FIELD}
        className="project-form-field"
        value={values.context}
        onChange={(context) => set({ context })}
      />

      <div className="project-form-targets">
        <TargetComponent
          initial={opened.target}
          defaultEvenLengthMinutes={defaultEvenLengthMinutes}
          onChange={setTargetReport}
        />
      </div>

      <div className="project-form-time-components">
        <TimeComponentsBlock
          initialRecurringTimeComponents={opened.recurringTimeComponents}
          initialEvents={projectEvents}
          seedFirstComponent={!isEdit}
          onChange={setTimeEntriesReport}
        />

        <div className="project-form-row">
          <span className="project-form-label">Project type</span>

          <ProjectTypeSwitch
            currentValue={values.type}
            onChange={(type: ProjectType) => set({ type })}
          />
        </div>

        <ColorField
          colors={colors}
          ownColorId={values.colorId}
          onChange={(colorId) => set({ colorId })}
          editable={true}
          inheritedColorId={opened.inheritedColorId}
          editedProjectId={opened.project?.id ?? null}
        />
      </div>
    </ActiveFieldProvider>
  );
};
