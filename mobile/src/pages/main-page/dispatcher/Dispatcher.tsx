import { useEffect, useRef, useState } from 'react';
import { Divider } from '../Divider';
import { DispatcherSection } from './DispatcherSection';
import { useSectionResize } from './useSectionResize';
import type { SectionWeights, SectionsExpanded } from '../layoutStorage';
import { layoutStorage } from '../layoutStorage';
import { ProjectModal } from '../../../modals/ProjectModal';
import type { CurrentUser } from '../../../api/sdk/structures/CurrentUser';
import { useMoveProject, useProjectsQuery } from '../../../api/project';
import { applyMove } from './projects/dnd/applyMove';
import { ProjectDragProvider } from './projects/dnd/ProjectDragProvider';
import type { RevealRequest } from './projects/ProjectList';
import { ProjectList } from './projects/ProjectList';
import { ProjectStatus } from '../../../modals/components/projectStatusSwitch/ProjectStatusSwitch';
import { otherCategory, resolveCategoryMove } from './projects/categoryMove';
import './Dispatcher.css';

type SectionName = 'plan' | 'active' | 'backlog';

const EVEN_WEIGHTS: SectionWeights = { plan: 1, active: 1, backlog: 1 };
const DEFAULT_EXPANDED: SectionsExpanded = {
  plan: true,
  active: false,
  backlog: false,
};

type DispatcherProps = { currentUser: CurrentUser };

export const Dispatcher = ({ currentUser }: DispatcherProps) => {
  const projects = useProjectsQuery();
  const move = useMoveProject(applyMove);
  const [expanded, setExpanded] = useState(DEFAULT_EXPANDED);
  const [weights, setWeights] = useState(EVEN_WEIGHTS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [createUnderStatus, setCreateUnderStatus] =
    useState<ProjectStatus | null>(null);
  const [editedProjectId, setEditedProjectId] = useState<string | null>(null);

  /* Which project to reveal, and a token so the same project can be revealed
     twice. Held here because the landing section is a different ProjectList
     from the one the menu was opened in. */
  const [reveal, setReveal] = useState<RevealRequest | null>(null);

  const revealProject = (id: string) =>
    setReveal((current) => ({ id, token: (current?.token ?? 0) + 1 }));

  const moveToOtherCategory = (id: string) => {
    const project = projects.find((candidate) => candidate.id === id);
    if (!project) return;

    const target = otherCategory(project.projectStatus);

    move(resolveCategoryMove(projects, project, target));
    revealProject(id);
  };

  const listFor = (status: 'ACTIVE' | 'BACKLOG') => (
    <ProjectList
      projects={projects}
      status={status}
      onProjectEditOpen={({ id }) => setEditedProjectId(id)}
      reveal={reveal}
      onMoveToOtherCategory={moveToOtherCategory}
    />
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const { beginDrag, resizePlan, resizeActive } = useSectionResize(
    containerRef,
    setWeights,
  );

  useEffect(() => {
    Promise.all([
      layoutStorage.getSectionsExpanded(),
      layoutStorage.getSectionWeights(),
    ]).then(([storedExpanded, storedWeights]) => {
      if (storedExpanded) setExpanded(storedExpanded);
      if (storedWeights) setWeights(storedWeights);
      setIsLoaded(true);
    });
  }, []);

  const setSectionExpanded = (section: SectionName, isExpanded: boolean) => {
    const next = { ...expanded, [section]: isExpanded };
    setExpanded(next);
    setWeights(EVEN_WEIGHTS);
    layoutStorage.setSectionsExpanded(next);
    layoutStorage.setSectionWeights(EVEN_WEIGHTS);
  };

  const saveWeights = () => layoutStorage.setSectionWeights(weights);

  if (!isLoaded) return <div className="dispatcher" />;

  const showPlanDivider = expanded.plan && expanded.active;
  const showActiveDivider = expanded.active && expanded.backlog;

  const sectionTrack = (isExpanded: boolean, weight: number) =>
    isExpanded ? `minmax(var(--section-header-height), ${weight}fr)` : 'auto';
  const gridTemplateRows = [
    sectionTrack(expanded.plan, weights.plan),
    ...(showPlanDivider ? ['auto'] : []),
    sectionTrack(expanded.active, weights.active),
    ...(showActiveDivider ? ['auto'] : []),
    sectionTrack(expanded.backlog, weights.backlog),
  ].join(' ');

  return (
    <ProjectDragProvider
      projects={projects}
      onMove={move}
      onDropped={revealProject}
    >
      <div
        className="dispatcher"
        ref={containerRef}
        style={{ gridTemplateRows }}
      >
        <DispatcherSection
          title="PLAN"
          expanded={expanded.plan}
          onSetExpanded={(next) => setSectionExpanded('plan', next)}
          onAdd={() => {}}
        />

        {showPlanDivider && (
          <Divider
            orientation="horizontal"
            onDragStart={beginDrag}
            onDrag={resizePlan}
            onDragEnd={saveWeights}
          />
        )}

        <DispatcherSection
          title="ACTIVE PROJECTS"
          expanded={expanded.active}
          onSetExpanded={(next) => setSectionExpanded('active', next)}
          onAdd={() => setCreateUnderStatus(ProjectStatus.ACTIVE)}
        >
          {listFor('ACTIVE')}
        </DispatcherSection>

        {showActiveDivider && (
          <Divider
            orientation="horizontal"
            onDragStart={beginDrag}
            onDrag={resizeActive}
            onDragEnd={saveWeights}
          />
        )}

        <DispatcherSection
          title="BACKLOG"
          expanded={expanded.backlog}
          onSetExpanded={(next) => setSectionExpanded('backlog', next)}
          onAdd={() => setCreateUnderStatus(ProjectStatus.BACKLOG)}
        >
          {listFor('BACKLOG')}
        </DispatcherSection>

        {createUnderStatus && (
          <ProjectModal
            key={createUnderStatus}
            mode="create"
            isOpen
            onDismiss={() => setCreateUnderStatus(null)}
            parentProjectId={null}
            status={createUnderStatus}
            defaultEvenLengthMinutes={currentUser.defaultEvenLengthMinutes}
          />
        )}

        {editedProjectId && (
          <ProjectModal
            key={editedProjectId}
            mode="edit"
            isOpen
            onDismiss={() => setEditedProjectId(null)}
            projectId={editedProjectId}
            defaultEvenLengthMinutes={currentUser.defaultEvenLengthMinutes}
          />
        )}
      </div>
    </ProjectDragProvider>
  );
};
