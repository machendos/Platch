import { useEffect, useRef, useState } from 'react';
import { Divider } from '../Divider';
import { DispatcherSection } from './DispatcherSection';
import { useSectionResize } from './useSectionResize';
import type { SectionWeights, SectionsExpanded } from '../layoutStorage';
import { layoutStorage } from '../layoutStorage';
import { CreateProjectModal } from '../../../modals/CreateProjectModal';
import type { CurrentUser } from '../../../api/structures/CurrentUser';
import type { MoveProjectDto } from '../../../api/structures/MoveProjectDto';
import type { ProjectWithTimeSlots } from '../../../api/structures/ProjectWithTimeSlots';
import { ProjectDragProvider } from './projects/dnd/ProjectDragProvider';
import { ProjectList } from './projects/ProjectList';
import './Dispatcher.css';

type SectionName = 'plan' | 'active' | 'backlog';

const EVEN_WEIGHTS: SectionWeights = { plan: 1, active: 1, backlog: 1 };
const DEFAULT_EXPANDED: SectionsExpanded = {
  plan: true,
  active: false,
  backlog: false,
};

type DispatcherProps = {
  currentUser: CurrentUser;
  projects: ProjectWithTimeSlots[];
  onMove: (dto: MoveProjectDto) => void;
};

export const Dispatcher = ({
  currentUser,
  projects,
  onMove,
}: DispatcherProps) => {
  const [expanded, setExpanded] = useState(DEFAULT_EXPANDED);
  const [weights, setWeights] = useState(EVEN_WEIGHTS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

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
    <ProjectDragProvider projects={projects} onMove={onMove}>
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
          onAdd={() => setIsCreateProjectOpen(true)}
        >
          <ProjectList projects={projects} status="ACTIVE" />
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
          onAdd={() => {}}
        >
          <ProjectList projects={projects} status="BACKLOG" />
        </DispatcherSection>

        <CreateProjectModal
          isOpen={isCreateProjectOpen}
          onDismiss={() => setIsCreateProjectOpen(false)}
          projects={projects}
          parentProjectId={null}
          defaultEvenLengthMinutes={currentUser.defaultEvenLengthMinutes}
        />
      </div>
    </ProjectDragProvider>
  );
};
