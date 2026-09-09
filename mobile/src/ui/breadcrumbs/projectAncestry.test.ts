import { describe, expect, it } from 'vitest';
import { ancestorsOf } from './projectAncestry';
import type { ProjectCrumb } from './projectAncestry';

const project = (
  id: string,
  parentProjectId: string | null = null,
  colorId: string | null = null,
): ProjectCrumb => ({
  id,
  name: id.toUpperCase(),
  parentProjectId,
  colorId,
});

const TREE: ProjectCrumb[] = [
  project('house', null, 'red'),
  project('kitchen', 'house'),
  project('shelves', 'kitchen'),
  project('garden'),
];

const ids = (items: ProjectCrumb[]) => items.map((item) => item.id);

describe('ancestorsOf', () => {
  it('is empty for a project with no parent', () => {
    expect(ancestorsOf(TREE, null)).toEqual([]);
  });

  it('is the root alone when the parent is the root', () => {
    expect(ids(ancestorsOf(TREE, 'house'))).toEqual(['house']);
  });

  it('reads nearest parent first', () => {
    expect(ids(ancestorsOf(TREE, 'shelves'))).toEqual([
      'shelves',
      'kitchen',
      'house',
    ]);
  });

  it('is empty when the parent is not in the list', () => {
    expect(ancestorsOf(TREE, 'missing')).toEqual([]);
  });

  it('stops on a cycle instead of looping', () => {
    const cycle = [project('a', 'b'), project('b', 'a')];

    expect(ids(ancestorsOf(cycle, 'a'))).toEqual(['a', 'b']);
  });

  it('stops where a chain leaves the list', () => {
    const orphaned = [
      project('kitchen', 'house'),
      project('shelves', 'kitchen'),
    ];

    expect(ids(ancestorsOf(orphaned, 'shelves'))).toEqual([
      'shelves',
      'kitchen',
    ]);
  });

  it('hands back the caller’s own records, so inherited values read off it', () => {
    const nearestColoured = ancestorsOf(TREE, 'shelves').find(
      ({ colorId }) => colorId !== null,
    );

    expect(nearestColoured?.id).toBe('house');
  });
});
