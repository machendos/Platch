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
import {
  buildCreateProjectDto,
  buildUpdateProjectDto,
  toProjectFormValues,
  toTargetDraft,
} from './projectPayload';
import type { ProjectFormValues } from './projectPayload';
import {
  useProjectsQuery,
  useRefreshProjects,
  useSaveProject,
} from '../api/project';
import { useColorsQuery, useRefreshColors } from '../api/color';
import { ColorField } from './components/colorComponent/ColorField';
import { TargetComponent } from './components/targetComponent/TargetComponent';
import type { TargetReport } from './components/targetComponent/targetState';
import { EMPTY_TARGET } from './components/targetComponent/targetState';
import { TimeComponentsBlock } from './components/timeComponents/TimeComponentsBlock';
import type { TimeComponentsReport } from './components/timeComponents/timeComponentsState';
import { NO_TIME_COMPONENT_CHANGES } from './components/timeComponents/timeComponentsState';
import {
  ProjectStatus,
  ProjectStatusSwitch,
} from './components/projectStatusSwitch/ProjectStatusSwitch';
import {
  ProjectType,
  ProjectTypeSwitch,
} from './components/projectTypeSwitch/ProjectTypeSwitch';

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

/* The sheet opens on the tap and fills in when the list arrives, rather than
   waiting to appear at all. The form still seeds once from settled data — it
   just mounts inside a sheet that is already on screen.

   Done lives up here because the header does, so the body reports what it can
   do, the same way the blocks inside it report to the form. */
export const ProjectModal = (props: ProjectModalProps) => {
  const { isOpen, onDismiss } = props;
  const refreshProjects = useRefreshProjects();
  const refreshColors = useRefreshColors();
  const [isRefreshed, setIsRefreshed] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    let isCurrent = true;

    Promise.all([refreshProjects(), refreshColors()])
      .catch(() => {})
      .finally(() => {
        if (isCurrent) setIsRefreshed(true);
      });

    return () => {
      isCurrent = false;
    };
  }, [refreshProjects, refreshColors]);

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
      {isRefreshed && <ProjectForm {...props} onFormState={setForm} />}
    </Modal>
  );
};

const ProjectForm = (
  props: ProjectModalProps & { onFormState: (state: FormState) => void },
) => {
  const { onDismiss, defaultEvenLengthMinutes, onFormState } = props;
  const projects = useProjectsQuery();
  const colors = useColorsQuery();
  const { createProject, updateProject } = useSaveProject();

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
      target: project ? toTargetDraft(project) : EMPTY_TARGET,
      timeComponents: project ? project.timeComponents : [],
      inheritedColorId:
        ancestors.find(({ colorId }) => colorId !== null)?.colorId ?? null,
      parentProjectId,
    };
  });

  const [target, setTarget] = useState<TargetReport | null>(null);
  const [time, setTime] = useState<TimeComponentsReport | null>(null);

  const form = useEntityForm({
    initialValues: opened.values,
    reports: [target, time],
    onDismiss,
  });

  const { values, set } = form;

  const save = () =>
    form.save(async () => {
      if (opened.project) {
        await updateProject(
          buildUpdateProjectDto({
            id: opened.project.id,
            values,
            target: target?.value ?? opened.target,
            timeComponentsChanges: time?.changes ?? NO_TIME_COMPONENT_CHANGES,
          }),
        );
      } else {
        await createProject(
          buildCreateProjectDto({
            values,
            target: target?.value ?? EMPTY_TARGET,
            timeComponents: time?.changes.createdTimeComponents ?? [],
            parentProjectId: opened.parentProjectId,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        );
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
          onChange={setTarget}
        />
      </div>

      <div className="project-form-time-components">
        <TimeComponentsBlock
          initialTimeComponents={opened.timeComponents}
          seedFirstComponent={!isEdit}
          onChange={setTime}
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
