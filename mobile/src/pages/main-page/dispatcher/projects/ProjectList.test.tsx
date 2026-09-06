import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectWithTimeSlots } from '../../../../api/structures/ProjectWithTimeSlots';
import type { ProjectStatus } from './projectTree';
import { ProjectList } from './ProjectList';

const makeProject = (
  id: string,
  parent: string | null = null,
  position = 'a0',
  status: ProjectStatus = 'ACTIVE',
): ProjectWithTimeSlots => ({
  timeComponents: [],
  color: null,
  name: id,
  id,
  goal: null,
  context: null,
  timeNeededMinutes: null,
  minBlockMinutes: null,
  repetitionsNeeded: null,
  earliestDate: null,
  earliestTime: null,
  deadlineDate: null,
  deadlineTime: null,
  projectStatus: status,
  flexibleTimezone: false,
  originalTimezone: null,
  parentProjectId: parent,
  colorId: null,
  position,
  userId: 'user',
});

const findRow = (name: string) =>
  screen.getByText(name).closest('.project-row') as HTMLElement;

describe('ProjectList', () => {
  const tree = [
    makeProject('sport'),
    makeProject('workout', 'sport'),
    makeProject('legs', 'workout'),
  ];

  it('draws one row per project, in chain order', () => {
    render(
      <ProjectList
        reveal={null}
        onMoveToOtherCategory={() => {}}
        projects={[makeProject('b', null, 'a2'), makeProject('a', null, 'a1')]}
        status="ACTIVE"
      />,
    );

    const names = screen.getAllByText(/^[ab]$/).map((node) => node.textContent);
    expect(names).toEqual(['a', 'b']);
  });

  it('steps each level by the same shared indent variable', () => {
    render(<ProjectList
        projects={tree}
        status="ACTIVE"
        reveal={null}
        onMoveToOtherCategory={() => {}}
      />);

    expect(findRow('sport').style.marginInlineStart).toBe(
      'calc(var(--project-indent-step) * 0)',
    );
    expect(findRow('workout').style.marginInlineStart).toBe(
      'calc(var(--project-indent-step) * 1)',
    );
    expect(findRow('legs').style.marginInlineStart).toBe(
      'calc(var(--project-indent-step) * 2)',
    );
  });

  it('draws no ancestor from the other category', () => {
    render(
      <ProjectList
        reveal={null}
        onMoveToOtherCategory={() => {}}
        projects={[
          makeProject('sport'),
          makeProject('workout', 'sport'),
          makeProject('legs', 'workout', 'a0', 'BACKLOG'),
        ]}
        status="BACKLOG"
      />,
    );

    expect(screen.queryByText('sport')).toBeNull();
    expect(screen.queryByText('workout')).toBeNull();

    /* Its parent is in the other category, so it has none here and sits at the
       top level rather than vanishing with it. */
    expect(findRow('legs').style.marginInlineStart).toBe(
      'calc(var(--project-indent-step) * 0)',
    );
  });

  it('gives a chevron only to rows that render children', () => {
    render(<ProjectList
        projects={tree}
        status="ACTIVE"
        reveal={null}
        onMoveToOtherCategory={() => {}}
      />);

    expect(screen.getByRole('button', { name: 'Collapse sport' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /^(Collapse|Expand) legs$/ }),
    ).toBeNull();
  });

  it('hides the subtree when a chevron is clicked, and brings it back', async () => {
    const user = userEvent.setup();
    render(<ProjectList
        projects={tree}
        status="ACTIVE"
        reveal={null}
        onMoveToOtherCategory={() => {}}
      />);

    await user.click(screen.getByRole('button', { name: 'Collapse workout' }));
    expect(screen.queryByText('legs')).toBeNull();
    expect(screen.getByText('workout')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Expand workout' }));
    expect(screen.getByText('legs')).toBeTruthy();
  });

  it('renders nothing when no project belongs to the section', () => {
    const { container } = render(
      <ProjectList
        projects={tree}
        status="BACKLOG"
        reveal={null}
        onMoveToOtherCategory={() => {}}
      />,
    );

    expect(container.querySelectorAll('.project-row')).toHaveLength(0);
  });
});
