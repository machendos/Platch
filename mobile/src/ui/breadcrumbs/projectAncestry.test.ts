import { describe, expect, it } from 'vitest';
import { UNNAMED_PROJECT } from '../../config/labels';
import { buildAncestry } from './projectAncestry';
import type { ProjectCrumb } from './projectAncestry';

const project = (
  id: string,
  parentProjectId: string | null = null,
): ProjectCrumb => ({ id, name: id.toUpperCase(), parentProjectId });

const TREE: ProjectCrumb[] = [
  project('house'),
  project('kitchen', 'house'),
  project('shelves', 'kitchen'),
  project('garden'),
];

const labels = (items: { label: unknown }[]) => items.map((item) => item.label);

describe('buildAncestry', () => {
  it('is empty for a project with no parent', () => {
    expect(buildAncestry(TREE, null)).toEqual([]);
  });

  it('is the root alone when the parent is the root', () => {
    expect(labels(buildAncestry(TREE, 'house'))).toEqual(['HOUSE']);
  });

  /* Root first: the row describes a path downward, whatever direction it was
     walked in. */
  it('reads root to parent, not parent to root', () => {
    expect(labels(buildAncestry(TREE, 'shelves'))).toEqual([
      'HOUSE',
      'KITCHEN',
      'SHELVES',
    ]);
  });

  it('carries each project id through', () => {
    expect(buildAncestry(TREE, 'kitchen').map((item) => item.id)).toEqual([
      'house',
      'kitchen',
    ]);
  });

  it('is empty when the parent is not in the list', () => {
    expect(buildAncestry(TREE, 'missing')).toEqual([]);
  });

  /* Nothing in the schema stops a cycle, and one must not hang the modal. */
  it('stops on a cycle instead of looping', () => {
    const cycle = [project('a', 'b'), project('b', 'a')];

    expect(labels(buildAncestry(cycle, 'a'))).toEqual(['B', 'A']);
  });

  it('stops where a chain leaves the list', () => {
    const orphaned = [project('kitchen', 'house'), project('shelves', 'kitchen')];

    expect(labels(buildAncestry(orphaned, 'shelves'))).toEqual([
      'KITCHEN',
      'SHELVES',
    ]);
  });

  /* The column is nullable by design — a project can be saved without a name
     for fast capture — so a crumb has to print something. */
  it('labels an unnamed ancestor rather than leaving the crumb blank', () => {
    const unnamed: ProjectCrumb[] = [
      { id: 'house', name: null, parentProjectId: null },
      project('kitchen', 'house'),
    ];

    expect(labels(buildAncestry(unnamed, 'kitchen'))).toEqual([
      UNNAMED_PROJECT,
      'KITCHEN',
    ]);
  });
});
