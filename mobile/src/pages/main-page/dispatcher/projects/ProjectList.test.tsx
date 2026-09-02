import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectWithTimeSlots } from '../../../../api/structures/ProjectWithTimeSlots';
import type { ProjectStatus } from './projectTree';
import { ProjectList } from './ProjectList';

const project = (
  id: string,
  parent: string | null = null,
  prev: string | null = null,
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
  prevProjectIdInHierarchy: prev,
  userId: 'user',
});

const rowFor = (name: string) =>
  screen.getByText(name).closest('.project-row') as HTMLElement;

describe('ProjectList', () => {
  const tree = [
    project('sport'),
    project('workout', 'sport'),
    project('legs', 'workout'),
  ];

  it('draws one row per project, in chain order', () => {
    render(
      <ProjectList
        projects={[project('b', null, 'a'), project('a')]}
        status="ACTIVE"
      />,
    );

    const names = screen.getAllByText(/^[ab]$/).map((node) => node.textContent);
    expect(names).toEqual(['a', 'b']);
  });

  it('steps each level by the same shared indent variable', () => {
    render(<ProjectList projects={tree} status="ACTIVE" />);

    expect(rowFor('sport').style.marginInlineStart).toBe(
      'calc(var(--project-indent-step) * 0)',
    );
    expect(rowFor('workout').style.marginInlineStart).toBe(
      'calc(var(--project-indent-step) * 1)',
    );
    expect(rowFor('legs').style.marginInlineStart).toBe(
      'calc(var(--project-indent-step) * 2)',
    );
  });

  it('marks an ancestor shown for context as a spine, and the project as real', () => {
    render(
      <ProjectList
        projects={[
          project('sport'),
          project('workout', 'sport'),
          project('legs', 'workout', null, 'BACKLOG'),
        ]}
        status="BACKLOG"
      />,
    );

    expect(rowFor('sport')).toHaveClass('project-row-spine');
    expect(rowFor('workout')).toHaveClass('project-row-spine');
    expect(rowFor('legs')).not.toHaveClass('project-row-spine');
  });

  it('gives a chevron only to rows that render children', () => {
    render(<ProjectList projects={tree} status="ACTIVE" />);

    expect(screen.getByRole('button', { name: 'Collapse sport' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /legs/ })).toBeNull();
  });

  it('hides the subtree when a chevron is clicked, and brings it back', async () => {
    const user = userEvent.setup();
    render(<ProjectList projects={tree} status="ACTIVE" />);

    await user.click(screen.getByRole('button', { name: 'Collapse workout' }));
    expect(screen.queryByText('legs')).toBeNull();
    expect(screen.getByText('workout')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Expand workout' }));
    expect(screen.getByText('legs')).toBeTruthy();
  });

  it('renders nothing when no project belongs to the section', () => {
    const { container } = render(
      <ProjectList projects={tree} status="BACKLOG" />,
    );

    expect(container.querySelectorAll('.project-row')).toHaveLength(0);
  });
});
